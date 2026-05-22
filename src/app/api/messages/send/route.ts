import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { chatId, text, accountId, workspaceId, platform: bodyPlatform } = await req.json();

        if (!chatId || !text) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

        // Determine platform: check request body first, otherwise query last log in conversation
        let platform: 'instagram' | 'whatsapp' = bodyPlatform || 'instagram';

        if (!bodyPlatform && chatId) {
            const { data: lastLog } = await supabase
                .from('activity_log')
                .select('metadata')
                .eq('user_id', user.id)
                .like('metadata->>chat_id', chatId)
                .order('timestamp', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (lastLog?.metadata?.platform === 'whatsapp') {
                platform = 'whatsapp';
            }
        }

        let msgData: any;

        if (platform === 'whatsapp') {
            // ─── SEND VIA WHATSAPP ───
            if (!workspaceId) {
                return NextResponse.json({ error: 'Workspace ID required to send WhatsApp messages.' }, { status: 400 });
            }

            const { data: wsSettings } = await supabase
                .from('ai_settings')
                .select('whatsapp_phone_number_id, whatsapp_access_token')
                .eq('id', workspaceId)
                .maybeSingle();

            let waToken = wsSettings?.whatsapp_access_token;
            const waPhoneId = wsSettings?.whatsapp_phone_number_id;
            const systemToken = process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN;
            const systemPhoneId = process.env.WHATSAPP_FROM_PHONE_NUMBER_ID;

            if (!waToken && waPhoneId === systemPhoneId) {
                waToken = systemToken;
            }

            if (!waToken || !waPhoneId) {
                return NextResponse.json({ error: 'WhatsApp is not configured for this workspace.' }, { status: 401 });
            }

            const formattedRecipient = `+${chatId.replace(/\D/g, '')}`;
            const url = `https://graph.facebook.com/v18.0/${waPhoneId}/messages`;

            const sendRes = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${waToken.trim()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: formattedRecipient,
                    type: 'text',
                    text: { body: text },
                }),
            });

            msgData = await sendRes.json();

            if (msgData.error) {
                console.error('WhatsApp Send Error:', msgData.error);
                return NextResponse.json({ error: msgData.error.message }, { status: 500 });
            }
        } else {
            // ─── SEND VIA INSTAGRAM ───
            let token = '';
            let isNewAPI = false;

            if (workspaceId) {
                const { data: integration } = await supabase
                    .from('instagram_integrations')
                    .select('access_token')
                    .eq('workspace_id', workspaceId)
                    .maybeSingle();

                if (integration?.access_token) {
                    token = integration.access_token;
                    isNewAPI = true;
                }
            }

            if (!token) {
                // Fallback for non-workspace requests or legacy connections
                const { data: connection } = await supabase
                    .from('user_connections')
                    .select('access_token, metadata')
                    .eq('user_id', user.id)
                    .in('provider', ['INSTAGRAM', 'instagram_api_login'])
                    .limit(1).maybeSingle();

                if (connection?.access_token) {
                    token = connection.access_token;
                } else if ((connection as any)?.metadata?.access_token) {
                    token = (connection as any).metadata.access_token;
                }
            }

            // Final fallback to ENV
            if (!token) {
                token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN || '';
            }

            if (!token) {
                return NextResponse.json({ error: 'Missing Instagram Access Token. Please ensure your workspace is connected.' }, { status: 401 });
            }

            // Sanitize Token
            token = token.trim();
            if (token.startsWith('"') && token.endsWith('"')) token = token.slice(1, -1);
            if (token.startsWith('{')) {
                try {
                    const parsed = JSON.parse(token);
                    token = parsed.access_token || token;
                } catch (e) { /* ignore */ }
            }

            // Determine API Host based on token origin
            const baseUrl = isNewAPI ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
            const url = `${baseUrl}/v21.0/me/messages?access_token=${token}`;

            const sendRes = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recipient: { id: chatId },
                    message: { text },
                }),
            });

            msgData = await sendRes.json();

            if (msgData.error) {
                console.error('Instagram Send Error:', msgData.error);
                return NextResponse.json({ error: msgData.error.message }, { status: 500 });
            }
        }

        // Get message ID for logging/deduplication
        const messageId = platform === 'whatsapp' 
            ? (msgData.messages?.[0]?.id || msgData.id)
            : (msgData.message_id || msgData.id);

        // CHECK FOR DUPLICATE (Race Condition Fix)
        if (messageId) {
            const { data: existing } = await supabase
                .from('activity_log')
                .select('id')
                .eq('user_id', user.id)
                .or(`metadata->>message_id.eq.${messageId},metadata->>id.eq.${messageId}`)
                .maybeSingle();

            if (existing) {
                console.log('Log already exists (via Webhook). Skipping insert.');
                return NextResponse.json({ success: true, data: msgData });
            }
        }

        // Log to Activity Log (so it shows in UI)
        const { data: insertedLog, error: insertError } = await supabase.from('activity_log').insert({
            user_id: user.id,
            workspace_id: workspaceId || null,
            event_type: 'MANUAL_REPLY',
            description: `Sent (Manual): "${text}"`,
            metadata: {
                chat_id: chatId,
                platform: platform,
                username: platform === 'whatsapp' ? chatId : 'You',
                is_sender: true,
                is_manual: true,
                account_id: accountId,
                message_id: messageId
            },
            timestamp: new Date().toISOString()
        }).select().single();

        if (insertError) {
            console.error('Activity Log Insert Error:', insertError);
        }

        // 🎧 PASSIVE LISTENING: Capture manual reply
        if (workspaceId) {
            const { data: lastCustMsg } = await supabase
                .from('activity_log')
                .select('description')
                .eq('workspace_id', workspaceId)
                .eq('event_type', 'INCOMING_MESSAGE')
                .like('metadata->>chat_id', chatId)
                .order('timestamp', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (lastCustMsg?.description) {
                const match = lastCustMsg.description.match(/:\s+"(.*)"$/);
                const pureCustomerMessage = match ? match[1] : lastCustMsg.description;

                await supabase.from('business_training_data').insert({
                    workspace_id: workspaceId,
                    source: 'passive_listening',
                    customer_message: pureCustomerMessage,
                    owner_reply: text
                });
            }
        }

        return NextResponse.json({ success: true, data: insertedLog || msgData });

    } catch (e: any) {
        console.error('Send API Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
