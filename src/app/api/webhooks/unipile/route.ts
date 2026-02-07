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
        if (body.event === 'message.received' || body.event === 'message_received') {
            const account_id = body.account_id;

            // Robust Text Extraction (Handle String vs Object)
            let text = '';
            if (typeof body.message === 'string') {
                text = body.message;
            } else if (body.message?.text) {
                text = body.message.text;
            } else if (body.text) {
                text = body.text;
            }

            const chat_id = body.chat_id;
            const messageId = body.id;

            // Robust Sender Extraction
            const sender = body.sender || (typeof body.message === 'object' ? body.message?.sender : null);

            console.log('📩 DM Received:', chat_id, '| ID:', messageId, '| Event:', body.event);

            // 1. GET USER CONNECTION
            const { data: connection } = await supabaseAdmin
                .from('user_connections')
                .select('user_id')
                .eq('account_id', account_id)
                .single();

            if (!connection) return NextResponse.json({ status: 'ignored', reason: 'Unknown account' });

            // 2. LOOPBACK CHECK (Enhanced with Debug Logging)
            if (messageId) {
                console.log(`🔍 Checking for duplicate with ID: ${messageId}`);

                const { data: existing, error: loopbackError } = await supabaseAdmin
                    .from('activity_log')
                    .select('id, event_type, metadata')
                    .eq('user_id', connection.user_id)
                    .or(`metadata->>unipile_message_id.eq.${messageId},metadata->>id.eq.${messageId}`)
                    .maybeSingle();

                if (loopbackError) {
                    console.error('⚠️ Loopback check error:', loopbackError);
                }

                if (existing) {
                    console.log(`🔄 DUPLICATE DETECTED! Already logged as ${existing.event_type}. Metadata:`, existing.metadata);
                    return NextResponse.json({ status: 'ignored', reason: 'Duplicate message ID' });
                }

                console.log('✅ New message (not in DB)');
            } else {
                console.warn('⚠️ No message ID provided by Unipile. Cannot check for duplicates.');
            }

            if (body.is_sender === true) {
                console.log('👤 Owner manual reply. Logging with ID:', messageId);
                await supabaseAdmin.from('activity_log').insert({
                    user_id: connection.user_id,
                    event_type: 'MANUAL_REPLY',
                    description: `Sent (Manual): "${text}"`,
                    metadata: {
                        chat_id,
                        username: 'You',
                        is_sender: true,
                        is_manual: true,
                        unipile_message_id: messageId,
                        id: messageId
                    },
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

                            // Format Phone Number for WhatsApp (e.g., 961...@s.whatsapp.net)
                            let toPhone = settings.emergency_whatsapp.replace(/\D/g, ''); // Extract digits
                            const toWaId = `${toPhone}@s.whatsapp.net`;

                            console.log(`Formatted WA ID: ${toWaId}`);
                            let sendingAccountId = adminWaId;

                            // Auto-Resolve Account ID if user provided a phone number
                            if (!adminWaId.includes('_')) {
                                console.log('🔍 Resolving valid Account ID from Unipile...');
                                try {
                                    const accRes = await fetch(`${baseUrl}/api/v1/accounts`, {
                                        headers: { 'X-API-KEY': apiKey }
                                    });
                                    const accounts = await accRes.json();
                                    const accountList = Array.isArray(accounts) ? accounts : (accounts.items || []);

                                    console.log(`📋 Found ${accountList.length} accounts:`, accountList.map((a: any) => `${a.type}:${a.status}`).join(', '));

                                    // Broader search: WhatsApp with any "active" status (check sources[0].status)
                                    const waAccount = accountList.find((a: any) => {
                                        const typeMatch = (a.type || '').toUpperCase() === 'WHATSAPP';
                                        const sourceStatus = a.sources?.[0]?.status || a.status || '';
                                        const statusOk = ['OK', 'CONNECTED', 'ACTIVE'].includes(sourceStatus.toUpperCase());
                                        return typeMatch && statusOk;
                                    });

                                    if (waAccount) {
                                        sendingAccountId = waAccount.id;
                                        console.log(`✅ Auto-resolved Admin Account: ${waAccount.name || 'WhatsApp'} (${sendingAccountId})`);
                                    } else {
                                        console.error('❌ No active WhatsApp account found. Please connect a WhatsApp account in Unipile.');
                                        console.error('Available accounts:', JSON.stringify(accountList, null, 2));
                                    }
                                } catch (e) {
                                    console.error('Failed to resolve accounts:', e);
                                }
                            }

                            // 1. Create DM Chat (Admin -> User Phone)
                            let chatRes = await fetch(`${baseUrl}/api/v1/chats`, {
                                method: 'POST',
                                headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    account_id: sendingAccountId,
                                    attendees_ids: [toWaId]
                                })
                            });

                            const chatData = await chatRes.json();

                            // Success (200/201) or Existing (409 logic if API behaves that way, but usually returns object)
                            const chatId = chatData.id || (chatData.status === 409 ? chatData.meta?.id : null);

                            if (chatRes.ok || chatId) {
                                // 2. Send Message
                                const alertBody = `⚠️ GhostAgent Alert: A customer on your Instagram said "${text}". Check Dashboard.`;
                                const msgRes = await fetch(`${baseUrl}/api/v1/chats/${chatId}/messages`, {
                                    method: 'POST',
                                    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        text: alertBody,
                                        sender_id: adminWaId
                                    })
                                });
                                if (msgRes.ok) console.log('✅ Admin Alert Sent');
                                else console.error('❌ Failed to send alert message:', await msgRes.text());
                            } else {
                                console.error('❌ Failed to create alert chat:', chatData);
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
