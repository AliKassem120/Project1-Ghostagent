import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use the Service Role Key here to bypass row level security for checkout requests that happen right after signup (before email verification).
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
    try {
        const { amount, user_id, plan_name } = await req.json();

        if (!amount || !user_id) {
            return NextResponse.json(
                { error: 'Missing amount or user_id' },
                { status: 400 }
            );
        }

        // Insert pending transaction with admin client to bypass RLS (user might not be logged in yet due to email verification)
        const { data, error } = await supabaseAdmin
            .from('transactions')
            .insert({
                user_id,
                amount,
                status: 'pending',
                plan_name: plan_name || 'Pro Agent'
            })
            .select()
            .single();

        if (error) {
            console.error('Error inserting transaction:', error);
            return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
        }

        // Mock Whish checkout URL (in reality, you'd get this from Whish API)
        const mockCheckoutUrl = `https://ghostagent.qzz.io/mock-checkout?transaction_id=${data.id}`;

        return NextResponse.json({ checkout_url: mockCheckoutUrl, transaction: data });
    } catch (error: any) {
        console.error('Checkout error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
