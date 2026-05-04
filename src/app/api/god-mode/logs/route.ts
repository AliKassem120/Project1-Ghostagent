import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGodModeAccess, redactSensitiveData } from '@/lib/god-mode/auth';

const getAdmin = () => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY required for God Mode');
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
};

export async function GET(req: Request) {
    const denied = await requireGodModeAccess();
    if (denied) return denied;

    const sb = getAdmin();
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspaceId');
    const eventType = url.searchParams.get('eventType');
    const platform = url.searchParams.get('platform');
    const chatId = url.searchParams.get('chatId');
    const errorOnly = url.searchParams.get('errorOnly') === 'true';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    try {
        let query = sb
            .from('activity_log')
            .select('*', { count: 'exact' })
            .order('timestamp', { ascending: false })
            .range(offset, offset + limit - 1);

        if (workspaceId) query = query.eq('workspace_id', workspaceId);
        if (eventType) query = query.eq('event_type', eventType);
        if (chatId) query = query.eq('metadata->>chat_id', chatId);
        if (errorOnly) query = query.in('event_type', ['ERROR', 'SYSTEM_WARNING']);
        if (platform) query = query.eq('metadata->>platform', platform);

        const { data: logs, error, count } = await query;
        if (error) throw error;

        // Enrich with workspace names
        const wsIds = [...new Set((logs || []).map((l: any) => l.workspace_id).filter(Boolean))];
        const { data: workspaces } = await sb
            .from('ai_settings')
            .select('id, name')
            .in('id', wsIds.length > 0 ? wsIds : ['__none__']);

        const wsMap = new Map<string, string>();
        (workspaces || []).forEach((w: any) => wsMap.set(w.id, w.name));

        const result = (logs || []).map((log: any) => ({
            id: log.id,
            userId: log.user_id,
            workspaceId: log.workspace_id,
            workspaceName: wsMap.get(log.workspace_id) || null,
            eventType: log.event_type,
            description: log.description,
            timestamp: log.timestamp,
            metadata: redactSensitiveData(log.metadata || {}),
        }));

        return NextResponse.json({ success: true, logs: result, total: count || 0, limit, offset });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
