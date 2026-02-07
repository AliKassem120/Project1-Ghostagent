import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateGhostReply } from '@/utils/ghost-brain';

// PROD: Safe timeout helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    if (!supabaseServiceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET() {
    return NextResponse.json({ status: 'ok', message: 'Ghost Agent Webhook Active' });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const supabaseAdmin = getSupabaseAdmin();

        // --- ACCOUNT CONNECTION EVENTS ---
        if (body.status === 'CREATION_SUCCESS' || body.event === 'account.created') {
            const accountId = body.account_id || body.data?.account_id;
            const userId = body.name || body.data?.name;
            if (userId) {
                await supabaseAdmin.from('user_connections').upsert({
                    user_id: userId,
                    account_id: accountId,
                    provider: 'INSTAGRAM', // Defaulting, but could be inferred from body
                    metadata: body,
                    connected_at: new Date().toISOString()
                }, { onConflict: 'account_id' });
                return NextResponse.json({ status: 'success' });
            }
            return NextResponse.json({ status: 'ignored' });
        }

        if (body.AccountStatus) {
            const { account_id, message } = body.AccountStatus;
            if (message === 'CONNECTED') {
                await supabaseAdmin.from('user_connections')
                    .update({ metadata: body.AccountStatus })
                    .eq('account_id', account_id);
            }
            return NextResponse.json({ status: 'acknowledged' });
        }

        // --- MESSAGE EVENTS ---
        if (body.event === 'message_received') {
            const { account_id, message, sender, chat_id } = body;
            const text = message;

            console.log('📩 DM Received:', account_id);

            // 1. Identify User
            const { data: connection } = await supabaseAdmin
                .from('user_connections')
                .select('user_id')
                .eq('account_id', account_id)
                .single();

            if (!connection) return NextResponse.json({ status: 'ignored', reason: 'Unknown account' });

            // 2. MANUAL REPLY LOGIC (No Auto-Mute)
            if (body.is_sender === true) {
                console.log('👤 Owner replied manually. Logging only.');

                await supabaseAdmin.from('activity_log').insert({
                    user_id: connection.user_id,
                    event_type: 'MANUAL_REPLY',
                    description: `Sent (Manual): "${text?.substring(0, 50)}..."`,
                    metadata: { chat_id, username: 'You', is_sender: true, is_manual: true },
                    timestamp: new Date().toISOString()
                });
                return NextResponse.json({ status: 'success', message: 'Logged manual reply' });
            }

            // 3. CHECK MUTED STATUS (Incoming)
            const { data: convState } = await supabaseAdmin.from('conversation_states')
                .select('is_muted, muted_until')
                .eq('user_id', connection.user_id)
                .eq('external_chat_id', chat_id)
                .single();

            if (convState?.is_muted) {
                console.log('🤐 Bot Muted. Logging Incoming.');
                await supabaseAdmin.from('activity_log').insert({
                    user_id: connection.user_id,
                    event_type: 'INCOMING_DM',
                    description: `Received (Muted): "${text?.substring(0, 50)}..."`,
                    metadata: { ...body, is_muted: true },
                    timestamp: new Date().toISOString()
                });
                return NextResponse.json({ status: 'ignored', reason: 'Bot is muted' });
            }

            // 4. LOG INCOMING
            await supabaseAdmin.from('activity_log').insert({
                user_id: connection.user_id,
                event_type: 'INCOMING_DM',
                description: `Received: "${text?.substring(0, 50)}..." from ${sender?.attendee_name || 'Unknown'}`,
                metadata: body,
                timestamp: new Date().toISOString()
            });

            // 5. MANAGER ALERT SYSTEM (WhatsApp)
            const alertKeywords = ['manager', 'scam', 'fake', 'bot'];
            if (alertKeywords.some(kw => text?.toLowerCase().includes(kw))) {
                console.log('🚨 Manager Alert Triggered!');

                const { data: settings } = await supabaseAdmin
                    .from('bot_settings')
                    .select('emergency_whatsapp')
                    .eq('user_id', connection.user_id)
                    .single();

                if (settings?.emergency_whatsapp) {
                    // Find a WhatsApp connection
                    const { data: waConnection } = await supabaseAdmin
                        .from('user_connections')
                        .select('*')
                        .eq('user_id', connection.user_id)
                        .eq('provider', 'WHATSAPP') // Assumes provider field is set correctly
                        .limit(1)
                        .single();

                    if (waConnection) {
                        const dsn = process.env.UNIPILE_DSN || '';
                        let baseUrl = 'https://api23.unipile.com:15397';
                        let apiKey = process.env.UNIPILE_API_KEY || '';
                        if (dsn.includes('@')) {
                            const [proto, rest] = dsn.split('://');
                            const [auth, domain] = rest.split('@');
                            baseUrl = `${proto}://${domain}`;
                            apiKey = auth;
                        }

                        try {
                            // Create Chat to establish ID
                            const chatRes = await fetch(`${baseUrl}/api/v1/chats`, {
                                method: 'POST',
                                headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    account_id: waConnection.account_id,
                                    attendees: [settings.emergency_whatsapp]
                                })
                            });

                            if (chatRes.ok) {
                                const chatData = await chatRes.json();
                                // Send Alert
                                await fetch(`${baseUrl}/api/v1/chats/${chatData.id}/messages`, {
                                    method: 'POST',
                                    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        text: `🚨 ALERT: Customer ${sender?.attendee_name} said "${text}". Check Dashboard.`,
                                        sender_id: waConnection.account_id
                                    })
                                });
                                console.log('✅ Alert sent to WhatsApp');
                            }
                        } catch (e) {
                            console.error('Failed to send WhatsApp alert', e);
                        }
                    }
                }
            }

            // 6. SAFETY SHIELD (Anti-Ban)
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const { count } = await supabaseAdmin.from('activity_log')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', connection.user_id)
                .eq('event_type', 'AI_REPLY')
                .gte('timestamp', startOfDay.toISOString());

            if (count && count >= 50) {
                console.log('🛑 Daily Limit (50) Reached.');
                await supabaseAdmin.from('activity_log').insert({
                    user_id: connection.user_id, event_type: 'LIMIT_REACHED',
                    description: 'Daily limit reached. Manual takeover required.',
                    timestamp: new Date().toISOString()
                });
                return NextResponse.json({ status: 'ignored', reason: 'Daily limit' });
            }

            // Human-like Pacing
            console.log('⏳ Pacing...');
            await delay(6000);

            // 7. GHOST BRAIN (with Context)
            console.log('🤖 Generating Reply...');
            try {
                // Pass chat_id for context fetching
                const replyText = await generateGhostReply(connection.user_id, text || '', supabaseAdmin, chat_id);

                if (replyText) {
                    console.log('👻 Sending:', replyText);

                    const dsn = process.env.UNIPILE_DSN || '';
                    let baseUrl = 'https://api23.unipile.com:15397';
                    let apiKey = process.env.UNIPILE_API_KEY || '';
                    if (dsn.includes('@')) {
                        const [proto, rest] = dsn.split('://');
                        const [auth, domain] = rest.split('@');
                        baseUrl = `${proto}://${domain}`;
                        apiKey = auth;
                    }

                    const sendRes = await fetch(`${baseUrl}/api/v1/chats/${chat_id}/messages`, {
                        method: 'POST',
                        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: replyText, sender_id: account_id })
                    });

                    if (sendRes.ok) {
                        await supabaseAdmin.from('activity_log').insert({
                            user_id: connection.user_id,
                            event_type: 'AI_REPLY',
                            description: `Sent: "${replyText.substring(0, 50)}..."`,
                            metadata: { chat_id, username: sender?.attendee_name, is_sender: true },
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        console.error('❌ Send Failed:', await sendRes.text());
                    }
                }
            } catch (e) {
                console.error('Ghost Brain Error:', e);
            }

            return NextResponse.json({ status: 'success' });
        }

        return NextResponse.json({ status: 'acknowledged' });
    } catch (e: any) {
        console.error('Webhook Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
