/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Create Appointment
 * ═══════════════════════════════════════════════════════════════
 * Handles the actual database insert for appointments.
 * Performs a post-insert visibility check to ensure the calendar
 * dashboard will see this appointment.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v2log } from '../logger';

export interface CreateAppointmentInput {
    supabase: SupabaseClient;
    userId: string;
    workspaceId: string;
    chatId: string;
    customerName: string;
    customerPhone: string;
    serviceName: string;
    date: string;       // YYYY-MM-DD
    startTime: string;  // HH:mm
    endTime: string;    // HH:mm
    durationMinutes: number;
    instagramHandle?: string;
}

export async function createAppointmentV2(input: CreateAppointmentInput): Promise<boolean> {
    const { 
        supabase, userId, workspaceId, chatId, customerName, 
        customerPhone, serviceName, date, startTime, endTime, 
        durationMinutes, instagramHandle = 'Customer' 
    } = input;

    v2log.appointment.insertAttempt({ workspaceId, date, startTime, customerName });

    try {
        // 1. Insert into appointments table
        const { data: inserted, error } = await supabase
            .from('appointments')
            .insert({
                user_id: userId,
                workspace_id: workspaceId,
                instagram_user_id: chatId,
                instagram_handle: instagramHandle,
                customer_name: customerName,
                customer_phone: customerPhone,
                service: serviceName,
                appointment_date: date,
                start_time: startTime,
                end_time: endTime,
                duration_minutes: durationMinutes,
                status: 'confirmed',
                notes: 'Created via Automation Engine V2'
            })
            .select()
            .single();

        if (error) {
            v2log.appointment.insertError({ error, workspaceId });
            return false;
        }

        v2log.appointment.insertSuccess({ appointmentId: inserted.id });

        // 2. Visibility Check (Post-Insert)
        // Verify the calendar dashboard query would see this.
        // Calendar query: .gte("appointment_date", startOfMonth).lte("appointment_date", endOfMonth)
        const year = date.split('-')[0];
        const month = date.split('-')[1];
        const startOfMonth = `${year}-${month}-01`;
        const lastDay = new Date(Number(year), Number(month), 0).getDate();
        const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        const { data: visible, error: visError } = await supabase
            .from('appointments')
            .select('id')
            .eq('id', inserted.id)
            .eq('workspace_id', workspaceId)
            .gte('appointment_date', startOfMonth)
            .lte('appointment_date', endOfMonth)
            .maybeSingle();

        if (visError || !visible) {
            v2log.appointment.calendarVisibility({ 
                visible: false, 
                error: visError, 
                date, 
                startOfMonth, 
                endOfMonth 
            });
            // We don't fail the whole thing, but we log it as a visibility warning
        } else {
            v2log.appointment.calendarVisibility({ visible: true });
        }

        return true;

    } catch (err) {
        v2log.error('V2_APPOINTMENTS_CREATE', 'Unexpected error during appointment creation', { err, workspaceId });
        return false;
    }
}
