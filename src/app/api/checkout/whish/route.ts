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

        // ─── Whish API Integration ───
        // externalId must be a safe integer (max 9 digits for safety)
        const externalId = Math.floor(Math.random() * 999999999);

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ghostagent.qzz.io';
        const channel = process.env.WHISH_CHANNEL || '10199608';
        const secret = process.env.WHISH_SECRET || '66023dabdc584a00b26d8dd4916633f5';
        const websiteUrl = process.env.WHISH_WEBSITE_URL || 'ghostagent.qzz.io';
        const isProduction = process.env.WHISH_ENV === 'production';
        const whishBaseUrl = isProduction
            ? 'https://api.whish.money/itel-service/api/payment/whish'
            : 'https://api.sandbox.whish.money/itel-service/api/payment/whish';

        const whishPayload = {
            amount: Number(amount),           // Must be a number, not string
            currency: 'USD',
            invoice: plan_name || 'Pro Agent',
            externalId,
            successCallbackUrl: `${appUrl}/api/webhooks/whish?status=success&transaction_id=${data.id}`,
            failureCallbackUrl: `${appUrl}/api/webhooks/whish?status=failed&transaction_id=${data.id}`,
            successRedirectUrl: `${appUrl}/dashboard/billing?payment=success&transaction_id=${data.id}`,
            failureRedirectUrl: `${appUrl}/dashboard/billing?payment=failed&transaction_id=${data.id}`
        };

        console.log('[Whish Checkout] Sending request:', {
            url: whishBaseUrl,
            channel,
            websiteUrl,
            payload: whishPayload,
        });

        const whishResponse = await fetch(whishBaseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'channel': channel,
                'secret': secret,
                'websiteUrl': websiteUrl,
            },
            body: JSON.stringify(whishPayload)
        });

        const responseText = await whishResponse.text();
        console.log('[Whish Checkout] Raw response:', responseText);

        let whishData: any;
        try {
            whishData = JSON.parse(responseText);
        } catch {
            console.error('[Whish Checkout] Non-JSON response:', responseText);
            return NextResponse.json({ error: 'Payment gateway returned invalid response', raw: responseText }, { status: 500 });
        }

        if (!whishData.status || !whishData.data?.collectUrl) {
            console.error('[Whish Checkout] API Failed:', whishData);
            return NextResponse.json({
                error: whishData?.dialog?.message || 'Payment gateway failed',
                details: whishData
            }, { status: 500 });
        }

        return NextResponse.json({ checkout_url: whishData.data.collectUrl, transaction: data });
    } catch (error: any) {
        console.error('[Whish Checkout] Exception:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
