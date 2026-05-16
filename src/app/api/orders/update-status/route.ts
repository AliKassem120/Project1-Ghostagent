/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Order Status Update API
 * ═══════════════════════════════════════════════════════════════
 * Called from the dashboard when a business owner updates an
 * order's status (pending → shipped → delivered).
 * Automatically triggers WhatsApp notifications to the customer.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getWorkspaceWhatsAppCreds, notifyOrderShipped, notifyOrderDelivered, notifyReviewRequest } from '@/lib/whatsapp/notifications';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { orderId, newStatus, trackingLink } = await req.json();

        if (!orderId || !newStatus) {
            return NextResponse.json({ error: 'Missing orderId or newStatus' }, { status: 400 });
        }

        // 1. Fetch the order
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (fetchError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // 2. Update the status
        const { error: updateError } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId);

        if (updateError) {
            return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
        }

        // 3. Send WhatsApp notification (if customer has a phone number)
        let notificationSent = false;
        const customerPhone = order.customer_phone;

        if (customerPhone && order.workspace_id) {
            const creds = await getWorkspaceWhatsAppCreds(supabase, order.workspace_id);

            if (creds) {
                const itemDesc = order.item_requested || 'your order';

                try {
                    switch (newStatus) {
                        case 'shipped':
                            await notifyOrderShipped(creds, customerPhone, itemDesc, trackingLink || 'Contact us for tracking info');
                            notificationSent = true;
                            break;

                        case 'delivered':
                            await notifyOrderDelivered(creds, customerPhone, itemDesc);
                            notificationSent = true;

                            // Schedule a review request for 3 days later
                            // (In production, use a cron job. For now, we'll skip the delay.)
                            break;
                    }
                } catch (notifErr) {
                    console.error('❌ [Order Status] WhatsApp notification failed:', notifErr);
                }
            }
        }

        // 4. Log the status change
        await supabase.from('activity_log').insert({
            user_id: user.id,
            workspace_id: order.workspace_id,
            event_type: 'ORDER_STATUS_UPDATE',
            description: `Order ${orderId.slice(-6)} → ${newStatus}${notificationSent ? ' (WhatsApp sent)' : ''}`,
            timestamp: new Date().toISOString(),
            metadata: {
                order_id: orderId,
                old_status: order.status,
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
        console.error('❌ [Order Status] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
