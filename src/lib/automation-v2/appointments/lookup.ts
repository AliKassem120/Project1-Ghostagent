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
        .eq('instagram_user_id', chatId)
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
): Promise<{ success: boolean; serviceName?: string }> {
    const appt = await lookupLatestAppointment(supabase, workspaceId, chatId);
    if (!appt) return { success: false };

    const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appt.id);

    return { success: !error, serviceName: appt.serviceName };
}
