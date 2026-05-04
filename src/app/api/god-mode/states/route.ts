import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGodModeAccess } from '@/lib/god-mode/auth';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
    const denied = await requireGodModeAccess();
    if (denied) return denied;

    const sb = getAdmin();

    try {
        const { data: states, error } = await sb
            .from('conversation_states')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(200);

        if (error) throw error;

        // Enrich with workspace names
        const wsIds = [...new Set((states || []).map((s: any) => s.workspace_id).filter(Boolean))];
        const { data: workspaces } = await sb
            .from('ai_settings')
            .select('id, name, business_type')
            .in('id', wsIds.length > 0 ? wsIds : ['__none__']);

        const wsMap = new Map<string, any>();
        (workspaces || []).forEach((w: any) => wsMap.set(w.id, w));

        const result = (states || []).map((s: any) => ({
            id: s.id,
            workspaceId: s.workspace_id,
            workspaceName: wsMap.get(s.workspace_id)?.name || 'Unknown',
            workspaceType: s.workspace_type,
            chatId: s.chat_id,
            stage: s.stage,
            dataPreview: s.data ? JSON.stringify(s.data).slice(0, 200) : '{}',
            data: s.data,
            updatedAt: s.updated_at,
            createdAt: s.created_at,
        }));

        return NextResponse.json({ success: true, states: result });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const denied = await requireGodModeAccess();
    if (denied) return denied;

    const sb = getAdmin();
    const body = await req.json();
    const { action, stateId, stage, data } = body;

    try {
        if (action === 'clear' && stateId) {
            // Clear to idle, preserve postContext if present
            const { data: existing } = await sb
                .from('conversation_states')
                .select('data')
                .eq('id', stateId)
                .single();

            const postContext = existing?.data?.postContext || null;
            const newData = postContext ? { stage: 'idle', postContext } : {};

            await sb
                .from('conversation_states')
                .update({ stage: 'idle', data: newData, updated_at: new Date().toISOString() })
                .eq('id', stateId);

            return NextResponse.json({ success: true, message: 'State cleared to idle' });
        }

        if (action === 'force_handoff' && stateId) {
            await sb
                .from('conversation_states')
                .update({ stage: 'handoff', updated_at: new Date().toISOString() })
                .eq('id', stateId);

            return NextResponse.json({ success: true, message: 'State forced to handoff' });
        }

        if (action === 'set_stage' && stateId && stage) {
            await sb
                .from('conversation_states')
                .update({ stage, updated_at: new Date().toISOString() })
                .eq('id', stateId);

            return NextResponse.json({ success: true, message: `Stage set to ${stage}` });
        }

        if (action === 'update_data' && stateId && data) {
            await sb
                .from('conversation_states')
                .update({ data, updated_at: new Date().toISOString() })
                .eq('id', stateId);

            return NextResponse.json({ success: true, message: 'State data updated' });
        }

        if (action === 'delete' && stateId) {
            await sb.from('conversation_states').delete().eq('id', stateId);
            return NextResponse.json({ success: true, message: 'State deleted' });
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
