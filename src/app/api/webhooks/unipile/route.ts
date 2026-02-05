import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// GET handler for testing
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        message: 'Unipile webhook endpoint is ready',
        timestamp: new Date().toISOString()
    });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log('=== UNIPILE WEBHOOK RECEIVED ===');
        console.log('Full Body:', JSON.stringify(body, null, 2));

        // Unipile sends AccountStatus updates
        if (body.AccountStatus) {
            const { account_id, message, account_type } = body.AccountStatus;

            console.log('Account Status Update:', {
                account_id,
                status: message,
                account_type
            });

            // Only save when account is fully connected
            if (message === 'CONNECTED') {
                console.log('✅ Account connected, attempting to save...');

                // We need to get the user_id from somewhere
                // Since we don't have it in the webhook, we'll need to look it up or use a different approach
                // For now, let's try to use the account_id to find existing connection or create with service role

                const supabase = await createClient();

                // Try to save with account_id only, we'll update user_id later via status endpoint
                const { data, error } = await supabase
                    .from('user_connections')
                    .upsert({
                        account_id: account_id,
                        provider: account_type,
                        account_username: null, // We don't have username in this webhook
                        metadata: body.AccountStatus,
                        connected_at: new Date().toISOString()
                    }, {
                        onConflict: 'account_id',
                        ignoreDuplicates: false
                    })
                    .select();

                if (error) {
                    console.error('❌ Failed to save connection:', error);
                    return NextResponse.json({
                        status: 'error',
                        error: error.message
                    }, { status: 500 });
                }

                console.log('✅ Saved connection successfully:', data);
                return NextResponse.json({
                    status: 'success',
                    message: 'Connection saved',
                    data
                });
            }

            console.log('ℹ️ Status is not CONNECTED yet, ignoring');
            return NextResponse.json({ status: 'acknowledged', message });
        }

        // Handle old-style events if they exist
        if (body.event === 'account.created') {
            const { account_id, provider, name, username } = body.data;
            const userId = name;

            if (!userId) {
                console.warn('❌ No user_id found in webhook data');
                return NextResponse.json({ status: 'ignored', reason: 'Missing user_id' });
            }

            const supabase = await createClient();

            const { data, error } = await supabase
                .from('user_connections')
                .upsert({
                    user_id: userId,
                    provider: provider,
                    account_id: account_id,
                    account_username: username || null,
                    metadata: body.data
                }, {
                    onConflict: 'user_id,provider'
                })
                .select();

            if (error) {
                console.error('❌ Failed to save connection:', error);
                return NextResponse.json({ error: 'Database error', details: error }, { status: 500 });
            }

            console.log('✅ Saved connection successfully:', data);
            return NextResponse.json({ status: 'success', message: 'Connection saved', data });
        }

        // Unknown webhook type
        console.log('ℹ️ Unknown webhook structure');
        return NextResponse.json({ status: 'ignored', reason: 'Unknown webhook type' });

    } catch (error: any) {
        console.error('Webhook processing error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
