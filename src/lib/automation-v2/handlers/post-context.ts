/**
 * GhostAgent — Post-Context Handler
 * Handles post-action intents: cancel, modify, status, reschedule, accept/reject offer.
 * Extracted from decision-engine.ts handlePostContextIntent.
 */

import type { AutomationInput, WorkspaceConfig } from '../types';
import type { FSMResult, PostActionContext, EcommerceStateData, AppointmentStateData } from '../state/types';
import { getTemplate } from '../templates';
import { lookupLatestOrder, updateOrderVariant } from '../ecommerce/lookup';
import { cancelOrdersForChat } from '../ecommerce/cancel-orders';
import { cancelAppointmentsForChat } from '../appointments/cancel-appointments';
import { saveConversationState, clearConversationState } from '../state/store';
import { safeErrorReply } from '../validation/final-reply-guard';
import { classifyPostContext } from '../classify/post-context-classifier';
import { detectCancelScope } from './deterministic';

export async function handlePostContext(
    input: AutomationInput, config: WorkspaceConfig, lang: string, pc: PostActionContext
): Promise<{ handled: boolean; fsmResult?: FSMResult }> {
    const pcResult = classifyPostContext(input.message);
    if (pcResult.intent === 'unrelated') return { handled: false };

    const result = await handlePostContextIntent(input, config, lang, pc, pcResult.intent, pcResult.extractedValue);
    return result ? { handled: true, fsmResult: result } : { handled: false };
}

