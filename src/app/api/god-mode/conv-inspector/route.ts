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

        // Process logs into enriched conversation messages
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

                // Extract automation_v2 metadata when available
                const meta = row.metadata || {};

                return {
                    id: row.id,
                    timestamp: row.timestamp,
                    role,
                    content,
                    eventType: row.event_type,
                    // ── Enriched V2 metadata ─────────
                    intent: meta.intent || null,
                    language: meta.language || null,
                    stateBefore: meta.stateBefore || null,
                    stateAfter: meta.stateAfter || null,
                    actions: meta.actions || null,
                    durationMs: meta.durationMs || null,
                    platform: meta.platform || null,
                    error: meta.error || null,
                    requestId: meta.requestId || null,
                };
            });

        // Also fetch any related order or appointment IDs
        const { data: orders } = await sb
            .from('orders')
            .select('id, status, created_at, item_name, total')
            .or(`metadata->>chat_id.eq.${chatId},metadata->>chatId.eq.${chatId}`)
            .order('created_at', { ascending: false })
            .limit(5);

        const { data: appointments } = await sb
            .from('appointments')
            .select('id, status, start_time, service_name')
            .or(`metadata->>chat_id.eq.${chatId},metadata->>chatId.eq.${chatId}`)
            .order('created_at', { ascending: false })
            .limit(5);

        // Fetch current conversation state
        const { data: stateData } = await sb
            .from('conversation_states')
            .select('stage, data, updated_at')
            .eq('chat_id', chatId)
            .maybeSingle();

        return NextResponse.json({
            success: true,
            messages,
            linkedData: {
                orders: orders || [],
                appointments: appointments || [],
                currentState: stateData || null,
            },
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
