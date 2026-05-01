import { SupabaseClient } from '@supabase/supabase-js';
import { timeToMinutes, minutesToTime } from '@/lib/automation-v2/time';
import { checkAvailability } from '@/lib/automation-v2/appointments/availability';
import { loadBusinessHours } from '@/lib/automation-v2/appointments/hours';

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

    // ── PART 2: Hard validation log ──────────────────────────
    console.log("[APPOINTMENT_SAVE_INPUT]", {
        workspaceId,
        userId,
        chatId,
        serviceName,
        date,
        startTime,
        customerName,
        customerPhone,
        source,
    });

    console.log("[APPOINTMENT_SAVE_VALIDATION]", {
        hasWorkspaceId: !!workspaceId,
        hasUserId: !!userId,
        hasChatId: !!chatId,
        hasServiceName: !!serviceName,
        hasDate: !!date,
        hasStartTime: !!startTime,
        hasCustomerName: !!customerName,
        hasCustomerPhone: !!customerPhone,
    });

    // 1. Hard pre-insert validation — block if any required field is missing
    const missing: string[] = [];
    if (!workspaceId) missing.push('workspaceId');
    if (!userId) missing.push('userId');
    if (!date) missing.push('date');
    if (!startTime) missing.push('startTime');
    if (!customerName?.trim()) missing.push('customerName');
    if (!customerPhone?.trim()) missing.push('customerPhone');
    if (!serviceName?.trim()) missing.push('serviceName');

    if (missing.length > 0) {
        console.error("[APPOINTMENT_SAVE_BLOCKED_MISSING_FIELDS]", {
            event: "appointment_create_blocked",
            reason: "missing_required_fields",
            missingFields: missing,
            input: { workspaceId, userId, date, startTime, customerName, customerPhone, serviceName },
        });
        return null;
    }

    try {
        // 2. Fetch service/duration context
        const { data: workspace } = await supabase
            .from('ai_settings')
            .select('slot_duration_minutes')
            .eq('id', workspaceId)
            .maybeSingle();
        
        const durationMinutes = workspace?.slot_duration_minutes || 60;
        const requestedStart = timeToMinutes(startTime);
        const requestedEnd = requestedStart + durationMinutes;
        const endTime = minutesToTime(requestedEnd);

        console.log("[APPOINTMENT_SAVE_TARGET]", {
            table: 'appointments',
            workspaceId,
            userId,
            date,
            startTime,
            endTime,
            durationMinutes,
            status: 'confirmed',
        });

        // 3. Re-validate availability (double-check before insert)
        const businessHours = await loadBusinessHours(supabase, workspaceId);
        const availability = await checkAvailability({
            supabase,
            workspaceId,
            date,
            startTime,
            durationMinutes,
            businessHours,
        });

        if (!availability.available) {
            console.error("[APPOINTMENT_SAVE_BLOCKED_UNAVAILABLE]", {
                event: "appointment_create_blocked",
                reason: availability.reason || "slot_unavailable",
                date,
                startTime,
            });
            return null;
        }

        // 4. Determine instagram_handle for display
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
                customer_name: customerName.trim(),
                customer_phone: customerPhone.trim(),
                service: serviceName.trim(),
                appointment_date: date,
                start_time: startTime,
                end_time: endTime,
                duration_minutes: durationMinutes,
                status: 'confirmed',
                notes: `Source: ${source}`
            })
            .select()
            .single();

        if (error) {
            console.error("[APPOINTMENT_SAVE_ERROR]", {
                event: "appointment_create_blocked",
                reason: "db_insert_error",
                input: { workspaceId, userId, date, startTime, customerName, customerPhone, serviceName },
                error,
            });
            return null;
        }

        console.log("[APPOINTMENT_SAVE_SUCCESS]", {
            event: "appointment_create_attempt",
            appointmentId: insertedAppointment.id,
            workspaceId,
            userId,
            chatId,
            serviceName,
            date,
            startTime,
            endTime,
            customerName,
            customerPhone,
            insertSuccess: true,
            insertedAppointmentId: insertedAppointment.id,
        });

        // ── PART 2: Visibility check — verify calendar can see this appointment ──
        try {
            const year = date.slice(0, 4);
            const month = date.slice(5, 7);
            const startOfMonth = `${year}-${month}-01`;
            const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
            const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

            const { data: visibleAppointments, error: visErr } = await supabase
                .from('appointments')
                .select('id, appointment_date, status, workspace_id')
                .eq('workspace_id', workspaceId)
                .gte('appointment_date', startOfMonth)
                .lte('appointment_date', endOfMonth);

            console.log("[APPOINTMENT_CALENDAR_VISIBILITY_CHECK]", {
                appointmentId: insertedAppointment.id,
                date,
                workspaceId,
                visibleCount: visibleAppointments?.length ?? 0,
                visibleIds: (visibleAppointments ?? []).map((a: any) => a.id),
                thisAppointmentVisible: (visibleAppointments ?? []).some((a: any) => a.id === insertedAppointment.id),
                visibilityError: visErr?.message ?? null,
            });

            if (!(visibleAppointments ?? []).some((a: any) => a.id === insertedAppointment.id)) {
                console.error("[APPOINTMENT_VISIBILITY_MISMATCH] Appointment saved but NOT visible through calendar query! Check: workspace_id, appointment_date format, status.", {
                    insertedAppointmentId: insertedAppointment.id,
                    insertedWorkspaceId: workspaceId,
                    insertedDate: date,
                    calendarFilterUsed: { startOfMonth, endOfMonth, workspace_id: workspaceId },
                });
            }
        } catch (visCheckErr) {
            console.warn("[APPOINTMENT_VISIBILITY_CHECK_ERROR]", visCheckErr);
        }

        // 6. Log automation event
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
                    endTime,
                    customerName,
                    customerPhone,
                    missingFields: [],
                    insertSuccess: true,
                    insertedAppointmentId: insertedAppointment.id
                }
            });
        } catch (e) {
            console.warn('[APPOINTMENT_EVENT_LOG_ERROR]', e);
        }

        return insertedAppointment;

    } catch (err) {
        console.error("[APPOINTMENT_SAVE_ERROR]", {
            event: "appointment_create_blocked",
            reason: "unexpected_exception",
            input: { workspaceId, userId, date, startTime, customerName, customerPhone, serviceName },
            error: err,
        });
        return null;
    }
}
