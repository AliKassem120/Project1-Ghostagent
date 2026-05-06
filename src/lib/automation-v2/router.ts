/**
 * GhostAgent — Router
 * Loads workspace config and routes to the correct brain path.
 */

import type { AutomationInput, AutomationResult, WorkspaceConfig } from './types';
import { v2log } from './logger';
import { handleGlobalInterrupt } from './global-interrupts';

export async function loadWorkspaceConfig(
    supabase: any,
    workspaceId: string,
    userId: string
): Promise<WorkspaceConfig | null> {
    const { data, error } = await supabase
        .from('ai_settings')
        .select(
            'id, user_id, business_name, business_type, tone, system_instructions, ' +
            'language, timezone, use_emojis, handoff_keywords, ' +
            'store_location, contact_info, shipping_rules, max_discount, min_order_for_discount, ' +
            'slot_duration_minutes'
        )
        .eq('id', workspaceId)
        .maybeSingle();

    if (error || !data) {
        v2log.error('ROUTER', 'Failed to load workspace config', { workspaceId, error });
        return null;
    }

    return {
        workspaceId: data.id,
        userId: data.user_id,
        businessName: data.business_name || 'our business',
        businessType: data.business_type || 'ecommerce',
        tone: data.tone || 'Professional',
        language: data.language || 'Auto-Detect',
        timezone: data.timezone || 'UTC',
        useEmojis: data.use_emojis ?? true,
        systemInstructions: data.system_instructions || null,
        storeLocation: data.store_location || null,
        contactInfo: data.contact_info || null,
        handoffKeywords: data.handoff_keywords || [],
        shippingRules: data.shipping_rules || null,
        maxDiscount: data.max_discount || null,
        minOrderForDiscount: data.min_order_for_discount || null,
        slotDurationMinutes: data.slot_duration_minutes || 60,
    };
}

export async function routeToAgent(input: AutomationInput): Promise<AutomationResult> {
    const startTime = Date.now();

    const config = await loadWorkspaceConfig(input.supabase, input.workspaceId, input.userId);
    if (!config) {
        return {
            shouldReply: false,
            actions: ['config_load_failed'],
            stateBefore: 'idle',
            stateAfter: 'idle',
            debug: {
                requestId: crypto.randomUUID(),
                engineVersion: 'v2',
                workspaceId: input.workspaceId,
                workspaceType: input.workspaceType,
                chatId: input.chatId,
                language: 'unknown',
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                durationMs: Date.now() - startTime,
            },
            error: 'Failed to load workspace configuration',
        };
    }

    const messageLower = input.message.toLowerCase();
    if (config.handoffKeywords.some((kw: string) => messageLower.includes(kw.toLowerCase()))) {
        v2log.info('ROUTER', 'Handoff keyword detected', { workspaceId: input.workspaceId });
        return {
            shouldReply: false,
            actions: ['handoff_keyword_detected'],
            stateBefore: 'idle',
            stateAfter: 'handoff',
            debug: {
                requestId: crypto.randomUUID(),
                engineVersion: 'v2',
                workspaceId: input.workspaceId,
                workspaceType: input.workspaceType,
                chatId: input.chatId,
                language: 'unknown',
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                durationMs: Date.now() - startTime,
            },
        };
    }

    // Critical: global interrupts win before any active FSM state.
    const interrupt = await handleGlobalInterrupt(input, config);
    if (interrupt) {
        interrupt.debug.durationMs = Date.now() - startTime;
        v2log.info('ROUTER', 'Global interrupt handled message', {
            workspaceId: input.workspaceId,
            chatId: input.chatId,
            actions: interrupt.actions,
        });
        return interrupt;
    }

    const { runAgent } = await import('./agent');
    return await runAgent(input, config);
}
