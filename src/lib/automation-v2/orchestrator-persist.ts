/**
 * GhostAgent — Orchestrator Persist Helper
 * Shared FSM result persistence logic for the V3 orchestrator.
 */

import type { AutomationInput } from './types';
import type { FSMResult, PostActionContext } from './state/types';
import { saveConversationState, clearConversationState } from './state/store';
import { safeErrorReply } from './validation/final-reply-guard';
import { v2log } from './logger';

export async function persistFsmResultV3(
    input: AutomationInput,
    fsmResult: FSMResult,
    existingPostContext: PostActionContext | null,
    lang: string
): Promise<FSMResult> {
    const newPostContext = fsmResult.postContext || existingPostContext;
    const nowISO = new Date().toISOString();

    const writeResult = fsmResult.nextStage === 'idle'
        ? await clearConversationState(
            input.supabase, input.userId, input.workspaceId,
            input.chatId, input.workspaceType, newPostContext, input.platform
        )
        : await saveConversationState(
            input.supabase, input.userId, input.workspaceId,
            input.chatId, input.workspaceType, fsmResult.nextStage,
            {
                ...(fsmResult.nextData || {}),
                loopCount: 0,
                lastBotMessage: fsmResult.replyText || null,
                stateEnteredAt: nowISO,
                postContext: newPostContext,
                lastInteractionAt: nowISO,
            } as any,
            input.platform
        );

    if (writeResult.success) return fsmResult;

    v2log.error('V3_PERSIST', 'State persistence failed', {
        workspaceId: input.workspaceId, chatId: input.chatId,
        nextStage: fsmResult.nextStage, error: writeResult.error,
    });

    if (fsmResult.dbWriteSuccess) {
        return { ...fsmResult, actions: [...fsmResult.actions, 'post_context_save_failed'] };
    }

    return {
        replyText: safeErrorReply(lang),
        nextStage: 'idle', nextData: null,
        actions: [...fsmResult.actions, 'state_save_failed'],
        dbWriteAttempted: fsmResult.dbWriteAttempted,
        dbWriteSuccess: false, shouldReply: true,
    };
}
