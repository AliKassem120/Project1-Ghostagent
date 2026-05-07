/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Decision Engine
 * ═══════════════════════════════════════════════════════════════
 * Central orchestrator. For every incoming message:
 *
 *   1. Load conversation state (+ postContext)
 *   2. If active state → run FSM (state before classifier)
 *   3. If idle + postContext → check post-context classifier
 *   4. If idle + no context → classify intent → create new state
 *   5. Save state (+ postContext if returned by FSM)
 *   6. Return decision
 *
 * The LLM is ONLY used for general conversation (idle, no clear intent).
 * State transitions, tool calls, and confirmations are deterministic.
 */

import type { AutomationInput, WorkspaceConfig } from './types';
import type { ConversationStage, AppointmentStateData, EcommerceStateData, FSMResult, PostActionContext } from './state/types';
import { loadConversationState, saveConversationState, clearConversationState } from './state/store';
import { processAppointmentState } from './state/appointments-fsm';
import { processEcommerceState } from './state/ecommerce-fsm';
import { classifyIntent } from './classify/intent-classifier';
import { classifyPostContext } from './classify/post-context-classifier';
import { lookupLatestOrder, cancelLatestOrder, updateOrderVariant, updateOrderAddress } from './ecommerce/lookup';
import { searchProducts, findBestProductMatch } from './ecommerce/products';
import { extractAvailabilityCandidate } from './ecommerce/extract-product';
import { lookupLatestAppointment, lookupLatestAppointmentAnyStatus, cancelLatestAppointment, rescheduleAppointment } from './appointments/lookup';
import { loadActiveServices, findBestServiceMatch } from './appointments/services';
import { loadBusinessHours, getHoursForDay } from './appointments/hours';
import { formatTime12 } from './time';
import { detectLanguage, detectYesNo } from './language';
import { v2log } from './logger';
import { safeErrorReply } from './validation/final-reply-guard';

export interface DecisionResult {
    /** If true, the FSM or post-context handler handled this message deterministically */
    handledByFSM: boolean;
    /** If handledByFSM, this is the FSM result */
    fsmResult?: FSMResult;
    /** The intent classification (only set when idle) */
    classifiedIntent?: string;
    /** The detected language */
    language: string;
    /** The conversation stage before processing */
    stateBefore: ConversationStage;
    /** The conversation stage after processing */
    stateAfter: ConversationStage;
}

function t(en: string, arabizi: string, lang: string): string {
    // 'lebanese franco' from settings = Arabizi. 'arabic' also uses Arabizi replies
    // since we don't have formal Arabic translations.
    const isArabizi = lang === 'arabizi' || lang === 'lebanese franco' || lang === 'arabic' || lang === 'mixed';
    return isArabizi ? arabizi : en;
}

async function persistFsmResult(
    input: AutomationInput,
    fsmResult: FSMResult,
    existingPostContext: PostActionContext | null,
    lang: string
): Promise<FSMResult> {
    const newPostContext = fsmResult.postContext || existingPostContext;
    const writeResult = fsmResult.nextStage === 'idle'
        ? await clearConversationState(
            input.supabase,
            input.userId,
            input.workspaceId,
            input.chatId,
            input.workspaceType,
            newPostContext,
            input.platform
        )
        : await saveConversationState(
            input.supabase,
            input.userId,
            input.workspaceId,
            input.chatId,
            input.workspaceType,
            fsmResult.nextStage,
            fsmResult.nextData,
            input.platform
        );

    if (writeResult.success) return fsmResult;

    v2log.error('DECISION', 'State persistence failed', {
        workspaceId: input.workspaceId,
        chatId: input.chatId,
        nextStage: fsmResult.nextStage,
        error: writeResult.error,
    });

    if (fsmResult.dbWriteSuccess) {
        if (fsmResult.nextStage === 'idle' && newPostContext) {
            const clearOnly = await clearConversationState(
                input.supabase,
                input.userId,
                input.workspaceId,
                input.chatId,
                input.workspaceType,
                null,
                input.platform
            );
            if (!clearOnly.success) {
                v2log.error('DECISION', 'Failed to clear state after DB success', {
                    workspaceId: input.workspaceId,
                    chatId: input.chatId,
                    error: clearOnly.error,
                });
            }
        }
        return {
            ...fsmResult,
            actions: [...fsmResult.actions, 'post_context_save_failed'],
        };
    }

    return {
        replyText: safeErrorReply(lang),
        nextStage: 'idle',
        nextData: null,
        actions: [...fsmResult.actions, 'state_save_failed'],
        dbWriteAttempted: fsmResult.dbWriteAttempted,
        dbWriteSuccess: false,
        shouldReply: true,
    };
}

function isGlobalInterrupt(intent: string | undefined): boolean {
    return !!intent && [
        'cancel_order',
        'cancel_appointment',
        'cancel_status',
        'human_handoff',
        'frustration_stop',
        'modify_order',
        'modify_appointment',
        'reschedule_appointment',
    ].includes(intent);
}

