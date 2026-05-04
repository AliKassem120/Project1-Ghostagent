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
import { searchProducts } from './ecommerce/products';
import { lookupLatestAppointment, cancelLatestAppointment, rescheduleAppointment } from './appointments/lookup';
import { loadActiveServices } from './appointments/services';
import { loadBusinessHours, getHoursForDay } from './appointments/hours';
import { formatTime12 } from './time';
import { detectLanguage, detectYesNo } from './language';
import { v2log } from './logger';

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

    // 2. STATE BEFORE CLASSIFIER — if active state, run FSM
    if (currentStage !== 'idle' && currentStage !== 'handoff' && currentData) {
        const fsmCtx = {
            supabase: input.supabase,
            userId: input.userId,
            workspaceId: input.workspaceId,
            chatId: input.chatId,
            config,
            message: input.message,
            language: replyLang,
        };

        let fsmResult: FSMResult;

        if (input.workspaceType === 'appointments') {
            fsmResult = await processAppointmentState(fsmCtx, currentData as AppointmentStateData);
        } else {
            fsmResult = await processEcommerceState(fsmCtx, currentData as EcommerceStateData);
        }

        // Save the new state (preserving postContext if FSM returned one)
        const newPostContext = fsmResult.postContext || postContext;
        if (fsmResult.nextStage === 'idle' || !fsmResult.nextData) {
            await clearConversationState(input.supabase, input.userId, input.workspaceId, input.chatId, input.workspaceType, newPostContext);
        } else {
            await saveConversationState(
                input.supabase, input.userId, input.workspaceId, input.chatId,
                input.workspaceType, fsmResult.nextStage, fsmResult.nextData
            );
        }

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

    // 4. IDLE — classify intent
    const classification = classifyIntent(input.message);

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
        };

        const fsmResult = await processAppointmentState(fsmCtx, initialState);

        if (fsmResult.nextStage !== 'idle' && fsmResult.nextData) {
            await saveConversationState(
                input.supabase, input.userId, input.workspaceId, input.chatId,
                input.workspaceType, fsmResult.nextStage, fsmResult.nextData
            );
        }

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
        const initialState: EcommerceStateData = {
            stage: 'awaiting_product',
            pendingAction: 'create_order',
            order: { quantity: 1 },
            customer: postContext?.customer ? {
                name: postContext.customer.name,
                phone: postContext.customer.phone,
                address: postContext.customer.address,
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
        };

        const fsmResult = await processEcommerceState(fsmCtx, initialState);

        if (fsmResult.nextStage !== 'idle' && fsmResult.nextData) {
            await saveConversationState(
                input.supabase, input.userId, input.workspaceId, input.chatId,
                input.workspaceType, fsmResult.nextStage, fsmResult.nextData
            );
        }

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
        };

        const fsmResult = await processAppointmentState(fsmCtx, initialState);

        if (fsmResult.nextStage !== 'idle' && fsmResult.nextData) {
            await saveConversationState(
                input.supabase, input.userId, input.workspaceId, input.chatId,
                input.workspaceType, fsmResult.nextStage, fsmResult.nextData
            );
        }

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
        if (result.success) {
            return {
                handledByFSM: true,
                fsmResult: {
                    replyText: t(`${result.productName} order cancelled.`, `Order el ${result.productName} tenla8a.`, replyLang),
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['order_cancelled'],
                    dbWriteAttempted: true,
                    dbWriteSuccess: true,
                    shouldReply: true,
                },
                classifiedIntent: 'cancel_order',
                language: replyLang,
                stateBefore: 'idle',
                stateAfter: 'idle',
            };
        }
        return {
            handledByFSM: true,
            fsmResult: {
                replyText: t('No pending order to cancel.', 'Ma fi order la yenle8e.', replyLang),
                nextStage: 'idle',
                nextData: null,
                actions: ['cancel_no_order'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            },
            classifiedIntent: 'cancel_order',
            language: replyLang,
            stateBefore: 'idle',
            stateAfter: 'idle',
        };
    }

    // ── Cancel appointment — deterministic ───────────────────
    if (classification.intent === 'cancel_appointment' && input.workspaceType === 'appointments') {
        const result = await cancelLatestAppointment(input.supabase, input.workspaceId, input.chatId);
        if (result.success) {
            return {
                handledByFSM: true,
                fsmResult: {
                    replyText: t(`${result.serviceName} appointment cancelled.`, `Maw3ed el ${result.serviceName} tenla8a.`, replyLang),
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['appointment_cancelled'],
                    dbWriteAttempted: true,
                    dbWriteSuccess: true,
                    shouldReply: true,
                },
                classifiedIntent: 'cancel_appointment',
                language: replyLang,
                stateBefore: 'idle',
                stateAfter: 'idle',
            };
        }
        return {
            handledByFSM: true,
            fsmResult: {
                replyText: t('No upcoming appointment to cancel.', 'Ma fi maw3ed la yenle8e.', replyLang),
                nextStage: 'idle',
                nextData: null,
                actions: ['cancel_no_appointment'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            },
            classifiedIntent: 'cancel_appointment',
            language: replyLang,
            stateBefore: 'idle',
            stateAfter: 'idle',
        };
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
    if (classification.intent === 'shipping_question' && config.shippingRules) {
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

    // Product availability — proactively search inventory instead of relying on LLM
    if ((classification.intent === 'product_availability' || classification.intent === 'price_question') && input.workspaceType === 'ecommerce') {
        const products = await searchProducts({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            query: classification.intent === 'price_question'
                ? input.message.replace(/\b(how\s*much|price|cost|addesh|adde|se3r|se3ro|combien|cuanto|7a2o|shu\s*el)\b/gi, '').trim() || undefined
                : undefined,
            limit: 6,
        });

        if (products.length > 0) {
            const inStock = products.filter(p => p.stockLevel > 0);
            const listing = inStock.slice(0, 5).map(p => `• ${p.itemName} — $${p.price}`).join('\n');
            const replyText = classification.intent === 'price_question'
                ? (inStock.length > 0
                    ? (inStock.length === 1
                        ? t(`${inStock[0].itemName} — $${inStock[0].price}`, `${inStock[0].itemName} — $${inStock[0].price}`, replyLang)
                        : t(`Here you go:\n${listing}`, `Tfaddal:\n${listing}`, replyLang))
                    : t('That item is not available right now.', 'Msh mawjoud halla2.', replyLang))
                : t(`Here's what we have:\n${listing}`, `3anna:\n${listing}`, replyLang);

            return {
                handledByFSM: true,
                fsmResult: {
                    replyText,
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['product_search'],
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
        // No products found — ask clarification for price queries, inform for general
        if (classification.intent === 'price_question') {
            return {
                handledByFSM: true,
                fsmResult: {
                    replyText: t('Which product are you asking about?', 'Aya product bdk t3rif se3ro?', replyLang),
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['price_question_clarify'],
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
                replyText: t('No products available right now.', 'Ma fi shi mawjoud halla2.', replyLang),
                nextStage: 'idle',
                nextData: null,
                actions: ['product_search_empty'],
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
                if (result.success) {
                    // Clear postContext since the action is cancelled
                    await clearConversationState(input.supabase, input.userId, input.workspaceId, input.chatId, input.workspaceType);
                    return {
                        replyText: t(`${result.productName} order cancelled.`, `Order el ${result.productName} tenla8a.`, lang),
                        nextStage: 'idle',
                        nextData: null,
                        actions: ['post_context_cancel_order'],
                        dbWriteAttempted: true,
                        dbWriteSuccess: true,
                        shouldReply: true,
                    };
                }
                return {
                    replyText: t('No pending order to cancel.', 'Ma fi order la yenle8e.', lang),
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['post_context_cancel_no_order'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                };
            }
            if (pc.type === 'appointment') {
                const result = await cancelLatestAppointment(input.supabase, input.workspaceId, input.chatId);
                if (result.success) {
                    await clearConversationState(input.supabase, input.userId, input.workspaceId, input.chatId, input.workspaceType);
                    return {
                        replyText: t(`${result.serviceName} appointment cancelled.`, `Maw3ed el ${result.serviceName} tenla8a.`, lang),
                        nextStage: 'idle',
                        nextData: null,
                        actions: ['post_context_cancel_appointment'],
                        dbWriteAttempted: true,
                        dbWriteSuccess: true,
                        shouldReply: true,
                    };
                }
                return {
                    replyText: t('No upcoming appointment to cancel.', 'Ma fi maw3ed la yenle8e.', lang),
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['post_context_cancel_no_appt'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                };
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

        default:
            return null;
    }
}
