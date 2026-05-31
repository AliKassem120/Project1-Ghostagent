/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Appointments Lookup & Modify
 * ═══════════════════════════════════════════════════════════════
 * Lookup latest appointments and apply safe modifications.
 * Reschedule checks availability before updating.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { checkAvailability } from './availability';
import { loadBusinessHours } from './hours';
import { v2log } from '../logger';

export interface AppointmentSnapshot {
    id: string;
    serviceName: string;
    date: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    customerName: string;
    customerPhone: string;
    status: string;
    createdAt: string;
    isEditable: boolean;
}

export type CancelAppointmentResult =
    | { success: true; appointmentId: string; serviceName: string; previousStatus: string }
    | { success: false; reason: 'no_appointment' }
    | { success: false; reason: 'already_cancelled'; appointmentId: string; serviceName: string }
    | { success: false; reason: 'not_cancellable_status'; appointmentId: string; serviceName: string; status: string }
    | { success: false; reason: 'db_error'; error: string };

/**
 * Lookup the most recent upcoming appointment for a chat.
 */
export async function lookupLatestAppointment(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string
): Promise<AppointmentSnapshot | null> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('appointments')
        .select('id, service, appointment_date, start_time, end_time, duration_minutes, customer_name, customer_phone, status, created_at')
        .eq('workspace_id', workspaceId)
        .or(`chat_id.eq.${chatId},instagram_user_id.eq.${chatId}`)
        .in('status', ['confirmed', 'pending', 'Confirmed', 'Pending'])
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error || !data) return null;

    // Editable if more than 2 hours before appointment
    const apptTimestamp = new Date(`${data.appointment_date}T${data.start_time}`).getTime();
    const isEditable = (apptTimestamp - Date.now()) > 2 * 60 * 60 * 1000;

    return {
        id: data.id,
        serviceName: data.service,
        date: data.appointment_date,
        startTime: data.start_time,
        endTime: data.end_time,
        durationMinutes: data.duration_minutes || 60,
        customerName: data.customer_name || '',
        customerPhone: data.customer_phone || '',
        status: data.status,
        createdAt: data.created_at,
        isEditable,
    };
}

export async function lookupLatestAppointmentAnyStatus(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string
): Promise<AppointmentSnapshot | null> {
    const { data, error } = await supabase
        .from('appointments')
        .select('id, service, appointment_date, start_time, end_time, duration_minutes, customer_name, customer_phone, status, created_at')
        .eq('workspace_id', workspaceId)
        .or(`chat_id.eq.${chatId},instagram_user_id.eq.${chatId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) return null;

    const apptTimestamp = new Date(`${data.appointment_date}T${data.start_time}`).getTime();
    const isEditable = (apptTimestamp - Date.now()) > 2 * 60 * 60 * 1000;

    return {
        id: data.id,
        serviceName: data.service,
        date: data.appointment_date,
        startTime: data.start_time,
        endTime: data.end_time,
        durationMinutes: data.duration_minutes || 60,
        customerName: data.customer_name || '',
        customerPhone: data.customer_phone || '',
        status: data.status,
        createdAt: data.created_at,
        isEditable,
    };
}

/**
 * Reschedule an appointment to a new date/time.
 * Checks availability first.
 */
export async function rescheduleAppointment(
    supabase: SupabaseClient,
    workspaceId: string,
    appointmentId: string,
    newDate: string,
    newStartTime: string,
    durationMinutes: number
): Promise<{ success: boolean; reason?: string }> {
    // Check availability at new slot
    const hours = await loadBusinessHours(supabase, workspaceId);
    const avail = await checkAvailability({
        supabase,
        workspaceId,
        date: newDate,
        startTime: newStartTime,
        durationMinutes,
        businessHours: hours,
        excludeAppointmentId: appointmentId,
    });

    if (!avail.available) {
        return { success: false, reason: avail.reason || 'slot_unavailable' };
    }

    // Calculate new end time
    const [h, m] = newStartTime.split(':').map(Number);
    const endMinutes = h * 60 + m + durationMinutes;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    const { error } = await supabase
        .from('appointments')
        .update({
            appointment_date: newDate,
            start_time: newStartTime,
            end_time: endTime,
        })
        .eq('id', appointmentId)
        .in('status', ['confirmed', 'pending', 'Confirmed', 'Pending']);

    if (error) {
        v2log.error('APPT_LOOKUP', 'Failed to reschedule', { appointmentId, error });
        return { success: false, reason: 'db_error' };
    }

    return { success: true };
}

/**
 * Cancel the most recent upcoming appointment.
 */
export async function cancelLatestAppointment(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string
): Promise<CancelAppointmentResult> {
    const appt = await lookupLatestAppointmentAnyStatus(supabase, workspaceId, chatId);
    if (!appt) return { success: false, reason: 'no_appointment' };

    const normalizedStatus = appt.status.toLowerCase();
    if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') {
        return {
            success: false,
            reason: 'already_cancelled',
            appointmentId: appt.id,
            serviceName: appt.serviceName,
        };
    }

    if (!['confirmed', 'pending'].includes(normalizedStatus)) {
        return {
            success: false,
            reason: 'not_cancellable_status',
            appointmentId: appt.id,
            serviceName: appt.serviceName,
            status: appt.status,
        };
    }

    const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appt.id);

    if (error) {
        v2log.error('APPT_LOOKUP', 'Failed to cancel appointment', { appointmentId: appt.id, error });
        return { success: false, reason: 'db_error', error: error.message || 'cancel_appointment_failed' };
    }

    return {
        success: true,
        appointmentId: appt.id,
        serviceName: appt.serviceName,
        previousStatus: appt.status,
    };
}
