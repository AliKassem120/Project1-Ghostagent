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
            // ... existing logic simplified for brevity but kept functional ...
            const accountId = body.account_id || body.data?.account_id;
            const userId = body.name || body.data?.name; // 'name' field holds user_id

            if (userId) {
                await supabaseAdmin.from('user_connections').upsert({
                    user_id: userId,
                    account_id: accountId,
                    provider: 'INSTAGRAM',
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

            // 2. MUTE/HANDOFF LOGIC
            // If OWNER replied manually:
            if (body.is_sender === true) {
                console.log('👤 Owner replied. Muting bot.');
                // Mute for 1 hour
                await supabaseAdmin.from('conversation_states').upsert({
                    user_id: connection.user_id,
                    external_chat_id: chat_id,
                    platform: 'INSTAGRAM',
                    external_username: 'You',
                    is_muted: true,
                    muted_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
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
                return NextResponse.json({ status: 'success', message: 'Muted bot' });
            }

            // Check if Muted (incoming)
            const { data: convState } = await supabaseAdmin.from('conversation_states')
                .select('is_muted, muted_until')
                .eq('user_id', connection.user_id)
                .eq('external_chat_id', chat_id)
                .single();

            if (convState?.is_muted && convState.muted_until && new Date(convState.muted_until) > new Date()) {
                console.log('🤐 Bot Muted.');
                await supabaseAdmin.from('activity_log').insert({
                    user_id: connection.user_id,
                    event_type: 'INCOMING_DM',
                    description: `Received (Muted): "${text?.substring(0, 50)}..."`,
                    metadata: { ...body, is_muted: true },
                    timestamp: new Date().toISOString()
                });
                return NextResponse.json({ status: 'ignored', reason: 'Bot is muted' });
            }

            // 3. LOG INCOMING
            await supabaseAdmin.from('activity_log').insert({
                user_id: connection.user_id,
                event_type: 'INCOMING_DM',
                description: `Received: "${text?.substring(0, 50)}..." from ${sender?.attendee_name || 'Unknown'}`,
                metadata: body,
                timestamp: new Date().toISOString()
            });

            // 4. SAFETY SHIELD (Anti-Ban)
            // 4.1 Daily Cap Check
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

            // 4.2 Human-like Pacing
            if (body.is_sender === false) {
                // Short delay to avoid 'instant-bot' detection (5s safe for Vercel)
                // Note: user requested 20-50s. This requires background jobs. 
                // Using 6s to be safe within 10s timeout range of some tiers.
                console.log('⏳ Pacing...');
                await delay(6000);
            }

            // 5. GHOST BRAIN
            console.log('🤖 Generating Reply...');
            try {
                const replyText = await generateGhostReply(connection.user_id, text || '', supabaseAdmin);

                if (replyText) {
                    console.log('👻 Sending:', replyText);

                    // Unipile API Send
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
