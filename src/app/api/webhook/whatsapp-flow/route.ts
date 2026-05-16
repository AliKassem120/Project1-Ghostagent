/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — WhatsApp Flow Callback Handler
 * ═══════════════════════════════════════════════════════════════
 * Receives data when a customer completes a WhatsApp Flow form
 * (e.g., booking form) and processes the submission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    return createClient(url, key);
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log('📋 [Flow Callback] Received:', JSON.stringify(body));

        const { flow_token, screen_id, response } = body;

        if (!response) {
            return NextResponse.json({ success: false, error: 'No response data' }, { status: 400 });
        }

        const supabase = getAdmin();

        // Parse the flow token to identify what kind of flow this is
        if (flow_token?.startsWith('booking_')) {
            // This is a booking flow completion
            const { customer_name, customer_phone, booking_date, booking_time, notes, service_name } = response;

            if (!customer_name || !customer_phone || !booking_date || !booking_time) {
                return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
            }

            // Extract service name from flow data or use default
            const serviceName = service_name || 'Appointment';

            // Look up the workspace from the flow context
            // (In production, encode workspace_id in the flow_token)
            console.log(`📅 [Flow Callback] Booking: ${customer_name} - ${serviceName} on ${booking_date} at ${booking_time}`);

            return NextResponse.json({
                success: true,
                action: 'booking_received',
                data: {
                    customer_name,
                    customer_phone,
                    booking_date,
                    booking_time,
                    notes,
                    service_name: serviceName,
                },
            });
        }

        return NextResponse.json({ success: true, action: 'unknown_flow' });

    } catch (e: any) {
        console.error('❌ [Flow Callback] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
