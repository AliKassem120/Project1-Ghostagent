/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — V4 Router: Classifier-First Dispatch
 * ═══════════════════════════════════════════════════════════════
 * 
 * This is the new brain. Instead of passing everything to one
 * giant LLM call, it:
 *
 *   1. Loads workspace config (same as before)
 *   2. Classifies intent using REGEX (zero tokens)
 *   3. Dispatches to the correct SPECIALIST WORKER
 *   4. Each worker has ONLY the tools it needs
 *
 * Result: No random tool calls, no hallucinations, minimal tokens.
 */

import type { AutomationInput, AutomationResult, WorkspaceConfig } from './types';
import { classifyIntent, type ClassificationResult } from './classifier';
import {
    handleGreeting,
    handleComplaint,
    handleHoursInquiry,
    handleCancelRequest,
    handleProductInquiry,
    handleOrderIntent,
    handleServiceInquiry,
    handleBookingIntent,
    handleGeneralChat,
} from './agent';
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
        v2log.error('V4_ROUTER', 'Failed to load workspace config', { workspaceId, error });
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

// ── Main Router ──────────────────────────────────────────────

export async function routeToV2Brain(input: AutomationInput): Promise<AutomationResult> {
    const startTime = Date.now();

    // 1. Load config
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

    // 2. Classify intent (REGEX — zero tokens)
    const classification: ClassificationResult = classifyIntent(
        input.message,
        config.businessType as 'appointments' | 'ecommerce',
        config.handoffKeywords
    );

    v2log.info('V4_ROUTER', `Intent: ${classification.intent} (${classification.confidence})`, {
        workspaceId: input.workspaceId,
        chatId: input.chatId,
        language: classification.language,
        subject: classification.subject,
    });

    // 3. Dispatch to specialist worker
    try {
        switch (classification.intent) {
            case 'greeting':
                return await handleGreeting(input, config, classification.language);

            case 'complaint':
            case 'handoff_request':
                return await handleComplaint(input, config, classification.language);

            case 'hours_inquiry':
                return await handleHoursInquiry(input, config, classification.language);

            case 'cancel_request':
                return await handleCancelRequest(input, config, classification.language);

            case 'product_inquiry':
                return await handleProductInquiry(input, config, classification.language);

            case 'order_intent':
                return await handleOrderIntent(input, config, classification.language);

            case 'service_inquiry':
                return await handleServiceInquiry(input, config, classification.language);

            case 'booking_intent':
                return await handleBookingIntent(input, config, classification.language);

            case 'general_chat':
            default:
                return await handleGeneralChat(input, config, classification.language);
        }
    } catch (err: any) {
        v2log.error('V4_ROUTER', 'Worker failed', {
            intent: classification.intent,
            error: err?.message || String(err),
        });

        // Fallback: try general chat
        try {
            return await handleGeneralChat(input, config, classification.language);
        } catch (fallbackErr: any) {
            v2log.error('V4_ROUTER', 'General chat fallback also failed', {
                error: fallbackErr?.message || String(fallbackErr),
            });

            return {
                shouldReply: true,
                replyText: "Not available at the moment.",
                actions: ['worker_error'],
                stateBefore: 'idle',
                stateAfter: 'idle',
                debug: {
                    requestId: '',
                    engineVersion: 'v2',
                    workspaceId: input.workspaceId,
                    workspaceType: config.businessType as 'appointments' | 'ecommerce',
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
}
