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
    date: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    instagramHandle?: string;
}

export interface CreateAppointmentResult {
    success: boolean;
    appointmentId?: string;
    error?: string;
    supabaseCode?: string;
    calendarVisible?: boolean;
}

async function createAppointmentInternal(input: CreateAppointmentInput): Promise<CreateAppointmentResult> {
    const {
        supabase, userId, workspaceId, chatId, customerName,
        customerPhone, serviceName, date, startTime, endTime,
        durationMinutes, instagramHandle = 'Customer'
    } = input;

    v2log.appointment.insertAttempt({ workspaceId, date, startTime, customerName });

    try {
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
            .select('id')
            .single();

        if (error) {
            v2log.appointment.insertError({ error, workspaceId });
            return { success: false, error: error.message || 'Appointment insert failed', supabaseCode: error.code };
        }

        v2log.appointment.insertSuccess({ appointmentId: inserted.id });

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

        const calendarVisible = !visError && !!visible;
        v2log.appointment.calendarVisibility({ visible: calendarVisible, error: visError, date, startOfMonth, endOfMonth });

        return { success: true, appointmentId: inserted.id, calendarVisible };
    } catch (err: any) {
        const message = err?.message || String(err);
        v2log.error('V2_APPOINTMENTS_CREATE', 'Unexpected error during appointment creation', { err, workspaceId });
        return { success: false, error: message };
    }
}

export async function createAppointmentV2(input: CreateAppointmentInput): Promise<string | null> {
    const result = await createAppointmentInternal(input);
    return result.success ? result.appointmentId || null : null;
}

export async function createAppointmentV2Structured(input: CreateAppointmentInput): Promise<CreateAppointmentResult> {
    return createAppointmentInternal(input);
}
