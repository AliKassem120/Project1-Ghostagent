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

        // ─── Real Whish API Integration ───
        const numericId = Date.now(); // Whish requires a Long externalId

        // Make sure to pass the actual transaction ID in the callback so the webhook can process it
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ghostagent.qzz.io';
        
        const whishPayload = {
            amount: amount.toString(),
            currency: "USD",
            invoice: plan_name || 'Pro Agent',
            externalId: numericId,
            successCallbackUrl: `${appUrl}/api/webhooks/whish?status=success&transaction_id=${data.id}`,
            failureCallbackUrl: `${appUrl}/api/webhooks/whish?status=failure&transaction_id=${data.id}`,
            successRedirectUrl: `${appUrl}/dashboard/billing?payment=success&transaction_id=${data.id}`,
            failureRedirectUrl: `${appUrl}/dashboard/billing?payment=failed&transaction_id=${data.id}`
        };

        const whishResponse = await fetch('https://api.sandbox.whish.money/itel-service/api/payment/whish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'channel': process.env.WHISH_CHANNEL || '10199608',
                'secret': process.env.WHISH_SECRET || '66023dabdc584a00b26d8dd4916633f5',
                'websiteUrl': process.env.WHISH_WEBSITE_URL || 'ghostagent.qzz.io',
                'User-Agent': 'GhostAgent/1.0 (https://ghostagent.qzz.io; admin@ghostagent.qzz.io)'
            },
            body: JSON.stringify(whishPayload)
        });

        if (!whishResponse.ok) {
            const errText = await whishResponse.text();
            console.error('Whish API Error:', errText);
            return NextResponse.json({ error: 'Payment gateway error' }, { status: 500 });
        }

        const whishData = await whishResponse.json();
        
        if (!whishData.status || !whishData.data || !whishData.data.collectUrl) {
            console.error('Whish API Failed:', whishData);
            return NextResponse.json({ error: 'Payment gateway failed to return URL', details: whishData }, { status: 500 });
        }

        const checkoutUrl = whishData.data.collectUrl;

        return NextResponse.json({ checkout_url: checkoutUrl, transaction: data });
    } catch (error: any) {
        console.error('Checkout error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
