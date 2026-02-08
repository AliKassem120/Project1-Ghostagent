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

        // === 🔇 PRIVACY SILENCE FILTER (FIRST LINE OF DEFENSE) ===
        // If this webhook is from the admin's personal WhatsApp, ignore it completely.
        // No logs, no processing - just acknowledge and exit silently.
        const adminWhatsAppId = process.env.ADMIN_WHATSAPP_ID;
        const incomingAccountId = body.account_id;
        if (adminWhatsAppId && incomingAccountId === adminWhatsAppId) {
            // Return 200 to satisfy Unipile, but do NOTHING else.
            return NextResponse.json({ status: 'ignored', reason: 'Admin personal account' }, { status: 200 });
        }

        const supabaseAdmin = getSupabaseAdmin();

        // --- ACCOUNT CONNECTION EVENTS ---
        if (body.status === 'CREATION_SUCCESS' || body.event === 'account.created') {
            const accountId = body.account_id || body.data?.account_id;
            const userId = body.name || body.data?.name;
            const providerType = (body.type || body.data?.type || 'INSTAGRAM').toUpperCase();

            if (userId) {
                await supabaseAdmin.from('user_connections').upsert({
                    user_id: userId,
                    account_id: accountId,
                    provider: providerType,
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

            // === DEBUG: Log the full payload structure to understand sender fields ===
            console.log('📩 DM Webhook Payload:', JSON.stringify({
                account_id,
                chat_id,
                sender_id: body.sender_id,
                message_sender_id: body.message?.sender_id,
                sender_object: sender,
                is_sender: body.is_sender,
                id: body.id
            }, null, 2));

            // 1. Identify User Connection
            const { data: connection } = await supabaseAdmin
                .from('user_connections')
                .select('user_id, account_id')
                .eq('account_id', account_id)
                .single();

            if (!connection) return NextResponse.json({ status: 'ignored', reason: 'Unknown account' });

            // === 🛑 CRITICAL: SELF-MESSAGE KILL SWITCH (Echo Chamber Fix) ===
            // Extract sender ID from ALL possible payload locations
            const connectedAccountId = connection.account_id;
            const possibleSenderIds = [
                body.sender_id,
                body.message?.sender_id,
                sender?.id,
                sender?.attendee_id,
                sender?.account_id
            ].filter(Boolean);

            // Log for debugging
            console.log('🔍 Self-Check:', { connectedAccountId, possibleSenderIds, is_sender: body.is_sender });

            // If ANY of the sender IDs match our connected account, this is a bot/self echo - STOP IMMEDIATELY
            if (possibleSenderIds.some(sid => sid === connectedAccountId)) {
                console.log('👻 KILL SWITCH: Ignoring self-sent message (bot echo).');
                return NextResponse.json({ status: 'ignored', reason: 'Self-message echo' });
            }

            // === CRITICAL: Handle ALL outgoing messages (is_sender = true) ===
            // When is_sender is true, this is an OUTGOING message - either from:
            // 1. Our bot (via API) - already logged, IGNORE the webhook
            // 2. User's manual reply from Instagram app - should log as MANUAL_REPLY
            // 
            // THE FIX: Check if this message was ALREADY logged by our API.
            // If yes -> IGNORE (it's a bot echo)
            // If no -> It might be a genuine manual reply, but we need more proof
            if (body.is_sender === true) {
                console.log('📤 Outgoing message detected (is_sender=true). Checking if bot echo...');

                // Check if this message ID was already logged by our API (bot sent it)
                if (body.id) {
                    const { data: alreadyLogged } = await supabaseAdmin
                        .from('activity_log')
                        .select('id')
                        .eq('user_id', connection.user_id)
                        .filter('metadata->>unipile_message_id', 'eq', body.id)
                        .maybeSingle();

                    if (alreadyLogged) {
                        console.log('👻 KILL SWITCH: Message ID already logged by API. Ignoring webhook echo.');
                        return NextResponse.json({ status: 'ignored', reason: 'Already logged via API' });
                    }
                }

                // EXTRA SAFETY: Check if this exact text was logged in the last 30 seconds as AI_REPLY
                // This catches cases where message IDs might differ
                const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
                const { data: recentBotReply } = await supabaseAdmin
                    .from('activity_log')
                    .select('id, description')
                    .eq('user_id', connection.user_id)
                    .eq('event_type', 'AI_REPLY')
                    .gte('timestamp', thirtySecondsAgo)
                    .ilike('description', `%${text?.substring(0, 50)}%`)
                    .maybeSingle();

                if (recentBotReply) {
                    console.log('👻 KILL SWITCH: Matching AI_REPLY found in last 30s. Ignoring webhook echo.');
                    return NextResponse.json({ status: 'ignored', reason: 'Recent AI reply match' });
                }

                // If we get here, this MIGHT be a genuine manual reply from the owner's device
                // But let's be conservative - only log if it's NOT a recent AI message
                console.log('👤 Outgoing message not from bot. Logging as Manual Reply.');
                await supabaseAdmin.from('activity_log').insert({
                    user_id: connection.user_id,
                    event_type: 'MANUAL_REPLY',
                    description: `Sent (Manual): "${text}"`,
                    metadata: {
                        chat_id,
                        username: 'You',
                        is_sender: true,
                        is_manual: true,
                        unipile_message_id: body.id
                    },
                    timestamp: new Date().toISOString()
                });
                return NextResponse.json({ status: 'success', message: 'Logged manual reply' });
            }

            // 2. CHECK FOR LOOPBACK (Exact ID Match) - Prevents duplicate logs
            if (body.id) {
                const { data: existing } = await supabaseAdmin
                    .from('activity_log')
                    .select('id')
                    .eq('user_id', connection.user_id)
                    .or(`metadata->>unipile_message_id.eq.${body.id},metadata->>id.eq.${body.id}`)
                    .maybeSingle();

                if (existing) {
                    console.log(`🔄 Loopback detected (ID: ${body.id}). Ignoring.`);
                    return NextResponse.json({ status: 'ignored', reason: 'Loopback ID' });
                }
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
                    description: `Received (Muted): "${text}"`,
                    metadata: { ...body, is_muted: true },
                    timestamp: new Date().toISOString()
                });
                return NextResponse.json({ status: 'ignored', reason: 'Bot is muted' });
            }

            // 4. LOG INCOMING
            await supabaseAdmin.from('activity_log').insert({
                user_id: connection.user_id,
                event_type: 'INCOMING_DM',
                description: `Received: "${text}" from ${sender?.attendee_name || 'Unknown'}`,
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
                    const adminWaId = process.env.ADMIN_WHATSAPP_ID;
                    if (!adminWaId) {
                        console.error('❌ ADMIN_WHATSAPP_ID missing. Cannot send admin alert.');
                    } else {
                        // Authenticate Unipile (SaaS Owner)
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
                            console.log(`📱 Sending Admin Alert to User (${settings.emergency_whatsapp})`);

                            // Format phone number for WhatsApp API
                            const cleanNumber = settings.emergency_whatsapp.replace(/\D/g, ''); // Remove + and spaces
                            const whatsAppId = `${cleanNumber}@s.whatsapp.net`;
                            console.log(`Formatted WhatsApp ID: ${whatsAppId}`);

                            // Atomic: Create chat AND send message in one call
                            const alertBody = `⚠️ GhostAgent Alert: A customer on your Instagram just said "${text}". Please check your dashboard.`;

                            const chatRes = await fetch(`${baseUrl}/api/v1/chats`, {
                                method: 'POST',
                                headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    account_id: adminWaId,
                                    attendees_ids: [whatsAppId],
                                    text: alertBody // Include message in chat creation
                                })
                            });

                            if (chatRes.ok || chatRes.status === 201) {
                                console.log('✅ Admin Alert Sent');
                            } else {
                                const chatData = await chatRes.json();
                                console.error('❌ Failed to send alert:', chatRes.status, chatData);
                            }
                        } catch (e) {
                            console.error('Failed to send Admin alert', e);
                        }
                    }
                }

                // CRITICAL: Stop AI from replying to this message
                console.log('🛑 Manager requested. Skipping AI reply.');
                return NextResponse.json({ status: 'escalated', message: 'Manager alert sent' });
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
                        const msgData = await sendRes.json();
                        await supabaseAdmin.from('activity_log').insert({
                            user_id: connection.user_id,
                            event_type: 'AI_REPLY',
                            description: `Sent: "${replyText}"`,
                            metadata: {
                                chat_id,
                                username: sender?.attendee_name,
                                is_sender: true,
                                unipile_message_id: msgData.id
                            },
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
