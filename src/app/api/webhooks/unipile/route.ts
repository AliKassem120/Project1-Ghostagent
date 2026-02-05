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
        // console.log('Full Body:', JSON.stringify(body, null, 2));

        // Initialize admin client lazily
        const supabaseAdmin = getSupabaseAdmin();

        // Handle CREATION_SUCCESS webhook (contains user_id in name field)
        if (body.status === 'CREATION_SUCCESS') {
            const { account_id, name } = body;
            const userId = name; // This is the user_id we passed in connect route

            console.log('✅ Creation Success - Saving connection:', { account_id, userId });

            if (!userId) {
                console.warn('❌ No user_id in CREATION_SUCCESS');
                return NextResponse.json({ status: 'acknowledged' });
            }

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
                return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
            }

            console.log('✅ Saved connection with user_id:', data);
            return NextResponse.json({ status: 'success', message: 'Connection saved', data });
        }

        // Unipile sends AccountStatus updates
        if (body.AccountStatus) {
            const { account_id, message, account_type } = body.AccountStatus;

            console.log('Account Status Update:', { account_id, status: message, account_type });

            // Update existing connection when fully connected
            if (message === 'CONNECTED') {
                console.log('✅ Account fully connected, updating...');
                const { data, error } = await supabaseAdmin
                    .from('user_connections')
                    .update({ metadata: body.AccountStatus })
                    .eq('account_id', account_id)
                    .select();

                if (error) console.warn('⚠️ Could not update connection status:', error);
                else console.log('✅ Updated connection status:', data);
            }

            return NextResponse.json({ status: 'acknowledged', message });
        }

        // Handle message_received
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

            // 2. INTERJECTION LOGIC (Muting)
            // If the OWNER sent this message (manual reply from Instagram app), we mute the bot.
            if (body.is_sender === true) {
                console.log('👤 Owner replied manually. Muting bot for 1 hour.');

                // Track conversation and MUTE
                await supabaseAdmin.from('conversation_states').upsert({
                    user_id: connection.user_id,
                    external_chat_id: chat_id,
                    platform: 'INSTAGRAM',
                    external_username: 'You',
                    is_muted: true,
                    muted_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 Hour Mute
                    last_interaction_at: new Date().toISOString()
                }, { onConflict: 'user_id, external_chat_id' });

                // Log manual reply for UI
                await supabaseAdmin.from('activity_log').insert({
                    user_id: connection.user_id,
                    event_type: 'MANUAL_REPLY',
                    description: `Sent (Manual): "${text?.substring(0, 50)}..."`,
                    metadata: { chat_id, username: 'You', is_sender: true, is_manual: true },
                    timestamp: new Date().toISOString()
                });

                return NextResponse.json({ status: 'success', message: 'Muted bot for manual reply' });
            }

            // Check if Muted (for incoming messages)
            const { data: convState } = await supabaseAdmin.from('conversation_states')
                .select('is_muted, muted_until')
                .eq('user_id', connection.user_id)
                .eq('external_chat_id', chat_id)
                .single();

            if (convState?.is_muted && convState.muted_until && new Date(convState.muted_until) > new Date()) {
                console.log('🤐 Bot is MUTED. Skipping auto-reply.');
                // Log incoming but don't reply
                await supabaseAdmin.from('activity_log').insert({
                    user_id: connection.user_id,
                    event_type: 'INCOMING_DM',
                    description: `Received (Muted): "${text?.substring(0, 50)}..."`,
                    metadata: { ...body, is_muted: true },
                    timestamp: new Date().toISOString()
                });
                return NextResponse.json({ status: 'ignored', reason: 'Bot is muted' });
            }

            // 3. Log active incoming DM
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

            // 4. AUTO-REPLY (The Ghost)
            // Ensure we don't reply to ourselves (redundant check but safe)
            if (body.is_sender === false) {
                console.log('🤖 Generating Ghost Reply...');
                try {
                    const replyText = await generateGhostReply(connection.user_id, text || '', supabaseAdmin);

                    // If replyText is NULL or EMPTY, it means Handoff or other logic stopped it.
                    if (replyText) {
                        console.log('👻 Ghost says:', replyText);

                        // Parse DSN to get URL and Key dynamically
                        const dsn = process.env.UNIPILE_DSN || '';
                        let baseUrl = 'https://api23.unipile.com:15397';
                        let apiKey = process.env.UNIPILE_API_KEY || '';

                        if (dsn.includes('@')) {
                            const [proto, rest] = dsn.split('://');
                            const [auth, domain] = rest.split('@');
                            baseUrl = `${proto}://${domain}`;
                            apiKey = auth;
                        } else if (dsn.startsWith('http')) {
                            baseUrl = dsn;
                        }

                        if (chat_id) {
                            const sendRes = await fetch(`${baseUrl}/api/v1/chats/${chat_id}/messages`, {
                                method: 'POST',
                                headers: {
                                    'X-API-KEY': apiKey,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    text: replyText,
                                    sender_id: account_id
                                })
                            });

                            if (sendRes.ok) {
                                console.log('✅ Reply sent');
                                // Log the reply
                                await supabaseAdmin.from('activity_log').insert({
                                    user_id: connection.user_id,
                                    event_type: 'AI_REPLY',
                                    description: `Sent: "${replyText.substring(0, 50)}..."`,
                                    metadata: { chat_id, username: sender?.attendee_name, is_sender: true },
                                    timestamp: new Date().toISOString()
                                });
                            } else {
                                const errData = await sendRes.text();
                                console.error('❌ Failed to send Unipile message:', errData);
                            }
                        }
                    } else {
                        console.log('🛑 Ghost Brain returned null (Handoff or Pause). No reply sent.');
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
            if (!userId) return NextResponse.json({ status: 'ignored', reason: 'Missing user_id' });

            const { data, error } = await supabaseAdmin
                .from('user_connections')
                .upsert({
                    user_id: userId,
                    provider: provider,
                    account_id: account_id,
                    account_username: username || null,
                    metadata: body.data
                }, { onConflict: 'user_id,provider' }).select();

            if (error) {
                console.error('❌ Failed to save connection:', error);
                return NextResponse.json({ error: 'Database error', details: error }, { status: 500 });
            }
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
