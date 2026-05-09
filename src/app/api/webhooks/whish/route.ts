import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tierFromName } from '@/lib/plans';

// Use the Service Role Key here to bypass row level security for incoming webhooks.
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Core webhook handler — processes both GET (redirect callback) and POST (API callback).
 * Whish Money calls the successCallbackUrl, which may be a GET redirect or POST.
 * We embed transaction_id and status in the query string to handle both cases.
 */
async function handleWebhook(req: NextRequest): Promise<NextResponse> {
    try {
        // 1. Extract params from query string (primary — always available)
        const url = new URL(req.url);
        let transaction_id = url.searchParams.get('transaction_id');
        let status = url.searchParams.get('status');
        let whish_reference_id: string | null = url.searchParams.get('whish_reference_id');

        // 2. If not in query string, try JSON body (for direct POST calls)
        if ((!transaction_id || !status) && req.method === 'POST') {
            try {
                const body = await req.json();
                transaction_id = transaction_id || body.transaction_id;
                status = status || body.status;
                whish_reference_id = whish_reference_id || body.whish_reference_id || null;
            } catch {
                // Body might not be JSON — that's okay, we have query params
            }
        }

        console.log('[Whish Webhook]', { method: req.method, transaction_id, status, whish_reference_id });

        if (!transaction_id || !status) {
            return NextResponse.json({ error: 'Missing transaction_id or status' }, { status: 400 });
        }

        // Validate status
        if (!['success', 'failed'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        // Update transaction
        const { data: transaction, error } = await supabaseAdmin
            .from('transactions')
            .update({
                status,
                whish_reference_id: whish_reference_id || null
            })
            .eq('id', transaction_id)
            .select('*')
            .single();

        if (error || !transaction) {
            console.error('[Whish Webhook] Error updating transaction:', error);
            return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
        }

        // If success, update the user's plan tier!
        if (status === 'success' && transaction.user_id) {
            const plan_name = transaction.plan_name || 'Pro Agent';

            // Use centralized plan name → tier mapping
            const dbTier = tierFromName(plan_name);

            console.log('[Whish Webhook] Upgrading user', { userId: transaction.user_id, dbTier, plan_name, transaction_id });

            const { error: userError } = await supabaseAdmin
                .from('users')
                .update({
                    plan_tier: dbTier,
                    // Give them 30 days of access
                    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    // Clear any pending downgrade since user just paid for a new plan
                    cancel_at_period_end: false,
                    next_plan_tier: null,
                })
                .eq('id', transaction.user_id);

            if (userError) {
                console.error('[Whish Webhook] Error updating user plan:', userError);
                // We don't fail the webhook response because the payment succeeded, but we log the error.
            } else {
                console.log('[Whish Webhook] ✅ Plan upgraded successfully to', dbTier);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Whish Webhook] Error:', error.message);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Handle both GET (redirect callback) and POST (API callback)
export async function GET(req: NextRequest) {
    return handleWebhook(req);
}

export async function POST(req: NextRequest) {
    return handleWebhook(req);
}
