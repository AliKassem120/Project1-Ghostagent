import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGodModeAccess } from '@/lib/god-mode/auth';

const getAdmin = () => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY required for God Mode');
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
};

const OFFICIAL_WORKSPACE_DEFAULTS = {
    business_name: 'Ghost Agent Official',
    name: 'Ghost Agent Official',
    business_type: 'saas_support',
    is_internal: true,
    workspace_role: 'official_support',
    visibility: 'god_mode_only',
    language: 'Auto-Detect',
    tone: 'Friendly',
    autopilot: true,
    use_emojis: true,
    timezone: 'Asia/Beirut',
    system_instructions: 'You are the official Ghost Agent representative. Answer from the knowledge base only. Never make up features or prices. If unsure, offer to connect with a human.',
};

/**
 * GET — Return the official saas_support workspace if it exists,
 *        along with Instagram connection and knowledge count.
 */
export async function GET(req: Request) {
    const denied = await requireGodModeAccess();
    if (denied) return denied;

    const sb = getAdmin();

    try {
        // Find official workspace
        const { data: workspace, error } = await sb
            .from('ai_settings')
            .select('*')
            .eq('workspace_role', 'official_support')
            .eq('is_internal', true)
            .maybeSingle();

        if (error) throw error;

        if (!workspace) {
            return NextResponse.json({ success: true, exists: false });
        }

        // Instagram connection
        const { data: igConn } = await sb
            .from('instagram_integrations')
            .select('instagram_account_id, account_username, connected_at')
            .eq('workspace_id', workspace.id)
            .maybeSingle();

        // WhatsApp connection (if table exists)
        let waConn = null;
        try {
            const { data } = await sb
                .from('whatsapp_integrations')
                .select('phone_number, connected_at')
                .eq('workspace_id', workspace.id)
                .maybeSingle();
            waConn = data;
        } catch {
            // Table might not exist
        }

        // Knowledge count
        const { count: knowledgeCount } = await sb
            .from('business_knowledge')
            .select('id', { count: 'exact', head: true })
            .or(`workspace_id.eq.${workspace.id},workspace_id.is.null`);

        // Bot control flags
        const { data: flags } = await sb
            .from('bot_control_flags')
            .select('*')
            .or(`scope.eq.global,and(scope.eq.workspace,workspace_id.eq.${workspace.id})`);

        const isPaused = (flags || []).some((f: any) =>
            f.pause_dms || f.pause_comments || f.disable_external_sends
        );

        return NextResponse.json({
            success: true,
            exists: true,
            workspace: {
                id: workspace.id,
                user_id: workspace.user_id,
                business_name: workspace.business_name,
                business_type: workspace.business_type,
                is_internal: workspace.is_internal,
                workspace_role: workspace.workspace_role,
                visibility: workspace.visibility,
                tone: workspace.tone,
                language: workspace.language,
                autopilot: workspace.autopilot,
            },
            instagram: igConn ? {
                connected: true,
                account_id: igConn.instagram_account_id,
                username: igConn.account_username,
                connected_at: igConn.connected_at,
            } : { connected: false },
            whatsapp: waConn ? {
                connected: true,
                phone_number: waConn.phone_number,
                connected_at: waConn.connected_at,
            } : { connected: false },
            knowledgeCount: knowledgeCount || 0,
            isPaused,
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * POST — Create the official saas_support workspace if it doesn't exist.
 */
export async function POST(req: Request) {
    const denied = await requireGodModeAccess();
    if (denied) return denied;

    const sb = getAdmin();

    try {
        // Check if already exists
        const { data: existing } = await sb
            .from('ai_settings')
            .select('id')
            .eq('workspace_role', 'official_support')
            .eq('is_internal', true)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({
                success: true,
                created: false,
                workspace_id: existing.id,
                message: 'Official workspace already exists',
            });
        }

        // Resolve owner user_id server-side
        let userId = process.env.GOD_MODE_OWNER_USER_ID;

        if (!userId && process.env.GOD_MODE_OWNER_EMAIL) {
            // Find by email using admin client
            const { data: userData, error: listError } = await sb.auth.admin.listUsers();
            if (!listError) {
                const targetUser = userData.users.find(u => u.email === process.env.GOD_MODE_OWNER_EMAIL);
                if (targetUser) userId = targetUser.id;
            }
        }

        if (!userId) {
            // first admin/founder user if role fields exist
            const { data: adminWs } = await sb
                .from('ai_settings')
                .select('user_id')
                .eq('workspace_role', 'admin')
                .limit(1)
                .maybeSingle();
            if (adminWs) userId = adminWs.user_id;
        }

        if (!userId) {
            // first users row as final fallback
            const { data: firstWs } = await sb.from('ai_settings').select('user_id').limit(1).maybeSingle();
            if (firstWs) {
                userId = firstWs.user_id;
            } else {
                const { data: userData } = await sb.auth.admin.listUsers();
                if (userData && userData.users.length > 0) {
                    userId = userData.users[0].id;
                }
            }
        }

        if (!userId) {
            return NextResponse.json({ 
                success: false, 
                error: 'Set GOD_MODE_OWNER_USER_ID or GOD_MODE_OWNER_EMAIL in env.' 
            }, { status: 400 });
        }

        // Create workspace
        const { data: newWorkspace, error } = await sb
            .from('ai_settings')
            .insert({
                user_id: userId,
                ...OFFICIAL_WORKSPACE_DEFAULTS,
            })
            .select('id')
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            created: true,
            workspace_id: newWorkspace.id,
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
