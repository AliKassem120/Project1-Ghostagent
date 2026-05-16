/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automated Review Collection Worker
 * ═══════════════════════════════════════════════════════════════
 * Triggered via CRON. Finds orders marked 'delivered' 3+ days ago
 * and sends the WhatsApp review_request template.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getWorkspaceWhatsAppCreds, notifyReviewRequest } from '@/lib/whatsapp/notifications';

// Use Edge runtime or Node.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const supabase = await createClient();

        // Security check for cron secret in production
        const authHeader = req.headers.get('authorization');
        if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Find all delivered orders that are older than 3 days
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const { data: deliveredOrders, error: orderError } = await supabase
            .from('orders')
            .select('id, workspace_id, customer_phone, customer_name, item_requested, created_at')
            .eq('status', 'delivered')
            .lte('created_at', threeDaysAgo.toISOString());

        if (orderError) throw orderError;
        if (!deliveredOrders || deliveredOrders.length === 0) {
            return NextResponse.json({ success: true, message: 'No eligible orders found' });
        }

        // 2. Fetch activity logs to see which ones already got a review request
        const orderIds = deliveredOrders.map(o => o.id);
        const { data: logs } = await supabase
            .from('activity_log')
            .select('metadata')
            .eq('event_type', 'REVIEW_REQUEST_SENT')
            .in('metadata->>order_id', orderIds);

        const alreadySentOrderIds = new Set(logs?.map(l => l.metadata.order_id) || []);

        let sentCount = 0;

        // 3. Loop through and send
        for (const order of deliveredOrders) {
            if (alreadySentOrderIds.has(order.id) || !order.customer_phone || !order.workspace_id) {
                continue;
            }

            const creds = await getWorkspaceWhatsAppCreds(supabase, order.workspace_id);
            if (!creds) continue;

            try {
                // Send WhatsApp Template
                await notifyReviewRequest(
                    creds, 
                    order.customer_phone, 
                    order.customer_name || 'Customer',
                    order.item_requested || 'your recent purchase'
                );

                // Log it so we don't send again
                await supabase.from('activity_log').insert({
                    workspace_id: order.workspace_id,
                    event_type: 'REVIEW_REQUEST_SENT',
                    description: `Automated review request sent via WhatsApp`,
                    timestamp: new Date().toISOString(),
                    metadata: { order_id: order.id, customer_phone: order.customer_phone }
                });

                sentCount++;
            } catch (err) {
                console.error(`Failed to send review request for order ${order.id}:`, err);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${deliveredOrders.length} orders. Sent ${sentCount} review requests.`,
            sentCount
        });

    } catch (e: any) {
        console.error('❌ [Automated Reviews Worker] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
