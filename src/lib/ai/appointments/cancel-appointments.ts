/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Scoped Appointment Cancellation
 * ═══════════════════════════════════════════════════════════════
 * Replaces single cancelLatestAppointment with scope-aware cancellation.
 * Supports: latest, count, all_pending, ordinal, date.
 *
 * Reply is generated from DB result only — never says "appointments cancelled"
 * unless actual cancelledCount matches.
 */

import { SupabaseClient } from '@supabase/supabase-js';
// Inlined from deleted classify/normalized-intent
type IntentScope = 'latest' | 'count' | 'all_pending' | 'all' | 'ordinal' | 'product_reference' | 'specific_id';
type IntentOrdinal = 'first' | 'second' | 'third' | 'last' | 'latest';
import { v2log } from '../logger';
import { sendAppointmentCancelNotification } from '../../../utils/whatsapp-alerts';

// ── Types ────────────────────────────────────────────────────

export interface CancelAppointmentsInput {
    supabase: SupabaseClient;
    workspaceId: string;
    chatId: string;
    scope: IntentScope;
    count?: number;
    ordinal?: IntentOrdinal;
    date?: string; // YYYY-MM-DD
    appointmentId?: string;
}

export interface CancelAppointmentsResult {
    requestedScope: IntentScope;
    requestedCount: number | null;
    cancelledCount: number;
    alreadyCancelledCount: number;
    notCancellableCount: number;
    notCancellableStatuses: string[];
    cancelledIds: string[];
    alreadyCancelledIds: string[];
    notCancellableIds: string[];
    error?: string;
}

const CANCELLABLE_STATUSES = ['confirmed', 'pending'];

// ── Main function ────────────────────────────────────────────

export async function cancelAppointmentsForChat(input: CancelAppointmentsInput): Promise<CancelAppointmentsResult> {
    const { supabase, workspaceId, chatId, scope } = input;

    const emptyResult: CancelAppointmentsResult = {
        requestedScope: scope,
        requestedCount: input.count ?? null,
        cancelledCount: 0,
        alreadyCancelledCount: 0,
        notCancellableCount: 0,
        notCancellableStatuses: [],
        cancelledIds: [],
        alreadyCancelledIds: [],
        notCancellableIds: [],
    };

    try {
        // ── Fetch appointments for this chat ─────────────────
        const { data: appointments, error } = await supabase
            .from('appointments')
            .select('id, status, date, start_time, service_name, created_at, customer_name, customer_phone, platform')
            .eq('workspace_id', workspaceId)
            .eq('chat_id', chatId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            v2log.error('CANCEL_APPOINTMENTS', 'Failed to fetch appointments', { error, workspaceId, chatId });
            return { ...emptyResult, error: error.message };
        }

        if (!appointments || appointments.length === 0) {
            return { ...emptyResult, error: 'no_appointments' };
        }

        // ── Select appointments based on scope ───────────────
        let targetAppointments = appointments;

        switch (scope) {
            case 'latest':
                targetAppointments = [appointments[0]];
                break;

            case 'count':
                targetAppointments = appointments.slice(0, input.count || 1);
                break;

            case 'all_pending':
                targetAppointments = appointments.filter(a => CANCELLABLE_STATUSES.includes(a.status));
                break;

            case 'all':
                break;

            case 'ordinal': {
                const idx = ordinalToIndex(input.ordinal);
                if (idx !== null && idx < appointments.length) {
                    targetAppointments = [appointments[idx]];
                } else {
                    return { ...emptyResult, error: 'ordinal_out_of_range' };
                }
                break;
            }

            case 'specific_id':
                if (input.appointmentId) {
                    targetAppointments = appointments.filter(a => a.id === input.appointmentId);
                    if (targetAppointments.length === 0) {
                        return { ...emptyResult, error: 'appointment_id_not_found' };
                    }
                }
                break;

            default:
                // Date-based: "cancel tomorrow's appointment"
                if (input.date) {
                    targetAppointments = appointments.filter(a => a.date === input.date);
                    if (targetAppointments.length === 0) {
                        return { ...emptyResult, error: 'no_appointments_on_date' };
                    }
                } else {
                    targetAppointments = [appointments[0]]; // fallback to latest
                }
        }

        // ── Process cancellations ────────────────────────────
        const result: CancelAppointmentsResult = {
            ...emptyResult,
            requestedCount: targetAppointments.length,
        };

        for (const appt of targetAppointments) {
            if (appt.status?.toLowerCase() === 'cancelled') {
                result.alreadyCancelledCount++;
                result.alreadyCancelledIds.push(appt.id);
                continue;
            }

            if (!CANCELLABLE_STATUSES.includes(appt.status?.toLowerCase())) {
                result.notCancellableCount++;
                result.notCancellableStatuses.push(appt.status);
                result.notCancellableIds.push(appt.id);
                continue;
            }

            const { error: cancelError } = await supabase
                .from('appointments')
                .update({ status: 'cancelled' })
                .eq('id', appt.id);

            if (cancelError) {
                v2log.error('CANCEL_APPOINTMENTS', 'Failed to cancel appointment', { appointmentId: appt.id, error: cancelError });
                result.notCancellableCount++;
                result.notCancellableIds.push(appt.id);
                continue;
            }

            result.cancelledCount++;
            result.cancelledIds.push(appt.id);
        }

        // ── Send WhatsApp notification to the business owner ──
        if (result.cancelledCount > 0) {
            const { data: ws } = await supabase.from('ai_settings').select('emergency_whatsapp').eq('id', workspaceId).single();
            const emergencyWhatsApp = ws?.emergency_whatsapp;
            
            if (emergencyWhatsApp) {
                for (const appt of targetAppointments.filter(a => result.cancelledIds.includes(a.id))) {
                    const name = (appt as any).customer_name || 'Customer';
                    const service = (appt as any).service_name || 'an appointment';
                    sendAppointmentCancelNotification(emergencyWhatsApp, name, service).catch(err =>
                        v2log.warn('CANCEL_APPOINTMENTS', 'WA notification failed', { error: err?.message })
                    );
                }
            }
        }

        v2log.info('CANCEL_APPOINTMENTS', `Scoped cancel: ${scope}`, {
            workspaceId,
            chatId,
            scope,
            requestedCount: result.requestedCount,
            cancelledCount: result.cancelledCount,
            alreadyCancelledCount: result.alreadyCancelledCount,
            notCancellableCount: result.notCancellableCount,
        });

        return result;

    } catch (err: any) {
        v2log.error('CANCEL_APPOINTMENTS', 'Exception', { error: err?.message, workspaceId, chatId });
        return { ...emptyResult, error: err?.message || 'Unknown error' };
    }
}

// ── Helpers ──────────────────────────────────────────────────

function ordinalToIndex(ordinal?: IntentOrdinal): number | null {
    switch (ordinal) {
        case 'first': return 0;
        case 'second': return 1;
        case 'third': return 2;
        case 'last':
        case 'latest': return 0;
        default: return null;
    }
}
