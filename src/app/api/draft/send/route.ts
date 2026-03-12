import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { activityId, replyText, recipientId } = await request.json();

    if (!replyText || !recipientId || !activityId) {
        return NextResponse.json({ error: 'Missing Data' }, { status: 400 });
    }

    // 1. Fetch activity log to get workspace_id
    const { data: activity } = await supabase
        .from('activity_log')
        .select('workspace_id')
        .eq('id', activityId)
        .maybeSingle();

    // 2. Resolve final token
    let token = '';
    let isNewAPI = false;

    if (activity?.workspace_id) {
        const { data: integration } = await supabase
            .from('instagram_integrations')
            .select('access_token')
            .eq('workspace_id', activity.workspace_id)
            .maybeSingle();

        if (integration?.access_token) {
            token = integration.access_token;
            isNewAPI = true;
        }
    }

    if (!token) {
        // Fallback to legacy or ENV
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

    if (!token) {
        token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN || '';
    }

    if (!token) {
        return NextResponse.json({ error: 'Missing Instagram Access Token' }, { status: 500 });
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

    const baseUrl = isNewAPI ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
    const url = `${baseUrl}/v21.0/me/messages?access_token=${token}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                recipient: { id: recipientId },
                message: { text: replyText },
            }),
        });

        const data = await response.json();

        if (data.error) {
            console.error('Instagram Error:', data.error);
            return NextResponse.json({ error: data.error.message }, { status: 500 });
        }

        // Update Activity Log
        const { error: updateError } = await supabase
            .from('activity_log')
            .update({
                event_type: 'MANUAL_REPLY',
                description: `Sent (Manual): "${replyText}"`,
                metadata: {
                    chat_id: recipientId,
                    platform: 'instagram',
                    status: 'sent',
                    reply_text: replyText
                }
            })
            .eq('id', activityId)
            .eq('user_id', user.id);

        if (updateError) {
            console.error('Supabase Update Error:', updateError);
            return NextResponse.json({ error: 'Failed to update log' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (e) {
        console.error('Send Draft Error:', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
