import type { AutomationInput, AutomationResult } from '@/lib/automation-v2/types';
import { loadConversationHistory } from '@/lib/automation-v2/history';
import { loadV3Context, saveV3Memory } from './context';
import { decideV3 } from './model';
import { mergeMemory, validateV3Action } from './validator';
import { runV3Action } from './actions';

export async function handleAutomationMessageV3(input: AutomationInput): Promise<AutomationResult> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    const ctx = await loadV3Context({
        supabase: input.supabase,
        userId: input.userId,
        workspaceId: input.workspaceId,
        chatId: input.chatId,
    });

    if (!ctx) {
        return {
            shouldReply: false,
            actions: ['v3_config_failed'],
            stateBefore: 'idle',
            stateAfter: 'idle',
            debug: {
                requestId,
                engineVersion: 'v2',
                workspaceId: input.workspaceId,
                workspaceType: input.workspaceType,
                chatId: input.chatId,
                language: 'unknown',
                intent: 'config_failed',
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                durationMs: Date.now() - startTime,
            },
            error: 'V3 config failed',
        };
    }

    const history = await loadConversationHistory(input.supabase, input.userId, input.workspaceId, input.chatId);
    const decision = await decideV3({ ctx, customerMessage: input.message, history });
    const memory = mergeMemory(ctx.memory, decision.memoryPatch);

    const validation = validateV3Action(ctx, decision, memory);
    let replyText = decision.reply;
    let actions = ['v3_reply'];
    let dbWriteAttempted = Boolean(decision.action);
    let dbWriteSuccess = false;

    if (decision.action && validation.allowed) {
        const actionResult = await runV3Action({
            supabase: input.supabase,
            chatId: input.chatId,
            ctx,
            memory,
        });
        if (actionResult.success) {
            dbWriteSuccess = true;
            actions = [actionResult.actionName || decision.action.type];
            if (actionResult.reply) replyText = actionResult.reply;
        } else {
            actions = ['v3_action_failed'];
        }
    } else if (decision.action && !validation.allowed) {
        actions = ['v3_action_blocked'];
    }

    if (!dbWriteSuccess) {
        await saveV3Memory({
            supabase: input.supabase,
            userId: ctx.userId,
            workspaceId: ctx.workspaceId,
            chatId: input.chatId,
            workspaceType: ctx.workspaceType,
            memory,
        });
    }

    try {
        await input.supabase.from('activity_log').insert({
            user_id: input.userId,
            workspace_id: input.workspaceId,
            event_type: 'AI_REPLY',
            description: `V3 sent: "${replyText.slice(0, 80)}"`,
            metadata: {
                requestId,
                engine: 'v3',
                message: input.message,
                reply: replyText,
                intent: decision.intent,
                action: decision.action,
                validation,
                memory,
                platform: input.platform,
                chatId: input.chatId,
                durationMs: Date.now() - startTime,
            },
        });
    } catch {
        // non-critical
    }

    return {
        shouldReply: true,
        replyText,
        actions,
        stateBefore: 'idle',
        stateAfter: (memory.mode === 'ordering' ? 'awaiting_order_details' : memory.mode === 'booking' ? 'awaiting_customer_details' : 'idle') as any,
        debug: {
            requestId,
            engineVersion: 'v2',
            workspaceId: input.workspaceId,
            workspaceType: ctx.workspaceType,
            chatId: input.chatId,
            language: 'unknown',
            intent: decision.intent,
            dbWriteAttempted,
            dbWriteSuccess,
            durationMs: Date.now() - startTime,
        },
    };
}
