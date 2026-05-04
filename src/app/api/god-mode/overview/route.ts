import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGodModeAccess } from '@/lib/god-mode/auth';

const getAdmin = () => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY required for God Mode');
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
};

export async function GET() {
    const denied = await requireGodModeAccess();
    if (denied) return denied;

    const sb = getAdmin();
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    try {
        const [
            { data: workspaces },
            { data: igIntegrations },
            { data: waIntegrations },
            { data: activities24h },
            { data: orders24h },
            { data: appointments24h },
            { data: controlFlags },
        ] = await Promise.all([
            sb.from('ai_settings').select('id, is_internal, visibility'),
            sb.from('instagram_integrations').select('id'),
            sb.from('whatsapp_integrations').select('id').limit(1), // may not exist
            sb.from('activity_log').select('event_type, metadata').gte('timestamp', h24),
            sb.from('orders').select('id').gte('created_at', h24),
            sb.from('appointments').select('id').gte('created_at', h24),
            sb.from('bot_control_flags').select('scope, pause_dms, pause_comments'),
        ]);

        const ws = workspaces || [];
        const acts = activities24h || [];

        // Count paused workspaces from control flags
        const globalPause = (controlFlags || []).some((f: any) => f.scope === 'global' && (f.pause_dms || f.pause_comments));

        const metrics = {
            totalWorkspaces: ws.length,
            activeWorkspaces: ws.filter((w: any) => !w.is_internal).length,
            internalWorkspaces: ws.filter((w: any) => w.is_internal).length,
            connectedInstagram: (igIntegrations || []).length,
            connectedWhatsApp: (waIntegrations || []).length,
            dms24h: acts.filter((a: any) => a.event_type === 'INCOMING_MESSAGE' || a.event_type === 'AI_REPLY').length,
            aiReplies24h: acts.filter((a: any) => a.event_type === 'AI_REPLY').length,
            commentReplies24h: acts.filter((a: any) => a.event_type === 'COMMENT_REPLY' || a.event_type === 'DRAFT_COMMENT_REPLY').length,
            orders24h: (orders24h || []).length,
            appointments24h: (appointments24h || []).length,
            errors24h: acts.filter((a: any) => a.event_type === 'ERROR' || a.event_type === 'SYSTEM_WARNING').length,
            handoffs24h: acts.filter((a: any) => a.event_type === 'HANDOFF').length,
            globalPaused: globalPause,
        };

        return NextResponse.json({ success: true, metrics });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
