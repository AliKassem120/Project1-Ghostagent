import type { AutomationInput, AutomationResult, WorkspaceConfig } from './types';
import { classifyIntent } from './classify/intent-classifier';
import { cancelLatestOrder, lookupLatestOrder } from './ecommerce/lookup';
import { cancelLatestAppointment, lookupLatestAppointment } from './appointments/lookup';
import { detectLanguage } from './language';

function t(en: string, arabizi: string, lang: string): string {
    const l = (lang || '').toLowerCase();
    return l === 'arabizi' || l === 'lebanese franco' || l === 'arabic' || l === 'mixed' ? arabizi : en;
}

function replyLanguage(config: WorkspaceConfig, detected: string): string {
    if (config.language === 'Auto-Detect') return detected;
    const lang = config.language.toLowerCase();
    return lang === 'lebanese franco' ? 'arabizi' : lang;
}

function result(input: AutomationInput, replyText: string | undefined, action: string, lang: string, opts?: { shouldReply?: boolean; stateAfter?: any; dbWriteAttempted?: boolean; dbWriteSuccess?: boolean; error?: string }): AutomationResult {
    return {
        shouldReply: opts?.shouldReply ?? !!replyText,
        replyText,
        actions: [action],
        stateBefore: 'idle',
        stateAfter: opts?.stateAfter || 'idle',
        debug: {
            requestId: '',
            engineVersion: 'v2',
            workspaceId: input.workspaceId,
            workspaceType: input.workspaceType,
            chatId: input.chatId,
            language: lang as any,
            intent: action,
            dbWriteAttempted: opts?.dbWriteAttempted ?? false,
            dbWriteSuccess: opts?.dbWriteSuccess ?? false,
            durationMs: 0,
        },
        error: opts?.error,
    };
}

export async function handleGlobalInterrupt(input: AutomationInput, config: WorkspaceConfig): Promise<AutomationResult | null> {
    const detected = detectLanguage(input.message);
    const lang = replyLanguage(config, detected);
    const classification = classifyIntent(input.message);

    if (classification.intent === 'human_handoff') {
        return result(input, undefined, 'handoff_global_interrupt', lang, { shouldReply: false, stateAfter: 'handoff' });
    }

    if (classification.intent === 'frustration_stop') {
        return result(input, t('Sorry about that. Message us anytime if you need help.', 'Be3tezer. Eza bdk shi, rase.', lang), 'frustration_stop_global_interrupt', lang);
    }

    if (input.workspaceType === 'ecommerce') {
        if (classification.intent === 'cancel_order') {
            const cancel = await cancelLatestOrder(input.supabase, input.workspaceId, input.chatId);
            if (!cancel.success && cancel.reason === 'no_order') return null;

            if (cancel.success) {
                return result(input, t('Order cancelled.', 'Tamem, el order tenla8a.', lang), 'order_cancelled_global_interrupt', lang, { dbWriteAttempted: true, dbWriteSuccess: true });
            }
            if (cancel.reason === 'already_cancelled') {
                return result(input, t('Order is already cancelled.', 'El order already tenla8a.', lang), 'order_already_cancelled_global_interrupt', lang);
            }
            if (cancel.reason === 'not_pending_status') {
                return result(input, t(`I cannot cancel it because status is ${cancel.status}.`, `Ma fiyye el8e, status: ${cancel.status}.`, lang), 'order_cancel_not_pending_global_interrupt', lang);
            }
            return result(input, t('Something went wrong. Please try again.', 'Fi 8alat. Jarreb kamen.', lang), 'order_cancel_failed_global_interrupt', lang, { dbWriteAttempted: true, dbWriteSuccess: false, error: cancel.error });
        }

        if (classification.intent === 'cancel_status') {
            const order = await lookupLatestOrder(input.supabase, input.workspaceId, input.chatId);
            if (!order) return result(input, t('I cannot find a recent order.', 'Ma l2et order 2arib.', lang), 'cancel_status_no_order_global_interrupt', lang);
            const status = String(order.status || '').toLowerCase();
            if (status === 'cancelled') return result(input, t('Yes, your order is cancelled.', 'Eh, el order tenla8a.', lang), 'cancel_status_cancelled_global_interrupt', lang);
            if (status === 'pending') return result(input, t('Not yet, it is still pending. Want me to cancel it?', 'La2 ba3do pending. Badak el8e?', lang), 'cancel_status_pending_global_interrupt', lang);
            return result(input, t(`Your order status is ${order.status}.`, `Status el order: ${order.status}.`, lang), 'cancel_status_order_global_interrupt', lang);
        }
    }

    if (input.workspaceType === 'appointments') {
        if (classification.intent === 'cancel_appointment') {
            const cancel = await cancelLatestAppointment(input.supabase, input.workspaceId, input.chatId);
            if (!cancel.success) return null;
            return result(input, t('Appointment cancelled.', 'Tamem, el maw3ed tenla8a.', lang), 'appointment_cancelled_global_interrupt', lang, { dbWriteAttempted: true, dbWriteSuccess: true });
        }

        if (classification.intent === 'cancel_status') {
            const appt = await lookupLatestAppointment(input.supabase, input.workspaceId, input.chatId);
            if (!appt) return result(input, t('I cannot find an upcoming appointment.', 'Ma l2et maw3ed 2arib.', lang), 'cancel_status_no_appointment_global_interrupt', lang);
            const cancelled = String(appt.status || '').toLowerCase() === 'cancelled';
            return result(input, cancelled ? t('Yes, your appointment is cancelled.', 'Eh, el maw3ed tenla8a.', lang) : t(`Your appointment status is ${appt.status}.`, `Status el maw3ed: ${appt.status}.`, lang), 'cancel_status_appointment_global_interrupt', lang);
        }
    }

    return null;
}