function cancelOrderReply(result: Awaited<ReturnType<typeof cancelLatestOrder>>, lang: string): FSMResult {
    if (result.success) {
        return {
            replyText: t('Order cancelled.', 'Tamem, el order tenla8a.', lang),
            nextStage: 'idle',
            nextData: null,
            actions: ['order_cancelled'],
            dbWriteAttempted: true,
            dbWriteSuccess: true,
            shouldReply: true,
        };
    }

    if (result.reason === 'already_cancelled') {
        return {
            replyText: t('Order is already cancelled.', 'El order already tenla8a.', lang),
            nextStage: 'idle',
            nextData: null,
            actions: ['order_already_cancelled'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    if (result.reason === 'not_pending_status') {
        return {
            replyText: t(`I can't cancel it because status is ${result.status}.`, `Ma fiyye el8e, status: ${result.status}.`, lang),
            nextStage: 'idle',
            nextData: null,
            actions: ['order_not_cancellable'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    if (result.reason === 'db_error') {
        return {
            replyText: safeErrorReply(lang),
            nextStage: 'idle',
            nextData: null,
            actions: ['order_cancel_failed'],
            dbWriteAttempted: true,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    return {
        replyText: t("I can't find a recent order.", 'Ma l2et order 2arib.', lang),
        nextStage: 'idle',
        nextData: null,
        actions: ['cancel_no_order'],
        dbWriteAttempted: false,
        dbWriteSuccess: false,
        shouldReply: true,
    };
}

function cancelAppointmentReply(result: Awaited<ReturnType<typeof cancelLatestAppointment>>, lang: string): FSMResult {
    if (result.success) {
        return {
            replyText: t('Appointment cancelled.', 'Tamem, el maw3ed tenla8a.', lang),
            nextStage: 'idle',
            nextData: null,
            actions: ['appointment_cancelled'],
            dbWriteAttempted: true,
            dbWriteSuccess: true,
            shouldReply: true,
        };
    }

    if (result.reason === 'already_cancelled') {
        return {
            replyText: t('Appointment is already cancelled.', 'El maw3ed already tenla8a.', lang),
            nextStage: 'idle',
            nextData: null,
            actions: ['appointment_already_cancelled'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    if (result.reason === 'not_cancellable_status') {
        return {
            replyText: t(`I can't cancel it because status is ${result.status}.`, `Ma fiyye el8e, status: ${result.status}.`, lang),
            nextStage: 'idle',
            nextData: null,
            actions: ['appointment_not_cancellable'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    if (result.reason === 'db_error') {
        return {
            replyText: safeErrorReply(lang),
            nextStage: 'idle',
            nextData: null,
            actions: ['appointment_cancel_failed'],
            dbWriteAttempted: true,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    return {
        replyText: t("I can't find a recent appointment.", 'Ma l2et maw3ed 2arib.', lang),
        nextStage: 'idle',
        nextData: null,
        actions: ['cancel_no_appointment'],
        dbWriteAttempted: false,
        dbWriteSuccess: false,
        shouldReply: true,
    };
}

async function handleGlobalInterrupt(
    input: AutomationInput,
    lang: string,
    currentStage: ConversationStage,
    intent: string
): Promise<FSMResult | null> {
    if (intent === 'human_handoff') {
        return {
            replyText: '',
            nextStage: 'handoff',
            nextData: null,
            actions: ['handoff'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: false,
        };
    }

    if (intent === 'frustration_stop') {
        return {
            replyText: t(
                "Sorry about that. I won't bother you. If you need anything, just message us.",
                'Be3tezer. Ma b3ajzak. Eza bdk shi, rase.',
                lang
            ),
            nextStage: 'idle',
            nextData: null,
            actions: ['frustration_stop'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    if (intent === 'cancel_status') {
        return null;
    }

    if ((intent === 'cancel_order' || intent === 'cancel_appointment') && input.workspaceType === 'ecommerce') {
        const result = await cancelLatestOrder(input.supabase, input.workspaceId, input.chatId);
        if (!result.success && result.reason === 'no_order' && currentStage !== 'idle' && currentStage !== 'handoff') {
            return {
                replyText: t('No problem. Let me know if you need anything.', 'Wala yhemak. Khaberne eza bdk shi.', lang),
                nextStage: 'idle',
                nextData: null,
                actions: ['cancelled_flow'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }
        return cancelOrderReply(result, lang);
    }

    if ((intent === 'cancel_appointment' || intent === 'cancel_order') && input.workspaceType === 'appointments') {
        const result = await cancelLatestAppointment(input.supabase, input.workspaceId, input.chatId);
        if (!result.success && result.reason === 'no_appointment' && currentStage !== 'idle' && currentStage !== 'handoff') {
            return {
                replyText: t('No problem. Let me know if you need anything.', 'Wala yhemak. Khaberne eza bdk shi.', lang),
                nextStage: 'idle',
                nextData: null,
                actions: ['cancelled_flow'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }
        return cancelAppointmentReply(result, lang);
    }

    return null;
}

/**
 * Run the decision engine for an incoming message.
 */
export async function runDecisionEngine(
    input: AutomationInput,
    config: WorkspaceConfig
): Promise<DecisionResult> {
    const detected = detectLanguage(input.message);
    let replyLang = config.language === 'Auto-Detect' ? detected : config.language.toLowerCase();
    // Normalize 'Lebanese Franco' setting → 'arabizi' for consistent t() handling
    if (replyLang === 'lebanese franco') replyLang = 'arabizi';

    // 1. Load current conversation state
    const { stage: currentStage, data: currentData, postContext } = await loadConversationState(
        input.supabase,
        input.userId,
        input.workspaceId,
        input.chatId,
        input.workspaceType
    );

    v2log.info('DECISION', `State loaded: ${currentStage}`, {
        chatId: input.chatId,
        stage: currentStage,
        hasData: !!currentData,
        hasPostContext: !!postContext,
    });

    // 2. GLOBAL INTERRUPTS - cancel/update/handoff before active FSM continuation.
    const classification = classifyIntent(input.message);
    if (isGlobalInterrupt(classification.intent)) {
        const interruptResult = await handleGlobalInterrupt(input, replyLang, currentStage, classification.intent);
        if (interruptResult) {
            const fsmResult = await persistFsmResult(input, interruptResult, postContext, replyLang);
            return {
                handledByFSM: true,
                fsmResult,
                classifiedIntent: classification.intent,
                language: replyLang,
                stateBefore: currentStage,
                stateAfter: fsmResult.nextStage,
            };
        }
    }

    // 3. STATE BEFORE CLASSIFIER - if active state, run FSM
    if (currentStage !== 'idle' && currentStage !== 'handoff' && currentData) {
        const fsmCtx = {
            supabase: input.supabase,
            userId: input.userId,
            workspaceId: input.workspaceId,
            chatId: input.chatId,
            config,
            message: input.message,
            language: replyLang,
            platform: input.platform,
        };

        let fsmResult: FSMResult;

        if (input.workspaceType === 'appointments') {
            fsmResult = await processAppointmentState(fsmCtx, currentData as AppointmentStateData);
        } else if (input.workspaceType === 'ecommerce') {
            fsmResult = await processEcommerceState(fsmCtx, currentData as EcommerceStateData);
        } else {
            // saas_support has no active FSM states by default
            fsmResult = {
                replyText: '',
                nextStage: 'idle',
                nextData: null,
                actions: ['saas_fsm_skipped'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: false,
            };
        }

        // Save the new state before asking follow-up questions.
        fsmResult = await persistFsmResult(input, fsmResult, postContext, replyLang);

        return {
            handledByFSM: true,
            fsmResult,
            language: replyLang,
            stateBefore: currentStage,
            stateAfter: fsmResult.nextStage,
        };
    }

    // 3. IDLE + POST-CONTEXT — check if message refers to recent action
    if (postContext) {
        const pcResult = classifyPostContext(input.message);

        if (pcResult.intent !== 'unrelated') {
            v2log.info('DECISION', `Post-context matched: ${pcResult.intent}`, {
                chatId: input.chatId,
                postContextType: postContext.type,
            });

            const handled = await handlePostContextIntent(
                input, config, replyLang, postContext, pcResult.intent, pcResult.extractedValue
            );

            if (handled) {
                return {
                    handledByFSM: true,
                    fsmResult: handled,
                    classifiedIntent: pcResult.intent,
                    language: replyLang,
                    stateBefore: 'idle',
                    stateAfter: handled.nextStage,
                };
            }
        }
    }

    // 5. IDLE - use the classification already computed for global interrupts
    v2log.info('DECISION', `Classified: ${classification.intent} (${classification.confidence})`, {
        chatId: input.chatId,
        source: classification.source,
    });

    // 5. DETERMINISTIC HANDLERS — no LLM needed ────────────────

    // ── Greeting (zero-cost, instant) ────────────────────────
    if (classification.intent === 'greeting') {
        return {
            handledByFSM: true,
            fsmResult: {
                replyText: t('Hey! How can I help?', 'Hala! Kif fiyi se3dak?', replyLang),
                nextStage: 'idle',
                nextData: null,
                actions: ['greeting'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            },
            classifiedIntent: 'greeting',
            language: replyLang,
            stateBefore: 'idle',
            stateAfter: 'idle',
        };
    }

    // ── Frustration / Stop — polite disengage ────────────────
    if (classification.intent === 'frustration_stop') {
        return {
            handledByFSM: true,
            fsmResult: {
                replyText: t(
                    'Sorry about that. I won\'t bother you. If you need anything, just message us.',
                    'Be3tezer. Ma b3ajzak. Eza bdk shi, rase.',
                    replyLang
                ),
                nextStage: 'idle',
                nextData: null,
                actions: ['frustration_stop'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            },
            classifiedIntent: 'frustration_stop',
            language: replyLang,
            stateBefore: 'idle',
            stateAfter: 'idle',
        };
    }

    // ── Booking / Purchase FSM entry points ──────────────────
    if (classification.intent === 'booking_intent' && input.workspaceType === 'appointments') {
        const initialState: AppointmentStateData = {
            stage: 'awaiting_service',
            pendingAction: 'create_appointment',
            appointment: {},
            customer: postContext?.customer ? {
                name: postContext.customer.name,
                phone: postContext.customer.phone,
            } : {},
            missingFields: ['service'],
        };

        const fsmCtx = {
            supabase: input.supabase,
            userId: input.userId,
            workspaceId: input.workspaceId,
            chatId: input.chatId,
            config,
            message: input.message,
            language: replyLang,
            platform: input.platform,
        };

        const rawFsmResult = await processAppointmentState(fsmCtx, initialState);
        const fsmResult = await persistFsmResult(input, rawFsmResult, postContext, replyLang);

        return {
            handledByFSM: true,
            fsmResult,
            classifiedIntent: classification.intent,
            language: replyLang,
            stateBefore: 'idle',
            stateAfter: fsmResult.nextStage,
        };
    }

    if (classification.intent === 'purchase_intent' && input.workspaceType === 'ecommerce') {
        // Detect reuse signals: "same name", "same number", "same address"
        const reuse = postContext?.customer
            ? (await import('./language')).detectReuseSignals(input.message)
            : { reuseName: false, reusePhone: false, reuseAddress: false };

        // Extract address from "change address to X" if present
        const newAddress = (await import('./language')).extractAddressFromChange(input.message);

        const initialState: EcommerceStateData = {
            stage: 'awaiting_product',
            pendingAction: 'create_order',
            order: { quantity: 1 },
            customer: postContext?.customer ? {
                name: reuse.reuseName ? postContext.customer.name : undefined,
                phone: reuse.reusePhone ? postContext.customer.phone : undefined,
                address: newAddress || (reuse.reuseAddress ? postContext.customer.address : undefined),
            } : {},
            missingFields: ['product'],
        };

        const fsmCtx = {
            supabase: input.supabase,
            userId: input.userId,
            workspaceId: input.workspaceId,
            chatId: input.chatId,
            config,
            message: input.message,
            language: replyLang,
            platform: input.platform,
        };

        const rawFsmResult = await processEcommerceState(fsmCtx, initialState);
        const fsmResult = await persistFsmResult(input, rawFsmResult, postContext, replyLang);

        return {
            handledByFSM: true,
            fsmResult,
            classifiedIntent: classification.intent,
            language: replyLang,
            stateBefore: 'idle',
            stateAfter: fsmResult.nextStage,
        };
    }

    // purchase_intent on APPOINTMENTS workspace → reroute to booking FSM
    // "I want a haircut" classified as purchase_intent but user is on a booking workspace
    if (classification.intent === 'purchase_intent' && input.workspaceType === 'appointments') {
        const initialState: AppointmentStateData = {
            stage: 'awaiting_service',
            pendingAction: 'create_appointment',
            appointment: {},
            customer: postContext?.customer ? {
                name: postContext.customer.name,
                phone: postContext.customer.phone,
            } : {},
            missingFields: ['service'],
        };

        const fsmCtx = {
            supabase: input.supabase,
            userId: input.userId,
            workspaceId: input.workspaceId,
            chatId: input.chatId,
            config,
            message: input.message,
            language: replyLang,
            platform: input.platform,
        };

        const rawFsmResult = await processAppointmentState(fsmCtx, initialState);
        const fsmResult = await persistFsmResult(input, rawFsmResult, postContext, replyLang);

        return {
            handledByFSM: true,
            fsmResult,
            classifiedIntent: 'booking_intent',
            language: replyLang,
            stateBefore: 'idle',
            stateAfter: fsmResult.nextStage,
        };
    }

    // Order status query — handle deterministically with lookup
    if (classification.intent === 'order_status' && input.workspaceType === 'ecommerce') {
        const order = await lookupLatestOrder(input.supabase, input.workspaceId, input.chatId);
        if (order) {
            return {
                handledByFSM: true,
                fsmResult: {
                    replyText: t(
                        `Your latest order: ${order.productName} — Status: ${order.status}`,
                        `A5er order-ak: ${order.productName} — Status: ${order.status}`,
                        replyLang
                    ),
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['order_status_lookup'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                },
                classifiedIntent: 'order_status',
                language: replyLang,
                stateBefore: 'idle',
                stateAfter: 'idle',
            };
        }
        // No order found — don't fall to LLM
        return {
            handledByFSM: true,
            fsmResult: {
                replyText: t('No recent orders found.', 'Ma fi orders abelye.', replyLang),
                nextStage: 'idle',
                nextData: null,
                actions: ['order_status_empty'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            },
            classifiedIntent: 'order_status',
            language: replyLang,
            stateBefore: 'idle',
            stateAfter: 'idle',
        };
    }

    // ── Cancel order — deterministic ─────────────────────────
    if (classification.intent === 'cancel_order' && input.workspaceType === 'ecommerce') {
        const result = await cancelLatestOrder(input.supabase, input.workspaceId, input.chatId);
        const fsmResult = cancelOrderReply(result, replyLang);
        return {
            handledByFSM: true,
            fsmResult,
            classifiedIntent: 'cancel_order',
            language: replyLang,
            stateBefore: 'idle',
            stateAfter: fsmResult.nextStage,
        };
    }

    // ── Cancel appointment — deterministic ───────────────────
    if (classification.intent === 'cancel_appointment' && input.workspaceType === 'appointments') {
        const result = await cancelLatestAppointment(input.supabase, input.workspaceId, input.chatId);
        const fsmResult = cancelAppointmentReply(result, replyLang);
        return {
            handledByFSM: true,
            fsmResult,
            classifiedIntent: 'cancel_appointment',
            language: replyLang,
            stateBefore: 'idle',
            stateAfter: fsmResult.nextStage,
        };
    }

    // ── Cancel status check ("did you cancel it?") ──────────
    if (classification.intent === 'cancel_status') {
        if (input.workspaceType === 'ecommerce') {
            const order = await lookupLatestOrder(input.supabase, input.workspaceId, input.chatId);
            if (order) {
                const isCancelled = order.status.toLowerCase() === 'cancelled';
                const isPending = order.status.toLowerCase() === 'pending';
                let replyText: string;
                if (isCancelled) {
                    replyText = t('Your order status is Cancelled.', 'Status el order: Cancelled.', replyLang);
                } else if (isPending) {
                    replyText = t('Not yet — it\'s still pending. Want me to cancel it?', 'La2 ba3do pending. Badak el8e?', replyLang);
                } else {
                    replyText = t(`Your order status is: ${order.status}`, `Status el order: ${order.status}`, replyLang);
                }
                return {
                    handledByFSM: true,
                    fsmResult: {
                        replyText,
                        nextStage: 'idle', nextData: null,
                        actions: ['cancel_status_order'],
                        dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true,
                    },
                    classifiedIntent: 'cancel_status', language: replyLang,
                    stateBefore: 'idle', stateAfter: 'idle',
                };
            }
            return {
                handledByFSM: true,
                fsmResult: {
                    replyText: t('I can\'t find a recent order.', 'Ma l2et order 2arib.', replyLang),
                    nextStage: 'idle', nextData: null,
                    actions: ['cancel_status_no_order'],
                    dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true,
                },
                classifiedIntent: 'cancel_status', language: replyLang,
                stateBefore: 'idle', stateAfter: 'idle',
            };
        }
        if (input.workspaceType === 'appointments') {
            const appt = await lookupLatestAppointmentAnyStatus(input.supabase, input.workspaceId, input.chatId);
            if (appt) {
                const isCancelled = appt.status.toLowerCase() === 'cancelled';
                let replyText: string;
                if (isCancelled) {
                    replyText = t('Your appointment status is Cancelled.', 'Status el maw3ed: Cancelled.', replyLang);
                } else {
                    replyText = t('Not yet — it\'s still active. Want me to cancel it?', 'La2 ba3do mawjoud. Badak el8e?', replyLang);
                }
                return {
                    handledByFSM: true,
                    fsmResult: {
                        replyText,
                        nextStage: 'idle', nextData: null,
                        actions: ['cancel_status_appointment'],
                        dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true,
                    },
                    classifiedIntent: 'cancel_status', language: replyLang,
                    stateBefore: 'idle', stateAfter: 'idle',
                };
            }
            return {
                handledByFSM: true,
                fsmResult: {
                    replyText: t('I can\'t find an upcoming appointment.', 'Ma l2et maw3ed 2arib.', replyLang),
                    nextStage: 'idle', nextData: null,
                    actions: ['cancel_status_no_appt'],
                    dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true,
                },
                classifiedIntent: 'cancel_status', language: replyLang,
                stateBefore: 'idle', stateAfter: 'idle',
            };
        }
    }

    // ── Business hours — deterministic DB lookup ─────────────
    if (classification.intent === 'business_hours') {
        const hours = await loadBusinessHours(input.supabase, input.workspaceId);
        if (hours.length > 0) {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const openDays = hours.filter(h => h.isOpen);
            const listing = openDays.map(h => `${dayNames[h.dayOfWeek]}: ${formatTime12(h.openTime)} – ${formatTime12(h.closeTime)}`).join('\n');
            return {
                handledByFSM: true,
                fsmResult: {
                    replyText: t(`Our hours:\n${listing}`, `Dawemna:\n${listing}`, replyLang),
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['business_hours_lookup'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                },
                classifiedIntent: 'business_hours',
                language: replyLang,
                stateBefore: 'idle',
                stateAfter: 'idle',
            };
        }
        // No hours configured — let LLM try with systemInstructions
    }

    // ── Location question — use config ───────────────────────
    if (classification.intent === 'location_question' && config.storeLocation) {
        return {
            handledByFSM: true,
            fsmResult: {
                replyText: t(`We're at: ${config.storeLocation}`, `Ma7alna: ${config.storeLocation}`, replyLang),
                nextStage: 'idle',
                nextData: null,
                actions: ['location_answered'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            },
            classifiedIntent: 'location_question',
            language: replyLang,
            stateBefore: 'idle',
            stateAfter: 'idle',
        };
    }

    // ── Shipping question — use config ───────────────────────
    if (classification.intent === 'shipping_question' && config.businessType === 'ecommerce' && config.shippingRules) {
        return {
            handledByFSM: true,
            fsmResult: {
                replyText: config.shippingRules,
                nextStage: 'idle',
                nextData: null,
                actions: ['shipping_answered'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            },
            classifiedIntent: 'shipping_question',
            language: replyLang,
            stateBefore: 'idle',
            stateAfter: 'idle',
        };
    }

    // Correction / Misunderstanding — apologize and ask clarification
    if (classification.intent === 'correction') {
        return {
            handledByFSM: true,
            fsmResult: {
                replyText: t('Sorry about that! What did you need?', 'Be3tezer! Shu bdk?', replyLang),
                nextStage: 'idle',
                nextData: null,
                actions: ['correction_acknowledged'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            },
            classifiedIntent: 'correction',
            language: replyLang,
            stateBefore: 'idle',
            stateAfter: 'idle',
        };
    }

    // Product availability / price / product question — extract candidate, search, match ────
    if ((classification.intent === 'product_availability' || classification.intent === 'price_question' || classification.intent === 'product_question') && input.workspaceType === 'ecommerce') {
        // 1. Extract the product candidate from the message
        const candidate = extractAvailabilityCandidate(input.message);
        const isSpecificQuery = candidate.length > 0;

        v2log.info('DECISION', `Product query: candidate="${candidate}", specific=${isSpecificQuery}`, {
            chatId: input.chatId,
            intent: classification.intent,
        });

        // 2. Fetch inventory (use candidate as search query if specific, otherwise fetch all)
        const products = await searchProducts({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            query: isSpecificQuery ? candidate : undefined,
            limit: isSpecificQuery ? 10 : 6,
        });

        // 3. SPECIFIC PRODUCT QUERY — find best match
        if (isSpecificQuery) {
            // Try findBestProductMatch against fetched results
            let matched = findBestProductMatch(products, candidate);

            // If ilike search returned nothing but candidate exists, try full catalog match
            if (!matched && products.length === 0) {
                const allProducts = await searchProducts({
                    supabase: input.supabase,
                    workspaceId: input.workspaceId,
                    limit: 50,
                });
                matched = findBestProductMatch(allProducts, candidate);
            }

            if (matched) {
                const inStock = matched.stockLevel > 0;
                let replyText: string;
                let ctaType: 'purchase_offer' | 'price_answer' | 'availability_answer' | undefined;

                if (classification.intent === 'price_question') {
                    replyText = t(
                        `${matched.itemName} — $${matched.price}`,
                        `${matched.itemName} — $${matched.price}`,
                        replyLang
                    );
                    ctaType = 'price_answer';
                } else {
                    // availability
                    if (inStock) {
                        replyText = t(
                            `Yes, ${matched.itemName} is available — $${matched.price}. Want one?`,
                            `Eh, ${matched.itemName} mawjoud — $${matched.price}. Badak wa7ad?`,
                            replyLang
                        );
                        ctaType = 'purchase_offer';
                    } else {
                        replyText = t(
                            `${matched.itemName} is currently out of stock.`,
                            `${matched.itemName} msh mawjoud halla2.`,
                            replyLang
                        );
                    }
                }

                // Seed postContext so "yeah" after "Want one?" continues the flow
                const offerPostContext: PostActionContext | undefined = (inStock && ctaType) ? {
                    type: 'order',
                    productName: matched.itemName,
                    productId: matched.id,
                    unitPrice: matched.price,
                    quantity: 1,
                    customer: { name: '', phone: '' },
                    createdAt: new Date().toISOString(),
                    editableUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                    source: 'dm_cta',
                    ctaType,
                } : undefined;

                if (offerPostContext) {
                    const stateWrite = await clearConversationState(
                        input.supabase, input.userId, input.workspaceId, input.chatId,
                        input.workspaceType, offerPostContext
                    );
                    if (!stateWrite.success) {
                        return {
                            handledByFSM: true,
                            fsmResult: {
                                replyText: safeErrorReply(replyLang),
                                nextStage: 'idle',
                                nextData: null,
                                actions: ['product_search_specific', 'state_save_failed'],
                                dbWriteAttempted: false,
                                dbWriteSuccess: false,
                                shouldReply: true,
                            },
                            classifiedIntent: classification.intent,
                            language: replyLang,
                            stateBefore: 'idle',
                            stateAfter: 'idle',
                        };
                    }
                }

                return {
                    handledByFSM: true,
                    fsmResult: {
                        replyText,
                        nextStage: 'idle',
                        nextData: null,
                        actions: ['product_search_specific'],
                        dbWriteAttempted: false,
                        dbWriteSuccess: false,
                        shouldReply: true,
                        postContext: offerPostContext,
                    },
                    classifiedIntent: classification.intent,
                    language: replyLang,
                    stateBefore: 'idle',
                    stateAfter: 'idle',
                };
            }

            // Specific product asked but NOT found — do NOT dump full catalog
            // Check if there are close alternatives
            const allProducts = products.length > 0 ? products : await searchProducts({
                supabase: input.supabase,
                workspaceId: input.workspaceId,
                limit: 5,
            });
            const inStock = allProducts.filter(p => p.stockLevel > 0);

            const replyText = inStock.length > 0
                ? t(
                    `I couldn't find "${candidate}". We do have:\n${inStock.slice(0, 3).map(p => `• ${p.itemName} — $${p.price}`).join('\n')}`,
                    `Ma l2et "${candidate}". Bas 3anna:\n${inStock.slice(0, 3).map(p => `• ${p.itemName} — $${p.price}`).join('\n')}`,
                    replyLang
                )
                : t(
                    `That item is not available right now.`,
                    `Msh mawjoud halla2.`,
                    replyLang
                );

            return {
                handledByFSM: true,
                fsmResult: {
                    replyText,
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['product_search_not_found'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                },
                classifiedIntent: classification.intent,
                language: replyLang,
                stateBefore: 'idle',
                stateAfter: 'idle',
            };
        }

        // 4. GENERAL QUERY — "What do you have?" / "What are your prices?"
        if (products.length > 0) {
            const inStock = products.filter(p => p.stockLevel > 0);
            const listing = inStock.slice(0, 5).map(p => `• ${p.itemName} — $${p.price}`).join('\n');
            const hasMore = inStock.length > 5;
            const suffix = hasMore ? t('\nI can show more if you want.', '\nFi kamen iza badak.', replyLang) : '';

            const replyText = classification.intent === 'price_question'
                ? t(`Here are our prices:\n${listing}${suffix}`, `Tfaddal el as3ar:\n${listing}${suffix}`, replyLang)
                : t(`Here's what we have:\n${listing}${suffix}`, `3anna:\n${listing}${suffix}`, replyLang);

            return {
                handledByFSM: true,
                fsmResult: {
                    replyText,
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['product_search_catalog'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                },
                classifiedIntent: classification.intent,
                language: replyLang,
                stateBefore: 'idle',
                stateAfter: 'idle',
            };
        }

        // No products at all
        const replyText = classification.intent === 'price_question'
            ? t('Which product are you asking about?', 'Aya product bdk t3rif se3ro?', replyLang)
            : t('No products available right now.', 'Ma fi shi mawjoud halla2.', replyLang);

        return {
            handledByFSM: true,
            fsmResult: {
                replyText,
                nextStage: 'idle',
                nextData: null,
                actions: [classification.intent === 'price_question' ? 'price_question_clarify' : 'product_search_empty'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            },
            classifiedIntent: classification.intent,
            language: replyLang,
            stateBefore: 'idle',
            stateAfter: 'idle',
        };
    }

    // Service availability — list services for appointments workspaces
    if ((classification.intent === 'product_availability' || classification.intent === 'price_question' || classification.intent === 'service_question') && input.workspaceType === 'appointments') {
        const services = await loadActiveServices(input.supabase, input.workspaceId);

        if (services.length > 0) {
            // Extract service candidate from the message
            const candidate = extractAvailabilityCandidate(input.message);
            const isSpecificQuery = candidate.length > 0;

            // Try to match a specific service
            if (isSpecificQuery) {
                const matched = findBestServiceMatch(services, candidate);
                if (matched) {
                    const replyText = t(
                        `${matched.name} — $${matched.price} (${matched.durationMinutes}min). Want to book?`,
                        `${matched.name} — $${matched.price} (${matched.durationMinutes}d2i2a). Badak te7joz?`,
                        replyLang
                    );

                    // Seed postContext for booking CTA
                    const servicePostContext: PostActionContext = {
                        type: 'appointment',
                        serviceName: matched.name,
                        serviceId: matched.id,
                        servicePrice: matched.price,
                        serviceDuration: matched.durationMinutes,
                        customer: { name: '', phone: '' },
                        createdAt: new Date().toISOString(),
                        editableUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                        source: 'dm_cta',
                        ctaType: 'booking_offer',
                    };

                    const stateWrite = await clearConversationState(
                        input.supabase, input.userId, input.workspaceId, input.chatId,
                        input.workspaceType, servicePostContext
                    );
                    if (!stateWrite.success) {
                        return {
                            handledByFSM: true,
                            fsmResult: {
                                replyText: safeErrorReply(replyLang),
                                nextStage: 'idle',
                                nextData: null,
                                actions: ['service_search_specific', 'state_save_failed'],
                                dbWriteAttempted: false,
                                dbWriteSuccess: false,
                                shouldReply: true,
                            },
                            classifiedIntent: classification.intent,
                            language: replyLang,
                            stateBefore: 'idle',
                            stateAfter: 'idle',
                        };
                    }

                    return {
                        handledByFSM: true,
                        fsmResult: {
                            replyText,
                            nextStage: 'idle',
                            nextData: null,
                            actions: ['service_search_specific'],
                            dbWriteAttempted: false,
                            dbWriteSuccess: false,
                            shouldReply: true,
                            postContext: servicePostContext,
                        },
                        classifiedIntent: classification.intent,
                        language: replyLang,
                        stateBefore: 'idle',
                        stateAfter: 'idle',
                    };
                }
            }

            // General service listing
            const listing = services.slice(0, 6).map(s => `• ${s.name} — $${s.price} (${s.durationMinutes}min)`).join('\n');
            const replyText = classification.intent === 'price_question'
                ? (services.length === 1
                    ? t(`${services[0].name} — $${services[0].price}`, `${services[0].name} — $${services[0].price}`, replyLang)
                    : t(`Here are our prices:\n${listing}`, `Tfaddal el as3ar:\n${listing}`, replyLang))
                : t(`Here are our services:\n${listing}`, `3anna:\n${listing}`, replyLang);

            return {
                handledByFSM: true,
                fsmResult: {
                    replyText,
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['service_search'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                },
                classifiedIntent: classification.intent,
                language: replyLang,
                stateBefore: 'idle',
                stateAfter: 'idle',
            };
        }
        return {
            handledByFSM: true,
            fsmResult: {
                replyText: t('No services available right now.', 'Ma fi khedamet halla2.', replyLang),
                nextStage: 'idle',
                nextData: null,
                actions: ['service_search_empty'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            },
            classifiedIntent: classification.intent,
            language: replyLang,
            stateBefore: 'idle',
            stateAfter: 'idle',
        };
    }

    // 6. Everything else (greetings, FAQs, price questions, etc.)
    // → Let the LLM agent handle it with tools
    return {
        handledByFSM: false,
        classifiedIntent: classification.intent,
        language: replyLang,
        stateBefore: 'idle',
        stateAfter: 'idle',
    };
}


// ── Post-Context Intent Handlers ─────────────────────────────

async function handlePostContextIntent(
    input: AutomationInput,
    config: WorkspaceConfig,
    lang: string,
    pc: PostActionContext,
    intent: string,
    extractedValue?: string
): Promise<FSMResult | null> {
    const isEditable = new Date(pc.editableUntil).getTime() > Date.now();

    switch (intent) {
        case 'cancel_latest': {
            if (pc.type === 'order') {
                const result = await cancelLatestOrder(input.supabase, input.workspaceId, input.chatId);
                const reply = cancelOrderReply(result, lang);
                return { ...reply, actions: ['post_context_cancel_order', ...reply.actions] };
            }
            if (pc.type === 'appointment') {
                const result = await cancelLatestAppointment(input.supabase, input.workspaceId, input.chatId);
                const reply = cancelAppointmentReply(result, lang);
                return { ...reply, actions: ['post_context_cancel_appointment', ...reply.actions] };
            }
            return null;
        }

        case 'order_status': {
            if (pc.type === 'order' && pc.lastOrderId) {
                const order = await lookupLatestOrder(input.supabase, input.workspaceId, input.chatId);
                if (order) {
                    return {
                        replyText: t(
                            `Your order (${order.productName}): ${order.status}`,
                            `Order-ak (${order.productName}): ${order.status}`,
                            lang
                        ),
                        nextStage: 'idle',
                        nextData: null,
                        actions: ['post_context_order_status'],
                        dbWriteAttempted: false,
                        dbWriteSuccess: false,
                        shouldReply: true,
                    };
                }
            }
            return null;
        }

        case 'modify_order': {
            if (pc.type !== 'order' || !pc.lastOrderId) return null;
            if (!isEditable) {
                return {
                    replyText: t(
                        'This order can no longer be modified. Contact us for help.',
                        'Hal order ma fi n3adlo halla2. Tewasal ma3na la nse3dak.',
                        lang
                    ),
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['post_context_modify_expired'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                };
            }
            if (extractedValue) {
                // Try to update variant/size
                const success = await updateOrderVariant(input.supabase, pc.lastOrderId, extractedValue);
                if (success) {
                    return {
                        replyText: t(`Updated to "${extractedValue}" ✅`, `T8ayaret la "${extractedValue}" ✅`, lang),
                        nextStage: 'idle',
                        nextData: null,
                        actions: ['post_context_modify_success'],
                        dbWriteAttempted: true,
                        dbWriteSuccess: true,
                        shouldReply: true,
                    };
                }
            }
            return {
                replyText: t('What would you like to change it to?', 'La shu badek t8ayra?', lang),
                nextStage: 'idle',
                nextData: null,
                actions: ['post_context_modify_ask'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }

        case 'reuse_details': {
            // This is handled in the FSM by pre-populating customer from postContext
            // Just acknowledge and let the flow continue
            return null;
        }

        case 'reschedule': {
            if (pc.type !== 'appointment' || !pc.lastAppointmentId) return null;
            if (!isEditable) {
                return {
                    replyText: t(
                        'Too late to reschedule. Contact us for help.',
                        'Faat el wa2et la n8ayer el maw3ed. Tewasal ma3na.',
                        lang
                    ),
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['post_context_reschedule_expired'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                };
            }
            return {
                replyText: t('What day and time would you like instead?', 'Aya yom w se3a badek?', lang),
                nextStage: 'idle',
                nextData: null,
                actions: ['post_context_reschedule_ask'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }

        case 'accept_offer': {
            // User said "yeah/ok/sure" after a CTA like "Want one?" or "Want to book?"
            if (!pc.ctaType) return null;

            if (pc.ctaType === 'purchase_offer' && pc.type === 'order' && pc.productName) {
                // Enter ecommerce FSM with product pre-filled
                const initialState: EcommerceStateData = {
                    stage: 'awaiting_order_details',
                    pendingAction: 'create_order',
                    order: {
                        productId: pc.productId,
                        productName: pc.productName,
                        unitPrice: pc.unitPrice,
                        quantity: pc.quantity || 1,
                        variantLabel: pc.variantLabel,
                    },
                    customer: pc.customer?.name ? {
                        name: pc.customer.name,
                        phone: pc.customer.phone,
                        address: pc.customer.address,
                    } : {},
                    missingFields: ['customerName', 'customerPhone', 'deliveryAddress'],
                    source: pc.source,
                };

                // Save FSM state so next message goes through ecommerce FSM
                const stateWrite = await saveConversationState(
                    input.supabase, input.userId, input.workspaceId, input.chatId,
                    input.workspaceType as 'ecommerce', 'awaiting_order_details', initialState, input.platform
                );
                if (!stateWrite.success) {
                    return {
                        replyText: safeErrorReply(lang),
                        nextStage: 'idle',
                        nextData: null,
                        actions: ['accept_offer_ecommerce', 'state_save_failed'],
                        dbWriteAttempted: false,
                        dbWriteSuccess: false,
                        shouldReply: true,
                    };
                }

                return {
                    replyText: t(
                        'Send your name, phone number, and delivery address.',
                        'B3atle ismak, ra2mak w el 3nwen.',
                        lang
                    ),
                    nextStage: 'awaiting_order_details',
                    nextData: initialState,
                    actions: ['accept_offer_ecommerce'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                };
            }

            if (pc.ctaType === 'booking_offer' && pc.type === 'appointment' && pc.serviceName) {
                // Enter appointment FSM with service pre-filled
                const initialState: AppointmentStateData = {
                    stage: 'awaiting_date_time',
                    pendingAction: 'create_appointment',
                    appointment: {
                        serviceId: pc.serviceId,
                        serviceName: pc.serviceName,
                        servicePrice: pc.servicePrice,
                        serviceDuration: pc.serviceDuration,
                    },
                    customer: pc.customer?.name ? {
                        name: pc.customer.name,
                        phone: pc.customer.phone,
                    } : {},
                    missingFields: ['date', 'time'],
                    source: pc.source,
                };

                // Save FSM state so next message goes through appointments FSM
                const stateWrite = await saveConversationState(
                    input.supabase, input.userId, input.workspaceId, input.chatId,
                    input.workspaceType as 'appointments', 'awaiting_date_time', initialState, input.platform
                );
                if (!stateWrite.success) {
                    return {
                        replyText: safeErrorReply(lang),
                        nextStage: 'idle',
                        nextData: null,
                        actions: ['accept_offer_appointment', 'state_save_failed'],
                        dbWriteAttempted: false,
                        dbWriteSuccess: false,
                        shouldReply: true,
                    };
                }

                return {
                    replyText: t(
                        'What day and time works for you?',
                        'Aya yom w se3a byna7sebak?',
                        lang
                    ),
                    nextStage: 'awaiting_date_time',
                    nextData: initialState,
                    actions: ['accept_offer_appointment'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                };
            }

            return null;
        }

        case 'reject_offer': {
            // User said "no/la/mish" after a CTA
            if (!pc.ctaType) return null;

            // Clear the CTA context
            const stateWrite = await clearConversationState(input.supabase, input.userId, input.workspaceId, input.chatId, input.workspaceType);
            if (!stateWrite.success) {
                return {
                    replyText: safeErrorReply(lang),
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['reject_offer', 'state_save_failed'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                };
            }

            return {
                replyText: t(
                    'No problem. Let me know if you need anything.',
                    'Wala yhemak. Khaberne eza bdk shi.',
                    lang
                ),
                nextStage: 'idle',
                nextData: null,
                actions: ['reject_offer'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }

        default:
            return null;
    }
}
