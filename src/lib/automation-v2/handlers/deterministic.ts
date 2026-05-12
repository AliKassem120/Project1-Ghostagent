/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Deterministic Handlers
 * ═══════════════════════════════════════════════════════════════
 * Zero-LLM instant responses for well-known intents:
 * greeting, business_hours, location, shipping, correction,
 * frustration, order_status, appointment_status, product queries.
 *
 * Extracted from decision-engine.ts lines 627-1500.
 */

import type { AutomationInput, WorkspaceConfig } from '../types';
import type { FSMResult, PostActionContext } from '../state/types';
import { getTemplate } from '../templates';
import { lookupLatestOrder } from '../ecommerce/lookup';
import { lookupLatestAppointment, lookupLatestAppointmentAnyStatus } from '../appointments/lookup';
import { loadBusinessHours, getHoursForDay } from '../appointments/hours';
import { loadActiveServices, findBestServiceMatch } from '../appointments/services';
import { searchProducts, findBestProductMatch } from '../ecommerce/products';
import { extractAvailabilityCandidate } from '../ecommerce/extract-product';
import { clearConversationState } from '../state/store';
import { formatTime12 } from '../time';
import { safeErrorReply } from '../validation/final-reply-guard';
import { v2log } from '../logger';
import { cancelOrdersForChat } from '../ecommerce/cancel-orders';
import { cancelAppointmentsForChat } from '../appointments/cancel-appointments';
import type { AutomationResult } from '../types';

// ── Deterministic Result ─────────────────────────────────────

export interface DeterministicResult {
    handled: boolean;
    fsmResult?: FSMResult;
}

// ── Handle Deterministic ─────────────────────────────────────

/**
 * Try to handle the message deterministically (zero LLM).
 * Returns { handled: true, fsmResult } if handled.
 * Returns { handled: false } if LLM is needed.
 */
