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

    try {
        const { data: flags, error } = await sb
            .from('bot_control_flags')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Enrich workspace-scoped flags with workspace names
        const wsIds = [...new Set((flags || []).map((f: any) => f.workspace_id).filter(Boolean))];
        const { data: workspaces } = await sb
            .from('ai_settings')
            .select('id, name')
            .in('id', wsIds.length > 0 ? wsIds : ['__none__']);

        const wsMap = new Map<string, string>();
        (workspaces || []).forEach((w: any) => wsMap.set(w.id, w.name));

        const result = (flags || []).map((f: any) => ({
            ...f,
            workspaceName: wsMap.get(f.workspace_id) || null,
        }));

        return NextResponse.json({ success: true, flags: result });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const denied = await requireGodModeAccess();
    if (denied) return denied;

    const sb = getAdmin();
    const body = await req.json();
    const { action, scope, workspaceId, chatId, pauseDms, pauseComments, forceDraft, disableExternalSends, reason, flagId } = body;

    try {
        // Delete a flag
        if (action === 'delete' && flagId) {
            await sb.from('bot_control_flags').delete().eq('id', flagId);
            return NextResponse.json({ success: true, message: 'Flag deleted' });
        }

        // Update existing flag
        if (action === 'update' && flagId) {
            await sb.from('bot_control_flags').update({
                pause_dms: pauseDms ?? false,
                pause_comments: pauseComments ?? false,
                force_draft: forceDraft ?? false,
                disable_external_sends: disableExternalSends ?? false,
                reason: reason || null,
                updated_at: new Date().toISOString(),
            }).eq('id', flagId);
            return NextResponse.json({ success: true, message: 'Flag updated' });
        }

        // Create new flag
        if (action === 'create' && scope) {
            if (!['global', 'workspace', 'chat'].includes(scope)) {
                return NextResponse.json({ success: false, error: 'scope must be global, workspace, or chat' }, { status: 400 });
            }
            if (scope === 'workspace' && !workspaceId) {
                return NextResponse.json({ success: false, error: 'workspaceId required for workspace scope' }, { status: 400 });
            }
            if (scope === 'chat' && !chatId) {
                return NextResponse.json({ success: false, error: 'chatId required for chat scope' }, { status: 400 });
            }

            // Upsert: check if a flag with same scope+workspace+chat already exists
            const existingQuery = sb.from('bot_control_flags').select('id').eq('scope', scope);
            if (scope === 'global') {
                // Only one global flag
            } else if (scope === 'workspace') {
                existingQuery.eq('workspace_id', workspaceId);
            } else if (scope === 'chat') {
                existingQuery.eq('chat_id', chatId);
            }

            const { data: existing } = await existingQuery.limit(1).maybeSingle();

            if (existing) {
                await sb.from('bot_control_flags').update({
                    pause_dms: pauseDms ?? false,
                    pause_comments: pauseComments ?? false,
                    force_draft: forceDraft ?? false,
                    disable_external_sends: disableExternalSends ?? false,
                    reason: reason || null,
                    updated_at: new Date().toISOString(),
                }).eq('id', existing.id);
                return NextResponse.json({ success: true, message: 'Flag updated (existing)' });
            }

            await sb.from('bot_control_flags').insert({
                scope,
                workspace_id: workspaceId || null,
                chat_id: chatId || null,
                pause_dms: pauseDms ?? false,
                pause_comments: pauseComments ?? false,
                force_draft: forceDraft ?? false,
                disable_external_sends: disableExternalSends ?? false,
                reason: reason || null,
                created_by: 'god_mode',
            });

            return NextResponse.json({ success: true, message: 'Flag created' });
        }

        // Resume all (delete all flags)
        if (action === 'resume-all') {
            await sb.from('bot_control_flags').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything
            return NextResponse.json({ success: true, message: 'All flags removed' });
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
