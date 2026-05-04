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
    const workspaceId = searchParams.get('workspaceId');
    const sb = getAdmin();

    try {
        let query = sb
            .from('business_knowledge')
            .select('*')
            .order('created_at', { ascending: false });

        if (workspaceId) {
            query = query.eq('workspace_id', workspaceId);
        } else {
            // If no workspace provided, just fetch knowledge intended for internal saas
            query = query.in('visibility', ['internal_support', 'public', 'private_admin']);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ success: true, knowledge: data });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const denied = await requireGodModeAccess();
    if (denied) return denied;

    const body = await req.json();
    const sb = getAdmin();

    try {
        const { action, id, workspace_id, content, title, source_type = 'manual', visibility = 'public' } = body;

        if (action === 'create' || action === 'update') {
            if (!content || !title) {
                return NextResponse.json({ success: false, error: 'Title and Content are required' }, { status: 400 });
            }

            const payload = {
                workspace_id,
                title,
                content,
                source_type,
                visibility,
                updated_at: new Date().toISOString(),
            };

            if (action === 'create') {
                const { error } = await sb.from('business_knowledge').insert(payload);
                if (error) throw error;
            } else {
                const { error } = await sb.from('business_knowledge').update(payload).eq('id', id);
                if (error) throw error;
            }
        } else if (action === 'delete') {
            if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
            const { error } = await sb.from('business_knowledge').delete().eq('id', id);
            if (error) throw error;
        } else {
            return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
