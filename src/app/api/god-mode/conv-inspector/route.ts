import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGodModeAccess } from '@/lib/god-mode/auth';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
    const denied = await requireGodModeAccess();
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
        return NextResponse.json({ success: false, error: 'chatId is required' }, { status: 400 });
    }

    const sb = getAdmin();

    try {
        const { data, error } = await sb
            .from('activity_log')
            .select('*')
            .or(`metadata->>chat_id.eq.${chatId},metadata->>chatId.eq.${chatId}`)
            .order('timestamp', { ascending: true });

        if (error) throw error;

        // Process logs into a readable conversation thread
        const messages = (data || [])
            .filter(row => ['INCOMING_MESSAGE', 'AI_REPLY', 'automation_v2'].includes(row.event_type))
            .map(row => {
                const role = row.event_type === 'INCOMING_MESSAGE' ? 'user' : 'bot';
                let content = '';
                
                if (role === 'user') {
                    content = row.metadata?.message || row.metadata?.text || row.description || '';
                } else {
                    content = row.metadata?.reply || row.metadata?.message || row.description || '';
                }

                return {
                    id: row.id,
                    timestamp: row.timestamp,
                    role,
                    content,
                    eventType: row.event_type,
                    raw: row
                };
            });

        return NextResponse.json({ success: true, messages });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
