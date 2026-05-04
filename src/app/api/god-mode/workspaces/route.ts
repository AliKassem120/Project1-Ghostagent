import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGodModeAccess, redactSensitiveData } from '@/lib/god-mode/auth';

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
        const [
            { data: workspaces },
            { data: igIntegrations },
            { data: users },
            { data: latestActivities },
            { data: controlFlags },
        ] = await Promise.all([
            sb.from('ai_settings').select('*').order('created_at', { ascending: false }),
            sb.from('instagram_integrations').select('workspace_id, instagram_account_id, account_username, created_at'),
            sb.from('users').select('id, plan_tier, business_type'),
            sb.from('activity_log').select('workspace_id, event_type, timestamp').order('timestamp', { ascending: false }).limit(500),
            sb.from('bot_control_flags').select('scope, workspace_id, pause_dms, pause_comments, force_draft'),
        ]);

        const igMap = new Map<string, any>();
        (igIntegrations || []).forEach((ig: any) => { if (ig.workspace_id) igMap.set(ig.workspace_id, ig); });

        const userMap = new Map<string, any>();
        (users || []).forEach((u: any) => userMap.set(u.id, u));

        // Count errors per workspace from recent activity
        const errorMap = new Map<string, number>();
        const lastActivityMap = new Map<string, string>();
        (latestActivities || []).forEach((a: any) => {
            if (a.workspace_id) {
                if (a.event_type === 'ERROR' || a.event_type === 'SYSTEM_WARNING') {
                    errorMap.set(a.workspace_id, (errorMap.get(a.workspace_id) || 0) + 1);
                }
                if (!lastActivityMap.has(a.workspace_id)) {
                    lastActivityMap.set(a.workspace_id, a.timestamp);
                }
            }
        });

        // Check workspace-level pauses
        const pausedWorkspaces = new Set<string>();
        const draftWorkspaces = new Set<string>();
        (controlFlags || []).forEach((f: any) => {
            if (f.scope === 'workspace' && f.workspace_id) {
                if (f.pause_dms || f.pause_comments) pausedWorkspaces.add(f.workspace_id);
                if (f.force_draft) draftWorkspaces.add(f.workspace_id);
            }
        });

        const result = (workspaces || []).map((ws: any) => {
            const ig = igMap.get(ws.id);
            const owner = userMap.get(ws.user_id);
            return {
                id: ws.id,
                name: ws.name || 'Unnamed',
                businessType: ws.business_type || 'unknown',
                userId: ws.user_id,
                ownerPlan: owner?.plan_tier || 'free_trial',
                isInternal: ws.is_internal || false,
                workspaceRole: ws.workspace_role || 'customer',
                visibility: ws.visibility || 'normal',
                language: ws.language || 'Auto-Detect',
                tone: ws.tone,
                autopilot: ws.autopilot ?? false,
                commentAutoReply: ws.auto_comment_reply ?? false,
                commentReplyStyle: ws.comment_reply_style || 'public',
                instagramConnected: !!ig,
                instagramUsername: ig?.account_username || null,
                whatsappConnected: false, // TODO: add when whatsapp_integrations exists
                lastActivity: lastActivityMap.get(ws.id) || null,
                errorCount: errorMap.get(ws.id) || 0,
                paused: pausedWorkspaces.has(ws.id),
                forceDraft: draftWorkspaces.has(ws.id),
                createdAt: ws.created_at,
            };
        });

        return NextResponse.json({ success: true, workspaces: redactSensitiveData(result) });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
