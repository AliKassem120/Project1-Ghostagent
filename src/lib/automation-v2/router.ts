/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Router
 * ═══════════════════════════════════════════════════════════════
 * Routes incoming messages to the correct V2 brain based on
 * workspace type. Loads workspace config from ai_settings.
 */

import type { AutomationInput, AutomationResult, WorkspaceConfig } from './types';
import { v2log } from './logger';

// ── Load workspace config from ai_settings ───────────────────

export async function loadWorkspaceConfig(
    supabase: any,
    workspaceId: string,
    userId: string
): Promise<WorkspaceConfig | null> {
    const { data, error } = await supabase
        .from('ai_settings')
        .select(
            'id, user_id, business_name, business_type, tone, system_instructions, ' +
            'language, timezone, use_emojis, use_local_slang, urgency_mode, handoff_keywords, ' +
            'store_location, contact_info, shipping_rules, max_discount, min_order_for_discount, ' +
            'slot_duration_minutes'
        )
        .eq('id', workspaceId)
        .maybeSingle();

    if (error || !data) {
        v2log.error('V2_ROUTER', 'Failed to load workspace config', { workspaceId, error });
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
        useLocalSlang: data.use_local_slang ?? false,
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

// ── Route to correct brain ───────────────────────────────────

export async function routeToV2Brain(input: AutomationInput): Promise<AutomationResult> {
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

    // Check handoff keywords first
    const messageLower = input.message.toLowerCase();
    if (config.handoffKeywords.some((kw: string) => messageLower.includes(kw.toLowerCase()))) {
        v2log.info('V2_ROUTER', 'Handoff keyword detected, suppressing reply', {
            workspaceId: input.workspaceId,
            chatId: input.chatId,
        });
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

    // Route to workspace-specific brain
    // These will be implemented in PR 3 (appointments) and PR 5 (ecommerce)
    if (config.businessType === 'appointments') {
        const { handleAppointmentMessage } = await import('./appointments/brain');
        return handleAppointmentMessage(input, config);
    } else {
        const { handleEcommerceMessage } = await import('./ecommerce/brain');
        return handleEcommerceMessage(input, config);
    }
}
