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

        const isProd = process.env.NODE_ENV === 'production';
        const baseUrl = isProd 
            ? 'https://api.whish.money/itel-service/api'
            : 'https://api.sandbox.whish.money/itel-service/api';

        const whishExternalId = Math.floor(Math.random() * 1000000000);

        const whishResponse = await fetch(`${baseUrl}/payment/whish`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'channel': '10199608',
                'secret': '66023dabdc584a00b26d8dd4916633f5',
                'websiteUrl': 'ghostagent.qzz.io',
                'User-Agent': 'Whish/1.0 (https://whish.money; support@whish.money)'
            },
            body: JSON.stringify({
                amount: amount.toString(),
                currency: 'USD',
                invoice: `GhostAgent ${plan_name || 'Pro Agent'} Subscription`,
                externalId: whishExternalId,
                successCallbackUrl: `https://ghostagent.qzz.io/api/webhooks/whish?transaction_id=${data.id}&status=success`,
                failureCallbackUrl: `https://ghostagent.qzz.io/api/webhooks/whish?transaction_id=${data.id}&status=failed`,
                successRedirectUrl: `https://ghostagent.qzz.io/dashboard?payment=success`,
                failureRedirectUrl: `https://ghostagent.qzz.io/checkout?user_id=${user_id}&amount=${amount}&plan=${plan_name}&error=payment_failed`
            })
        });

        const whishJson = await whishResponse.json();

        if (whishJson.status !== true || !whishJson.data || !whishJson.data.collectUrl) {
            console.error('Whish API Error:', whishJson);
            return NextResponse.json({ error: 'Failed to generate payment link from Whish' }, { status: 500 });
        }

        const checkoutUrl = whishJson.data.collectUrl;

        return NextResponse.json({ checkout_url: checkoutUrl, transaction: data });
    } catch (error: any) {
        console.error('Checkout error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