export async function handlePostContextIntent(
    input: AutomationInput, config: WorkspaceConfig, lang: string,
    pc: PostActionContext, intent: string, extractedValue?: string
): Promise<FSMResult | null> {
    const isEditable = new Date(pc.editableUntil).getTime() > Date.now();

    switch (intent) {
        case 'cancel_latest': {
            const scopeObj = detectCancelScope(input.message);
            if (pc.type === 'order') {
                const result = await cancelOrdersForChat({ supabase: input.supabase, workspaceId: input.workspaceId, chatId: input.chatId, scope: scopeObj.scope as any, ordinal: scopeObj.ordinal as any });
                if (result.cancelledCount > 0) {
                    return { replyText: getTemplate('order_cancelled', lang) || 'Order cancelled.', nextStage: 'idle', nextData: null, actions: ['post_context_cancel_order'], dbWriteAttempted: true, dbWriteSuccess: true, shouldReply: true };
                }
                return { replyText: getTemplate('cancel_no_order', lang) || "I can't find a recent order.", nextStage: 'idle', nextData: null, actions: ['cancel_no_order'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true };
            }
            if (pc.type === 'appointment') {
                const result = await cancelAppointmentsForChat({ supabase: input.supabase, workspaceId: input.workspaceId, chatId: input.chatId, scope: scopeObj.scope as any, ordinal: scopeObj.ordinal as any });
                if (result.cancelledCount > 0) {
                    return { replyText: getTemplate('appointment_cancelled', lang) || 'Appointment cancelled.', nextStage: 'idle', nextData: null, actions: ['post_context_cancel_appointment'], dbWriteAttempted: true, dbWriteSuccess: true, shouldReply: true };
                }
                return { replyText: getTemplate('cancel_no_appointment', lang) || "I can't find a recent appointment.", nextStage: 'idle', nextData: null, actions: ['cancel_no_appointment'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true };
            }
            return null;
        }

        case 'order_status': {
            if (pc.type === 'order' && pc.lastOrderId) {
                const order = await lookupLatestOrder(input.supabase, input.workspaceId, input.chatId);
                if (order) {
                    return { replyText: getTemplate('order_status', lang, { productName: order.productName, status: order.status }) || `Your order: ${order.status}`, nextStage: 'idle', nextData: null, actions: ['post_context_order_status'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true };
                }
            }
            return null;
        }

        case 'modify_order': {
            if (pc.type !== 'order' || !pc.lastOrderId) return null;
            if (!isEditable) {
                return { replyText: getTemplate('modify_expired', lang) || 'This order can no longer be modified.', nextStage: 'idle', nextData: null, actions: ['post_context_modify_expired'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true };
            }
            if (extractedValue) {
                const success = await updateOrderVariant(input.supabase, pc.lastOrderId, extractedValue);
                if (success) {
                    return { replyText: getTemplate('modify_success', lang, { value: extractedValue }) || `Updated to "${extractedValue}" ✅`, nextStage: 'idle', nextData: null, actions: ['post_context_modify_success'], dbWriteAttempted: true, dbWriteSuccess: true, shouldReply: true };
                }
            }
            return { replyText: getTemplate('modify_ask', lang) || 'What would you like to change it to?', nextStage: 'idle', nextData: null, actions: ['post_context_modify_ask'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true };
        }

        case 'reschedule': {
            if (pc.type !== 'appointment' || !pc.lastAppointmentId) return null;
            if (!isEditable) {
                return { replyText: getTemplate('reschedule_expired', lang) || 'Too late to reschedule.', nextStage: 'idle', nextData: null, actions: ['post_context_reschedule_expired'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true };
            }
            return { replyText: getTemplate('reschedule_ask', lang) || 'What day and time would you like instead?', nextStage: 'idle', nextData: null, actions: ['post_context_reschedule_ask'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true };
        }

        case 'accept_offer': {
            if (!pc.ctaType) return null;
            if (pc.ctaType === 'purchase_offer' && pc.type === 'order' && pc.productName) {
                const initialState: EcommerceStateData = {
                    stage: 'awaiting_order_details', pendingAction: 'create_order',
                    order: { productId: pc.productId, productName: pc.productName, unitPrice: pc.unitPrice, quantity: pc.quantity || 1, variantLabel: pc.variantLabel },
                    customer: pc.customer?.name ? { name: pc.customer.name, phone: pc.customer.phone, address: pc.customer.address } : {},
                    missingFields: ['customerName', 'customerPhone', 'deliveryAddress'],
                    source: pc.source,
                };
                const stateWrite = await saveConversationState(input.supabase, input.userId, input.workspaceId, input.chatId, input.workspaceType as 'ecommerce', 'awaiting_order_details', initialState, input.platform);
                if (!stateWrite.success) return { replyText: safeErrorReply(lang), nextStage: 'idle', nextData: null, actions: ['accept_offer_ecommerce', 'state_save_failed'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true };
                return { replyText: getTemplate('accept_offer_ask_details', lang) || 'Send your name, phone number, and delivery address.', nextStage: 'awaiting_order_details', nextData: initialState, actions: ['accept_offer_ecommerce'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true };
            }
            if (pc.ctaType === 'booking_offer' && pc.type === 'appointment' && pc.serviceName) {
                const initialState: AppointmentStateData = {
                    stage: 'awaiting_date_time', pendingAction: 'create_appointment',
                    appointment: { serviceId: pc.serviceId, serviceName: pc.serviceName, servicePrice: pc.servicePrice, serviceDuration: pc.serviceDuration },
                    customer: pc.customer?.name ? { name: pc.customer.name, phone: pc.customer.phone } : {},
                    missingFields: ['date', 'time'],
                    source: pc.source,
                };
                const stateWrite = await saveConversationState(input.supabase, input.userId, input.workspaceId, input.chatId, input.workspaceType as 'appointments', 'awaiting_date_time', initialState, input.platform);
                if (!stateWrite.success) return { replyText: safeErrorReply(lang), nextStage: 'idle', nextData: null, actions: ['accept_offer_appointment', 'state_save_failed'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true };
                return { replyText: getTemplate('accept_offer_ask_time', lang) || 'What day and time works for you?', nextStage: 'awaiting_date_time', nextData: initialState, actions: ['accept_offer_appointment'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true };
            }
            return null;
        }

        case 'reject_offer': {
            if (!pc.ctaType) return null;
            await clearConversationState(input.supabase, input.userId, input.workspaceId, input.chatId, input.workspaceType);
            return { replyText: getTemplate('cancel_ack', lang) || 'No problem.', nextStage: 'idle', nextData: null, actions: ['reject_offer'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true };
        }

        case 'reuse_details': {
            if (pc.type === 'order') {
                const initialState: EcommerceStateData = {
                    stage: 'awaiting_product', pendingAction: 'create_order',
                    order: { quantity: 1 },
                    customer: pc.customer ? { name: pc.customer.name, phone: pc.customer.phone, address: pc.customer.address } : {},
                    missingFields: ['product'],
                };
                const stateWrite = await saveConversationState(input.supabase, input.userId, input.workspaceId, input.chatId, 'ecommerce', 'awaiting_product', initialState, input.platform);
                if (!stateWrite.success) return { replyText: safeErrorReply(lang), nextStage: 'idle', nextData: null, actions: ['reuse_details_ecommerce', 'state_save_failed'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true };
                return { replyText: getTemplate('ask_service', lang, { names: 'our products' }) || 'What product would you like to order?', nextStage: 'awaiting_product', nextData: initialState, actions: ['reuse_details_ecommerce'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true };
            }
            if (pc.type === 'appointment') {
                const initialState: AppointmentStateData = {
                    stage: 'awaiting_service', pendingAction: 'create_appointment',
                    appointment: {},
                    customer: pc.customer ? { name: pc.customer.name, phone: pc.customer.phone } : {},
                    missingFields: ['service'],
                };
                const stateWrite = await saveConversationState(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', 'awaiting_service', initialState, input.platform);
                if (!stateWrite.success) return { replyText: safeErrorReply(lang), nextStage: 'idle', nextData: null, actions: ['reuse_details_appointment', 'state_save_failed'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true };
                return { replyText: getTemplate('ask_service', lang, { names: 'our services' }) || 'What service would you like to book?', nextStage: 'awaiting_service', nextData: initialState, actions: ['reuse_details_appointment'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true };
            }
            return null;
        }

        default:
            return null;
    }
}
