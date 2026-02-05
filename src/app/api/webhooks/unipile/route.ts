import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log('=== UNIPILE WEBHOOK RECEIVED ===');
        console.log('Event Type:', body.event);
        console.log('Full Body:', JSON.stringify(body, null, 2));

        // Handle account.created event
        if (body.event === 'account.created') {
            const { account_id, provider, name, username } = body.data;

            console.log('Account Created Data:', {
                account_id,
                provider,
                name,
                username
            });

            // Extract user_id from the 'name' field (we passed userId as name in connect route)
            const userId = name;

            if (!userId) {
                console.warn('❌ No user_id found in webhook data');
                return NextResponse.json({ status: 'ignored', reason: 'Missing user_id' });
            }

            console.log('Attempting to save for userId:', userId);

            const supabase = await createClient();

            // Insert or update connection
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

        // Log other events
        console.log('ℹ️ Ignoring event:', body.event);
        return NextResponse.json({ status: 'ignored', event: body.event });

    } catch (error: any) {
        console.error('Webhook processing error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
