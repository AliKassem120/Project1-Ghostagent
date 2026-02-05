import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with the SERVICE ROLE key to bypass RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

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

        // Handle CREATION_SUCCESS webhook (contains user_id in name field)
        if (body.status === 'CREATION_SUCCESS') {
            const { account_id, name } = body;
            const userId = name; // This is the user_id we passed in connect route

            console.log('✅ Creation Success - Saving connection:', {
                account_id,
                userId
            });

            if (!userId) {
                console.warn('❌ No user_id in CREATION_SUCCESS');
                return NextResponse.json({ status: 'acknowledged' });
            }

            // const supabase = await createClient();

            const { data, error } = await supabaseAdmin
                .from('user_connections')
                .upsert({
                    user_id: userId,
                    account_id: account_id,
                    provider: 'INSTAGRAM',
                    account_username: null, // Will be populated by status endpoint
                    metadata: body,
                    connected_at: new Date().toISOString()
                }, {
                    onConflict: 'account_id'
                })
                .select();

            if (error) {
                console.error('❌ Failed to save connection:', error);
                return NextResponse.json({
                    status: 'error',
                    error: error.message
                }, { status: 500 });
            }

            console.log('✅ Saved connection with user_id:', data);
            return NextResponse.json({
                status: 'success',
                message: 'Connection saved',
                data
            });
        }

        // Unipile sends AccountStatus updates
        if (body.AccountStatus) {
            const { account_id, message, account_type } = body.AccountStatus;

            console.log('Account Status Update:', {
                account_id,
                status: message,
                account_type
            });

            // Update existing connection when fully connected
            if (message === 'CONNECTED') {
                console.log('✅ Account fully connected, updating...');

                // const supabase = await createClient();

                const { data, error } = await supabaseAdmin
                    .from('user_connections')
                    .update({
                        metadata: body.AccountStatus
                    })
                    .eq('account_id', account_id)
                    .select();

                if (error) {
                    console.warn('⚠️ Could not update connection status:', error);
                } else {
                    console.log('✅ Updated connection status:', data);
                }
            }

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

            // const supabase = await createClient();

            const { data, error } = await supabaseAdmin
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
        return NextResponse.json({ status: 'acknowledged' });

    } catch (error: any) {
        console.error('Webhook processing error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
