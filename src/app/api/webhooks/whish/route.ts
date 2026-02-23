import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use the Service Role Key here to bypass row level security for incoming webhooks.
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
    try {
        const payload = await req.json();
        const { transaction_id, status, whish_reference_id } = payload;

        if (!transaction_id || !status) {
            return NextResponse.json({ error: 'Missing transaction_id or status' }, { status: 400 });
        }

        // Validate status
        if (!['success', 'failed'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        // Update transaction
        const { error } = await supabaseAdmin
            .from('transactions')
            .update({
                status,
                whish_reference_id: whish_reference_id || null
            })
            .eq('id', transaction_id);

        if (error) {
            console.error('Error updating transaction:', error);
            return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Webhook error:', error.message);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
