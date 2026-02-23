import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
    try {
        const { amount, user_id } = await req.json();

        if (!amount || !user_id) {
            return NextResponse.json(
                { error: 'Missing amount or user_id' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // Verify user is authenticated
        const { data: { user } } = await supabase.auth.getUser();

        // Quick safeguard, usually we rely on RLS but it's good to double check
        if (!user || user.id !== user_id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Insert pending transaction
        const { data, error } = await supabase
            .from('transactions')
            .insert({
                user_id,
                amount,
                status: 'pending',
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
