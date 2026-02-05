import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateGhostReply } from '@/utils/ghost-brain';

// Create a Supabase client with the SERVICE ROLE key to bypass RLS
const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

    if (!supabaseServiceKey) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    }

    return createClient(supabaseUrl, supabaseServiceKey);
}

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

        // Initialize admin client lazily to avoid build-time errors
        const supabaseAdmin = getSupabaseAdmin();

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

        // Handle message.received
        // Handle message_received (Unipile sends user message)
        if (body.event === 'message_received') {
            const { account_id, message, sender, chat_id } = body;
            const text = message;

            console.log('📩 Message Received for account:', account_id);

            // 1. Find the user who owns this account
            const { data: connection } = await supabaseAdmin
                .from('user_connections')
                .select('user_id')
                .eq('account_id', account_id)
                .single();

            if (!connection) {
                console.warn('⚠️ Received message for unknown account:', account_id);
                return NextResponse.json({ status: 'ignored', reason: 'Unknown account' });
            }

            // 2. Log activity
            try {
                const { error: insertError } = await supabaseAdmin.from('activity_log').insert({
                    user_id: connection.user_id,
                    event_type: 'INCOMING_DM',
                    description: `Received: "${text?.substring(0, 50) || '(No Text)'}${text?.length > 50 ? '...' : ''}" from ${sender?.attendee_name || 'Unknown'}`,
                    metadata: body,
                    timestamp: new Date().toISOString()
                });

                if (insertError) throw insertError;
            } catch (e) {
                console.error('Error logging DM:', e);
            }

            console.log('✅ Logged DM activity for user:', connection.user_id);

            // 3. AUTO-REPLY (The Ghost)
            if (body.is_sender === false) {
                console.log('🤖 Generating Ghost Reply...');
                try {
                    const replyText = await generateGhostReply(connection.user_id, text || '', supabaseAdmin);

                    if (replyText) {
                        console.log('👻 Ghost says:', replyText);
                        const unipileKey = process.env.UNIPILE_API_KEY;
                        if (unipileKey && chat_id) {
                            const sendRes = await fetch(`https://api23.unipile.com:15397/api/v1/chats/${chat_id}/messages`, {
                                method: 'POST',
                                headers: {
                                    'X-API-KEY': unipileKey,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ text: replyText })
                            });

                            if (sendRes.ok) {
                                console.log('✅ Reply sent');
                                // Log the reply
                                await supabaseAdmin.from('activity_log').insert({
                                    user_id: connection.user_id,
                                    event_type: 'AI_REPLY',
                                    description: `Sent: "${replyText.substring(0, 50)}..."`,
                                    timestamp: new Date().toISOString()
                                });
                            } else {
                                const errData = await sendRes.text();
                                console.error('❌ Failed to send Unipile message:', errData);
                            }
                        }
                    }
                } catch (replyError) {
                    console.error('Auto-reply failed:', replyError);
                }
            }

            return NextResponse.json({ status: 'success', message: 'Message processed and replied' });
        }

        // Handle other message events (ignore to prevent log noise)
        if (body.event === 'message_sent' || body.event === 'message_read') {
            return NextResponse.json({ status: 'acknowledged' });
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