export async function handleDeterministic(
    intent: string,
    input: AutomationInput,
    config: WorkspaceConfig,
    lang: string,
    postContext: PostActionContext | null
): Promise<DeterministicResult> {
    switch (intent) {
        case 'greeting':
            return {
                handled: true,
                fsmResult: {
                    replyText: getTemplate('greeting', lang) || 'Hey! How can I help?',
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['greeting'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                },
            };

        case 'frustration_stop':
            return {
                handled: true,
                fsmResult: {
                    replyText: getTemplate('frustration_stop', lang) || "Sorry about that. I won't bother you.",
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['frustration_stop'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                },
            };

        case 'correction':
            return {
                handled: true,
                fsmResult: {
                    replyText: getTemplate('correction', lang) || 'Sorry about that! What did you need?',
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['correction_acknowledged'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                },
            };

        case 'business_hours':
            return await handleBusinessHours(input, config, lang);

        case 'location_question':
            if (config.storeLocation) {
                return {
                    handled: true,
                    fsmResult: {
                        replyText: getTemplate('location', lang, { location: config.storeLocation }) || `We're at: ${config.storeLocation}`,
                        nextStage: 'idle',
                        nextData: null,
                        actions: ['location_answered'],
                        dbWriteAttempted: false,
                        dbWriteSuccess: false,
                        shouldReply: true,
                    },
                };
            }
            return { handled: false };

        case 'shipping_question':
            if (config.businessType === 'ecommerce' && config.shippingRules) {
                return {
                    handled: true,
                    fsmResult: {
                        replyText: config.shippingRules,
                        nextStage: 'idle',
                        nextData: null,
                        actions: ['shipping_answered'],
                        dbWriteAttempted: false,
                        dbWriteSuccess: false,
                        shouldReply: true,
                    },
                };
            }
            return { handled: false };

        case 'order_status':
            if (input.workspaceType === 'ecommerce') {
                return await handleOrderStatus(input, lang);
            }
            return { handled: false };

        case 'appointment_status':
            if (input.workspaceType === 'appointments') {
                return await handleAppointmentStatus(input, lang);
            }
            return { handled: false };

        case 'cancel_status':
            return await handleCancelStatus(input, lang);

        case 'product_availability':
        case 'price_question':
        case 'product_question':
            if (input.workspaceType === 'ecommerce') {
                return await handleProductQuery(input, lang, intent);
            }
            if (input.workspaceType === 'appointments') {
                return await handleServiceQuery(input, lang, intent);
            }
            return { handled: false };

        case 'service_question':
            if (input.workspaceType === 'appointments') {
                return await handleServiceQuery(input, lang, intent);
            }
            return { handled: false };

        default:
            return { handled: false };
    }
}

// ── Sub-Handlers ─────────────────────────────────────────────

async function handleBusinessHours(
    input: AutomationInput,
    config: WorkspaceConfig,
    lang: string
): Promise<DeterministicResult> {
    const hours = await loadBusinessHours(input.supabase, input.workspaceId);
    if (hours.length > 0) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const openDays = hours.filter(h => h.isOpen);
        const listing = openDays.map(h =>
            `${dayNames[h.dayOfWeek]}: ${formatTime12(h.openTime)} – ${formatTime12(h.closeTime)}`
        ).join('\n');
        return {
            handled: true,
            fsmResult: {
                replyText: getTemplate('business_hours', lang, { hours: listing }) || `Our hours:\n${listing}`,
                nextStage: 'idle',
                nextData: null,
                actions: ['business_hours_lookup'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            },
        };
    }
    return { handled: false };
}

async function handleOrderStatus(
    input: AutomationInput,
    lang: string
): Promise<DeterministicResult> {
    const order = await lookupLatestOrder(input.supabase, input.workspaceId, input.chatId);
    if (order) {
        return {
            handled: true,
            fsmResult: {
                replyText: getTemplate('order_status', lang, {
                    productName: order.productName,
                    status: order.status,
                }) || `Your order (${order.productName}): ${order.status}`,
                nextStage: 'idle',
                nextData: null,
                actions: ['order_status_lookup'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            },
        };
    }
    return {
        handled: true,
        fsmResult: {
            replyText: getTemplate('no_recent_order', lang) || "I can't find a recent order.",
            nextStage: 'idle',
            nextData: null,
            actions: ['no_order_found'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        },
    };
}

async function handleAppointmentStatus(
    input: AutomationInput,
    lang: string
): Promise<DeterministicResult> {
    const appt = await lookupLatestAppointment(input.supabase, input.workspaceId, input.chatId);
    if (appt) {
        return {
            handled: true,
            fsmResult: {
                replyText: getTemplate('appointment_status', lang, {
                    status: appt.status,
                }) || `Your appointment status is: ${appt.status}.`,
                nextStage: 'idle',
                nextData: null,
                actions: ['appointment_status_lookup'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            },
        };
    }
    return {
        handled: true,
        fsmResult: {
            replyText: getTemplate('no_recent_appointment', lang) || "I can't find an upcoming appointment.",
            nextStage: 'idle',
            nextData: null,
            actions: ['no_appointment_found'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        },
    };
}

async function handleCancelStatus(
    input: AutomationInput,
    lang: string
): Promise<DeterministicResult> {
    if (input.workspaceType === 'ecommerce') {
        const order = await lookupLatestOrder(input.supabase, input.workspaceId, input.chatId);
        if (order) {
            const isCancelled = order.status.toLowerCase() === 'cancelled';
            const isPending = order.status.toLowerCase() === 'pending';
            let replyText: string;
            if (isCancelled) {
                replyText = getTemplate('order_status_cancelled', lang) || 'Your order status is Cancelled.';
            } else if (isPending) {
                replyText = getTemplate('order_status_pending_cancel', lang) || "Not yet — it's still pending. Want me to cancel it?";
            } else {
                replyText = getTemplate('order_status', lang, { productName: order.productName, status: order.status }) || `Your order status is: ${order.status}`;
            }
            return {
                handled: true,
                fsmResult: {
                    replyText,
                    nextStage: 'idle', nextData: null,
                    actions: ['cancel_status_order'],
                    dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true,
                },
            };
        }
        return {
            handled: true,
            fsmResult: {
                replyText: getTemplate('no_recent_order', lang) || "I can't find a recent order.",
                nextStage: 'idle', nextData: null,
                actions: ['cancel_status_no_order'],
                dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true,
            },
        };
    }

    if (input.workspaceType === 'appointments') {
        const appt = await lookupLatestAppointmentAnyStatus(input.supabase, input.workspaceId, input.chatId);
        if (appt) {
            const isCancelled = appt.status.toLowerCase() === 'cancelled';
            const replyText = isCancelled
                ? (getTemplate('appointment_status_cancelled', lang) || 'Your appointment status is Cancelled.')
                : (getTemplate('appointment_status_active', lang) || "Not yet — it's still active. Want me to cancel it?");
            return {
                handled: true,
                fsmResult: {
                    replyText,
                    nextStage: 'idle', nextData: null,
                    actions: ['cancel_status_appointment'],
                    dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true,
                },
            };
        }
        return {
            handled: true,
            fsmResult: {
                replyText: getTemplate('no_recent_appointment', lang) || "I can't find an upcoming appointment.",
                nextStage: 'idle', nextData: null,
                actions: ['cancel_status_no_appt'],
                dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true,
            },
        };
    }

    return { handled: false };
}

async function handleProductQuery(
    input: AutomationInput,
    lang: string,
    intent: string
): Promise<DeterministicResult> {
    const candidate = extractAvailabilityCandidate(input.message);
    const isSpecificQuery = candidate.length > 0;

    const products = await searchProducts({
        supabase: input.supabase,
        workspaceId: input.workspaceId,
        query: isSpecificQuery ? candidate : undefined,
        limit: isSpecificQuery ? 10 : 6,
    });

    if (isSpecificQuery) {
        let matched = findBestProductMatch(products, candidate);

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

            if (intent === 'price_question') {
                replyText = getTemplate('product_price', lang, {
                    productName: matched.itemName,
                    price: matched.price,
                }) || `${matched.itemName} — $${matched.price}`;
            } else if (inStock) {
                replyText = getTemplate('product_available_want', lang, {
                    productName: matched.itemName,
                    price: matched.price,
                }) || `Yes, ${matched.itemName} is available — $${matched.price}. Want one?`;
            } else {
                replyText = getTemplate('product_not_available', lang, {
                    productName: matched.itemName,
                }) || `${matched.itemName} is currently out of stock.`;
            }

            return {
                handled: true,
                fsmResult: {
                    replyText,
                    nextStage: 'idle',
                    nextData: null,
                    actions: ['product_search_specific'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                },
            };
        }

        // Not found — suggest alternatives
        const allProducts = products.length > 0 ? products : await searchProducts({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            limit: 5,
        });
        const inStock = allProducts.filter(p => p.stockLevel > 0);
        const listing = inStock.slice(0, 3).map(p => `• ${p.itemName} — $${p.price}`).join('\n');

        const replyText = inStock.length > 0
            ? (getTemplate('product_not_found_suggest', lang, { candidate, listing }) || `I couldn't find "${candidate}". We do have:\n${listing}`)
            : (getTemplate('product_not_found', lang) || 'That product is not available.');

        return {
            handled: true,
            fsmResult: {
                replyText,
                nextStage: 'idle',
                nextData: null,
                actions: ['product_search_not_found'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            },
        };
    }

    // General catalog query
    if (products.length > 0) {
        const inStock = products.filter(p => p.stockLevel > 0);
        const listing = inStock.slice(0, 5).map(p => `• ${p.itemName} — $${p.price}`).join('\n');

        const templateKey = intent === 'price_question' ? 'product_prices' : 'product_catalog';
        const replyText = getTemplate(templateKey, lang, { listing }) || `Here's what we have:\n${listing}`;

        return {
            handled: true,
            fsmResult: {
                replyText,
                nextStage: 'idle',
                nextData: null,
                actions: ['product_search_catalog'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            },
        };
    }

    const templateKey = intent === 'price_question' ? 'price_which' : 'no_products';
    const replyText = getTemplate(templateKey, lang) || 'No products available right now.';

    return {
        handled: true,
        fsmResult: {
            replyText,
            nextStage: 'idle',
            nextData: null,
            actions: [intent === 'price_question' ? 'price_question_clarify' : 'product_search_empty'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        },
    };
}

async function handleServiceQuery(
    input: AutomationInput,
    lang: string,
    intent: string
): Promise<DeterministicResult> {
    const services = await loadActiveServices(input.supabase, input.workspaceId);

    if (services.length > 0) {
        const candidate = extractAvailabilityCandidate(input.message);
        if (candidate.length > 0) {
            const matched = findBestServiceMatch(services, candidate);
            if (matched) {
                return {
                    handled: true,
                    fsmResult: {
                        replyText: getTemplate('service_info', lang, {
                            serviceName: matched.name,
                            price: matched.price,
                            duration: matched.durationMinutes,
                        }) || `${matched.name} — $${matched.price} (${matched.durationMinutes}min). Want to book?`,
                        nextStage: 'idle',
                        nextData: null,
                        actions: ['service_search_specific'],
                        dbWriteAttempted: false,
                        dbWriteSuccess: false,
                        shouldReply: true,
                    },
                };
            }
        }

        const listing = services.slice(0, 6).map(s => `• ${s.name} — $${s.price} (${s.durationMinutes}min)`).join('\n');
        const templateKey = intent === 'price_question' ? 'service_prices' : 'service_listing';
        return {
            handled: true,
            fsmResult: {
                replyText: getTemplate(templateKey, lang, { listing }) || `Here are our services:\n${listing}`,
                nextStage: 'idle',
                nextData: null,
                actions: ['service_search'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            },
        };
    }

    return {
        handled: true,
        fsmResult: {
            replyText: getTemplate('no_services', lang) || 'No services available right now.',
            nextStage: 'idle',
            nextData: null,
            actions: ['service_search_empty'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        },
    };
}

// ── Scoped Cancellation Handler ──────────────────────────────

export interface DetectedCancelScope {
    scope: string;
    count?: number;
    ordinal?: string;
    product?: string;
}

export function detectCancelScope(msg: string): DetectedCancelScope {
    const text = msg.toLowerCase().trim();
    if (text.includes('first')) return { scope: 'ordinal', ordinal: 'first' };
    if (text.includes('second')) return { scope: 'ordinal', ordinal: 'second' };
    if (text.includes('third')) return { scope: 'ordinal', ordinal: 'third' };
    if (text.includes('both') || text.includes('all')) return { scope: 'all_pending' };
    return { scope: 'latest' };
}

export async function handleCancel(
    input: AutomationInput,
    config: WorkspaceConfig,
    lang: string,
    scope: DetectedCancelScope
): Promise<AutomationResult> {
    const startTime = Date.now();
    let replyText = '';
    let actions: string[] = [];
    let dbWriteSuccess = false;

    if (input.workspaceType === 'ecommerce') {
        const result = await cancelOrdersForChat({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            chatId: input.chatId,
            scope: scope.scope as any,
            count: scope.count,
            ordinal: scope.ordinal as any,
            product: scope.product,
        });

        if (result.error) {
            replyText = getTemplate('cancel_no_order', lang) || "I couldn't find a recent order to cancel.";
            actions = ['cancel_order_error'];
        } else if (result.cancelledCount > 0) {
            replyText = getTemplate('order_cancelled', lang) || 'Order cancelled.';
            actions = ['order_cancelled_successfully'];
            dbWriteSuccess = true;
        } else if (result.alreadyCancelledCount > 0) {
            replyText = getTemplate('order_already_cancelled', lang) || 'Order is already cancelled.';
            actions = ['order_already_cancelled'];
        } else {
            replyText = getTemplate('order_not_cancellable', lang) || "I can't cancel it because of its status.";
            actions = ['order_not_cancellable'];
        }
    } else {
        const result = await cancelAppointmentsForChat({
            supabase: input.supabase,
            workspaceId: input.workspaceId,
            chatId: input.chatId,
            scope: scope.scope as any,
            count: scope.count,
            ordinal: scope.ordinal as any,
        });

        if (result.error) {
            replyText = getTemplate('cancel_no_appointment', lang) || "I couldn't find a recent appointment to cancel.";
            actions = ['cancel_appointment_error'];
        } else if (result.cancelledCount > 0) {
            replyText = getTemplate('appointment_cancelled', lang) || 'Appointment cancelled.';
            actions = ['appointment_cancelled_successfully'];
            dbWriteSuccess = true;
        } else if (result.alreadyCancelledCount > 0) {
            replyText = getTemplate('appointment_already_cancelled', lang) || 'Appointment is already cancelled.';
            actions = ['appointment_already_cancelled'];
        } else {
            replyText = getTemplate('cancel_no_appointment', lang) || "I can't cancel it because of its status.";
            actions = ['appointment_not_cancellable'];
        }
    }

    return {
        shouldReply: true,
        replyText,
        actions,
        stateBefore: 'idle',
        stateAfter: 'idle',
        debug: {
            requestId: crypto.randomUUID(),
            engineVersion: 'v2',
            workspaceId: input.workspaceId,
            workspaceType: input.workspaceType,
            chatId: input.chatId,
            language: lang as any,
            dbWriteAttempted: true,
            dbWriteSuccess,
            durationMs: Date.now() - startTime,
        },
    };
}
