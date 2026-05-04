import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGodModeAccess } from '@/lib/god-mode/auth';

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
    const status = url.searchParams.get('status');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

    try {
        let query = sb
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (workspaceId) query = query.eq('workspace_id', workspaceId);
        if (status) query = query.eq('status', status);

        const { data: orders, error } = await query;
        if (error) throw error;

        // Enrich with workspace names
        const wsIds = [...new Set((orders || []).map((o: any) => o.workspace_id).filter(Boolean))];
        const { data: workspaces } = await sb
            .from('ai_settings')
            .select('id, name')
            .in('id', wsIds.length > 0 ? wsIds : ['__none__']);

        const wsMap = new Map<string, string>();
        (workspaces || []).forEach((w: any) => wsMap.set(w.id, w.name));

        const result = (orders || []).map((o: any) => ({
            ...o,
            workspaceName: wsMap.get(o.workspace_id) || null,
        }));

        return NextResponse.json({ success: true, orders: result });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const denied = await requireGodModeAccess();
    if (denied) return denied;

    const sb = getAdmin();
    const { orderId, status } = await req.json();

    if (!orderId || !status) {
        return NextResponse.json({ success: false, error: 'orderId and status required' }, { status: 400 });
    }

    const validStatuses = ['pending', 'confirmed', 'fulfilled', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
        return NextResponse.json({ success: false, error: `Invalid status. Use: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    try {
        const { error } = await sb
            .from('orders')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', orderId);

        if (error) throw error;
        return NextResponse.json({ success: true, message: `Order ${orderId} → ${status}` });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
