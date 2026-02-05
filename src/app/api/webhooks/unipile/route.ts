import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log('Unipile Webhook Event:', body.event, body.data);

        // Handle account.created event
        if (body.event === 'account.created') {
            const { account_id, provider, name, username } = body.data;

            // Extract user_id from the 'name' field (we passed userId as name in connect route)
            const userId = name; // This is the userId we sent in the connect request

            if (!userId) {
                console.warn('No user_id found in webhook data');
                return NextResponse.json({ status: 'ignored', reason: 'Missing user_id' });
            }

            const supabase = await createClient();

            // Insert or update connection
            const { error } = await supabase
                .from('user_connections')
                .upsert({
                    user_id: userId,
                    provider: provider,
                    account_id: account_id,
                    account_username: username || null,
                    metadata: body.data // Store full webhook data
                }, {
                    onConflict: 'user_id,provider' // Update if already exists
                });

            if (error) {
                console.error('Failed to save connection:', error);
                return NextResponse.json({ error: 'Database error' }, { status: 500 });
            }

            console.log(`✓ Saved connection for user ${userId}: ${provider} (${username || account_id})`);
            return NextResponse.json({ status: 'success', message: 'Connection saved' });
        }

        // Acknowledge other events but don't process
        return NextResponse.json({ status: 'ignored', event: body.event });

    } catch (error: any) {
        console.error('Webhook processing error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
