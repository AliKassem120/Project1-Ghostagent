import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { chatId, text, accountId } = await req.json();

        if (!chatId || !text) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

        // Unipile Config
        const dsn = process.env.UNIPILE_DSN || '';
        let baseUrl = 'https://api23.unipile.com:15397';
        let apiKey = process.env.UNIPILE_API_KEY || '';
        if (dsn.includes('@')) {
            const [proto, rest] = dsn.split('://');
            const [auth, domain] = rest.split('@');
            baseUrl = `${proto}://${domain}`;
            apiKey = auth;
        }

        // Send via Unipile
        const sendRes = await fetch(`${baseUrl}/api/v1/chats/${chatId}/messages`, {
            method: 'POST',
            headers: {
                'X-API-KEY': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text,
                sender_id: accountId // Optional: helps Unipile know which account sends it
            })
        });

        if (!sendRes.ok) {
            const err = await sendRes.text();
            console.error('Unipile Send Error:', err);
            return NextResponse.json({ error: err }, { status: 500 });
        }

        const msgData = await sendRes.json();

        // CHECK FOR DUPLICATE (Race Condition Fix)
        if (msgData.id) {
            const { data: existing } = await supabase
                .from('activity_log')
                .select('id')
                .eq('user_id', user.id)
                .or(`metadata->>unipile_message_id.eq.${msgData.id},metadata->>id.eq.${msgData.id}`)
                .maybeSingle();

            if (existing) {
                console.log('Log already exists (via Webhook). Skipping insert.');
                return NextResponse.json({ success: true, data: msgData });
            }
        }

        // Log to Activity Log (so it shows in UI)
        await supabase.from('activity_log').insert({
            user_id: user.id,
            event_type: 'MANUAL_REPLY',
            description: `Sent (Manual): "${text}"`,
            metadata: {
                chat_id: chatId,
                username: 'You',
                is_sender: true,
                is_manual: true,
                account_id: accountId,
                unipile_message_id: msgData.id
            },
            timestamp: new Date().toISOString()
        });

        return NextResponse.json({ success: true, data: msgData });

    } catch (e: any) {
        console.error('Send API Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
