/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — V7 Router: Professional Brain Dispatch
 * ═══════════════════════════════════════════════════════════════
 *
 * The router keeps strict state for real actions, but idle/browsing
 * conversations now go through a professional LLM-led brain.
 *
 * Principle:
 * - If user is mid checkout/booking, use deterministic state machine.
 * - If user is browsing or asking questions, let the professional brain
 *   answer naturally using pre-fetched facts.
 */

import type { AutomationInput, AutomationResult, WorkspaceConfig } from './types';
import { classifyIntent, type ClassificationResult } from './classifier';
import { getConversationStateV2 } from './state';
import {
    handleComplaint,
    handleHoursInquiry,
    handleCancelRequest,
    handleOrderIntent,
    handleBookingIntent,
} from './agent';
import {
    handleProfessionalProductInquiry,
    handleProfessionalServiceInquiry,
    handleProfessionalGeneralChat,
    isClearEcommerceCheckoutIntent,
    isClearBookingCheckoutIntent,
    clearStateIfUserBrowsesInstead,
} from './professional-agent';
import { detectLanguage } from './language';
import { v2log } from './logger';

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
        v2log.error('V7_ROUTER', 'Failed to load workspace config', { workspaceId, error });
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

const BOOKING_STAGES = new Set([
    'awaiting_service', 'awaiting_date_time',
    'awaiting_customer_details', 'awaiting_booking_confirmation',
]);

const ORDER_STAGES = new Set([
    'awaiting_product', 'awaiting_variant',
    'awaiting_order_details', 'awaiting_checkout_confirmation',
]);

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

    const language = detectLanguage(input.message);

    await clearStateIfUserBrowsesInstead(input, config, input.message);

    const state = await getConversationStateV2(
        input.supabase, input.userId, input.workspaceId,
        input.chatId, config.businessType,
        input.platform
    );

    if (state.stage !== 'idle') {
        v2log.info('V7_ROUTER', `State override: ${state.stage} -> active worker`, {
            workspaceId: input.workspaceId,
            chatId: input.chatId,
        });

        try {
            if (BOOKING_STAGES.has(state.stage)) return await handleBookingIntent(input, config, language);
            if (ORDER_STAGES.has(state.stage)) return await handleOrderIntent(input, config, language);
            return await handleProfessionalGeneralChat(input, config, language);
        } catch (err: any) {
            v2log.error('V7_ROUTER', 'State-routed worker failed', { error: err?.message });
        }
    }

    const classification: ClassificationResult = classifyIntent(
        input.message,
        config.businessType,
        config.handoffKeywords
    );

    v2log.info('V7_ROUTER', `Intent: ${classification.intent}`, {
        workspaceId: input.workspaceId,
        chatId: input.chatId,
        language: classification.language,
    });

    try {
        if (classification.intent === 'complaint' || classification.intent === 'handoff_request') {
            return await handleComplaint(input, config, classification.language);
        }
        if (classification.intent === 'hours_inquiry') {
            return await handleHoursInquiry(input, config, classification.language);
        }
        if (classification.intent === 'cancel_request') {
            return await handleCancelRequest(input, config, classification.language);
        }

        if (config.businessType === 'ecommerce') {
            if (classification.intent === 'order_intent' && isClearEcommerceCheckoutIntent(input.message)) {
                return await handleOrderIntent(input, config, classification.language);
            }
            return await handleProfessionalProductInquiry(input, config, classification.language);
        }

        if (config.businessType === 'appointments') {
            if (classification.intent === 'booking_intent' && isClearBookingCheckoutIntent(input.message)) {
                return await handleBookingIntent(input, config, classification.language);
            }
            return await handleProfessionalServiceInquiry(input, config, classification.language);
        }

        return await handleProfessionalGeneralChat(input, config, classification.language);
    } catch (err: any) {
        v2log.error('V7_ROUTER', 'Professional worker failed', {
            intent: classification.intent,
            error: err?.message || String(err),
        });

        return {
            shouldReply: true,
            replyText: "I'm having trouble checking that right now.",
            actions: ['worker_error'],
            stateBefore: 'idle',
            stateAfter: 'idle',
            debug: {
                requestId: crypto.randomUUID(),
                engineVersion: 'v2',
                workspaceId: input.workspaceId,
                workspaceType: config.businessType,
                chatId: input.chatId,
                language: classification.language,
                intent: classification.intent,
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                durationMs: Date.now() - startTime,
            },
            error: err?.message || 'Worker failed',
        };
    }
}
