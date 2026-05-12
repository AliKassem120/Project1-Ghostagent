/**
 * GhostAgent — FSM Router Handler
 * Routes to ecommerce-fsm or appointments-fsm based on
 * workspace type + intent. Handles initial state creation.
 */

import type { AutomationInput, WorkspaceConfig } from '../types';
import type { FSMResult, PostActionContext, EcommerceStateData, AppointmentStateData } from '../state/types';
import { processAppointmentState } from '../state/appointments-fsm';
import { processEcommerceState } from '../state/ecommerce-fsm';

export interface FSMRouteResult {
    handled: boolean;
    fsmResult?: FSMResult;
}

export async function routeToFSM(
    intent: string,
    input: AutomationInput,
    config: WorkspaceConfig,
    lang: string,
    postContext: PostActionContext | null
): Promise<FSMRouteResult> {
    const fsmCtx = {
        supabase: input.supabase, userId: input.userId,
        workspaceId: input.workspaceId, chatId: input.chatId,
        config, message: input.message, language: lang, platform: input.platform,
    };

    if (intent === 'booking_intent' && input.workspaceType === 'appointments') {
        const initialState: AppointmentStateData = {
            stage: 'awaiting_service', pendingAction: 'create_appointment',
            appointment: {},
            customer: postContext?.customer ? { name: postContext.customer.name, phone: postContext.customer.phone } : {},
            missingFields: ['service'],
        };
        return { handled: true, fsmResult: await processAppointmentState(fsmCtx, initialState) };
    }

    if (intent === 'purchase_intent' && input.workspaceType === 'ecommerce') {
        const reuse = postContext?.customer
            ? (await import('../language')).detectReuseSignals(input.message)
            : { reuseName: false, reusePhone: false, reuseAddress: false };
        const newAddress = (await import('../language')).extractAddressFromChange(input.message);
        const initialState: EcommerceStateData = {
            stage: 'awaiting_product', pendingAction: 'create_order',
            order: { quantity: 1 },
            customer: postContext?.customer ? {
                name: reuse.reuseName ? postContext.customer.name : undefined,
                phone: reuse.reusePhone ? postContext.customer.phone : undefined,
                address: newAddress || (reuse.reuseAddress ? postContext.customer.address : undefined),
            } : {},
            missingFields: ['product'],
        };
        return { handled: true, fsmResult: await processEcommerceState(fsmCtx, initialState) };
    }

    if (intent === 'purchase_intent' && input.workspaceType === 'appointments') {
        const initialState: AppointmentStateData = {
            stage: 'awaiting_service', pendingAction: 'create_appointment',
            appointment: {},
            customer: postContext?.customer ? { name: postContext.customer.name, phone: postContext.customer.phone } : {},
            missingFields: ['service'],
        };
        return { handled: true, fsmResult: await processAppointmentState(fsmCtx, initialState) };
    }

    return { handled: false };
}

export async function continueActiveFSM(
    input: AutomationInput, config: WorkspaceConfig, lang: string, currentData: any
): Promise<FSMResult> {
    const fsmCtx = {
        supabase: input.supabase, userId: input.userId,
        workspaceId: input.workspaceId, chatId: input.chatId,
        config, message: input.message, language: lang, platform: input.platform,
    };
    if (input.workspaceType === 'appointments') return await processAppointmentState(fsmCtx, currentData);
    if (input.workspaceType === 'ecommerce') return await processEcommerceState(fsmCtx, currentData);
    return { replyText: '', nextStage: 'idle', nextData: null, actions: ['saas_fsm_skipped'], dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: false };
}
