import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { chatId, text, accountId, workspaceId } = await req.json();

        if (!chatId || !text) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

        // 1. Fetch Instagram Connection for this workspace
        let token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;

        if (workspaceId) {
            const { data: integration } = await supabase
                .from('instagram_integrations')
                .select('access_token')
                .eq('workspace_id', workspaceId)
                .maybeSingle();

            if (integration?.access_token) {
                token = integration.access_token;
            }
        } else {
            // Fallback for non-workspace requests
            const { data: connection } = await supabase
                .from('user_connections')
                .select('access_token')
                .eq('user_id', user.id)
                .eq('provider', 'INSTAGRAM')
                .limit(1).maybeSingle();

            if (connection?.access_token) {
                token = connection.access_token;
            }
        }

        if (!token) {
            return NextResponse.json({ error: 'Missing Instagram Access Token. Please ensure your workspace is connected.' }, { status: 401 });
        }

        const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`;

        // Send via Meta Graph API
        const sendRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                recipient: { id: chatId },
                message: { text },
            }),
        });

        const msgData = await sendRes.json();

        if (msgData.error) {
            console.error('Instagram Send Error:', msgData.error);
            return NextResponse.json({ error: msgData.error.message }, { status: 500 });
        }

        // CHECK FOR DUPLICATE (Race Condition Fix)
        if (msgData.message_id) {
            const { data: existing } = await supabase
                .from('activity_log')
                .select('id')
                .eq('user_id', user.id)
                .or(`metadata->>message_id.eq.${msgData.message_id},metadata->>id.eq.${msgData.message_id}`)
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
                username: 'You',
                is_sender: true,
                is_manual: true,
                account_id: accountId,
                message_id: msgData.message_id || msgData.id
            },
            timestamp: new Date().toISOString()
        }).select().single();

        if (insertError) {
            console.error('Activity Log Insert Error:', insertError);
        }

        return NextResponse.json({ success: true, data: insertedLog || msgData });

    } catch (e: any) {
        console.error('Send API Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
