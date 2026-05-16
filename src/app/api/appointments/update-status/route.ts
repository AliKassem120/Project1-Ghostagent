/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Appointment Status Update API
 * ═══════════════════════════════════════════════════════════════
 * Called from the dashboard when a business owner updates an
 * appointment's status. Triggers WhatsApp confirmation/reminder.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getWorkspaceWhatsAppCreds, notifyAppointmentConfirmed, notifyAppointmentReminder } from '@/lib/whatsapp/notifications';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { appointmentId, newStatus } = await req.json();

        if (!appointmentId || !newStatus) {
            return NextResponse.json({ error: 'Missing appointmentId or newStatus' }, { status: 400 });
        }

        // 1. Fetch the appointment
        const { data: appt, error: fetchError } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', appointmentId)
            .single();

        if (fetchError || !appt) {
            return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
        }

        // 2. Update the status
        const { error: updateError } = await supabase
            .from('appointments')
            .update({ status: newStatus })
            .eq('id', appointmentId);

        if (updateError) {
            return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 });
        }

        // 3. Send WhatsApp notification
        let notificationSent = false;
        const customerPhone = appt.customer_phone;

        if (customerPhone && appt.workspace_id) {
            const creds = await getWorkspaceWhatsAppCreds(supabase, appt.workspace_id);

            if (creds) {
                const serviceName = appt.service_name || 'Appointment';
                const date = appt.date || '';
                const time = appt.start_time || '';
                const price = appt.price?.toString() || '0';

                try {
                    switch (newStatus) {
                        case 'confirmed':
                            await notifyAppointmentConfirmed(creds, customerPhone, serviceName, date, time, price);
                            notificationSent = true;
                            break;

                        case 'reminder':
                            await notifyAppointmentReminder(creds, customerPhone, serviceName, time);
                            notificationSent = true;
                            break;
                    }
                } catch (notifErr) {
                    console.error('❌ [Appointment Status] WhatsApp notification failed:', notifErr);
                }
            }
        }

        // 4. Log the status change
        await supabase.from('activity_log').insert({
            user_id: user.id,
            workspace_id: appt.workspace_id,
            event_type: 'APPOINTMENT_STATUS_UPDATE',
            description: `Appointment ${appointmentId.slice(-6)} → ${newStatus}${notificationSent ? ' (WhatsApp sent)' : ''}`,
            timestamp: new Date().toISOString(),
            metadata: {
                appointment_id: appointmentId,
                old_status: appt.status,
                new_status: newStatus,
                customer_phone: customerPhone,
                notification_sent: notificationSent,
            },
        });

        return NextResponse.json({
            success: true,
            newStatus,
            notificationSent,
        });

    } catch (e: any) {
        console.error('❌ [Appointment Status] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
