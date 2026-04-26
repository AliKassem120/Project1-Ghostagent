import { SupabaseClient } from '@supabase/supabase-js';
import { 
    checkAppointmentAvailability, 
    timeToMinutes, 
    minutesToTime 
} from '@/utils/brains/appointments/tools';

export async function createAppointmentBooking(input: {
    supabase: SupabaseClient;
    workspaceId: string;
    userId: string;
    chatId: string;
    serviceId?: string;
    serviceName: string;
    customerName: string;
    customerPhone: string;
    date: string; // YYYY-MM-DD
    startTime: string; // HH:mm
    timezone: string;
    source: "instagram" | "manual" | "automation";
}) {
    const { 
        supabase, workspaceId, userId, chatId, serviceName, 
        customerName, customerPhone, date, startTime, source 
    } = input;

    console.log("[APPOINTMENT_CREATE_ATTEMPT]", { 
        workspaceId,
        chatId,
        serviceName,
        date,
        startTime,
        endTime: minutesToTime(timeToMinutes(startTime) + 60), // placeholder until duration is fetched
        customerName,
        customerPhone,
    });

    // 1. Basic validation
    if (!workspaceId || !userId || !date || !startTime || !customerName || !customerPhone) {
        console.error("[APPOINTMENT_CREATE_ERROR] Missing required fields", { workspaceId, userId, date, startTime, customerName, customerPhone });
        return null;
    }


    try {
        // 2. Fetch service/duration context if needed
        // (In this shared lib, we assume validation was mostly done by the caller, but let's be safe)
        const { data: workspace } = await supabase
            .from('ai_settings')
            .select('slot_duration_minutes')
            .eq('id', workspaceId)
            .maybeSingle();
        
        const durationMinutes = workspace?.slot_duration_minutes || 60;

        // 3. Re-validate availability (Double check)
        const availability = await checkAppointmentAvailability({
            supabase,
            userId,
            workspaceId,
            date,
            durationMinutes
        });

        if (availability.error || availability.closed) {
            console.error("[APPOINTMENT_CREATE_ERROR] Business closed or availability error", availability);
            return null;
        }


        const requestedStart = timeToMinutes(startTime);
        const requestedEnd = requestedStart + durationMinutes;

        const isAvailable = availability.slots.some(s => {
            const sStart = timeToMinutes(s.time);
            const sEnd = timeToMinutes(s.end_time);
            return requestedStart >= sStart && requestedEnd <= sEnd;
        });

        if (!isAvailable) {
            console.error("[APPOINTMENT_CREATE_ERROR] Slot unavailable or outside hours", { startTime, durationMinutes, slots: availability.slots });
            return null;
        }


        // 4. Determine handle/username
        let instagram_handle = 'Customer';
        if (chatId) {
            const { data: lastMsg } = await supabase
                .from('activity_log')
                .select('metadata')
                .eq('user_id', userId)
                .filter('metadata->>chat_id', 'eq', chatId)
                .order('timestamp', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (lastMsg?.metadata?.username) instagram_handle = lastMsg.metadata.username;
        }

        // 5. Insert into appointments table
        const { data: insertedAppointment, error } = await supabase
            .from('appointments')
            .insert({
                user_id: userId,
                workspace_id: workspaceId,
                instagram_user_id: chatId || null,
                instagram_handle,
                customer_name: customerName,
                customer_phone: customerPhone,
                service: serviceName,
                appointment_date: date,
                start_time: startTime,
                end_time: minutesToTime(requestedEnd),
                duration_minutes: durationMinutes,
                status: 'confirmed',
                notes: `Source: ${source}`
            })
            .select()
            .single();

        if (error) {
            console.error("[APPOINTMENT_CREATE_ERROR] DB Insert failed", error);
            return null;
        }

        console.log("[APPOINTMENT_CREATE_SUCCESS]", {
            appointmentId: insertedAppointment.id,
            workspaceId,
            date,
            startTime,
        });


        try {
            await supabase.from('automation_events').insert({
                user_id: userId,
                workspace_id: workspaceId,
                chat_id: chatId,
                workspace_type: 'appointments',
                intent: 'appointment_created',
                payload: {
                    event: "appointment_create_attempt",
                    workspaceId,
                    chatId,
                    serviceName,
                    date,
                    startTime,
                    endTime: minutesToTime(requestedEnd),
                    hasCustomerName: !!customerName,
                    hasCustomerPhone: !!customerPhone,
                    insertSuccess: true,
                    insertedAppointmentId: insertedAppointment.id
                }
            });
        } catch (e) {
            console.warn('Event log error:', e);
        }

        try {
            await supabase.from('orders').insert({
                user_id: userId,
                workspace_id: workspaceId,
                instagram_user_id: chatId || null,
                instagram_handle,
                status: 'Confirmed',
                customer_name: customerName,
                customer_phone: customerPhone,
                item_requested: serviceName,
                raw_message: JSON.stringify({ appointment_id: insertedAppointment.id, date, startTime }),
            });
        } catch (e) {
            console.warn('Orders mirror error:', e);
        }

        return insertedAppointment;

    } catch (err) {
        console.error("[CREATE_APPOINTMENT_ERROR] Unexpected exception", err);
        return null;
    }
}
