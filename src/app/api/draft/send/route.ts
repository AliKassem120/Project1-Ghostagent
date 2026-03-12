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
    let token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
    if (activity?.workspace_id) {
        const { data: integration } = await supabase
            .from('instagram_integrations')
            .select('access_token')
            .eq('workspace_id', activity.workspace_id)
            .maybeSingle();

        if (integration?.access_token) {
            token = integration.access_token;
        }
    }

    if (!token) {
        return NextResponse.json({ error: 'Missing Instagram Access Token' }, { status: 500 });
    }

    const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`;

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
