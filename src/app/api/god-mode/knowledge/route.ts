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

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const sb = getAdmin();

    try {
        if (!workspaceId) {
            return NextResponse.json({ success: false, error: 'workspaceId is required for Knowledge Manager' }, { status: 400 });
        }

        const { data: wsData, error: wsError } = await sb
            .from('ai_settings')
            .select('is_internal, workspace_role, business_type')
            .eq('id', workspaceId)
            .maybeSingle();

        if (wsError || !wsData) {
            return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
        }

        if (!(wsData.is_internal === true || wsData.workspace_role === 'official_support' || wsData.business_type === 'saas_support')) {
            return NextResponse.json({ success: false, error: 'Not an official SaaS workspace' }, { status: 403 });
        }

        let query = sb
            .from('business_knowledge')
            .select('*')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false });

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

        let targetWorkspaceId = workspace_id;

        if (action === 'delete') {
            if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
            const { data: existingK } = await sb.from('business_knowledge').select('workspace_id').eq('id', id).maybeSingle();
            if (!existingK) return NextResponse.json({ success: false, error: 'Knowledge not found' }, { status: 404 });
            targetWorkspaceId = existingK.workspace_id;
        }

        if (!targetWorkspaceId) {
            return NextResponse.json({ success: false, error: 'workspace_id is required' }, { status: 400 });
        }

        const { data: wsData, error: wsError } = await sb
            .from('ai_settings')
            .select('user_id, is_internal, workspace_role, business_type')
            .eq('id', targetWorkspaceId)
            .maybeSingle();

        if (wsError || !wsData) {
            return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
        }

        if (!wsData.user_id) {
            return NextResponse.json({ success: false, error: 'Workspace owner user_id missing' }, { status: 500 });
        }

        if (!(wsData.is_internal === true || wsData.workspace_role === 'official_support' || wsData.business_type === 'saas_support')) {
            return NextResponse.json({ success: false, error: 'Not an official SaaS workspace' }, { status: 403 });
        }

        if (action === 'create' || action === 'update') {
            if (!content || !title) {
                return NextResponse.json({ success: false, error: 'Title and Content are required' }, { status: 400 });
            }

            const payload = {
                user_id: wsData.user_id,
                workspace_id: targetWorkspaceId,
                title,
                content,
                source_type,
                visibility,
                file_name: `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`,
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
