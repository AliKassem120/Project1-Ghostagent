import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET: list team members for the active workspace
export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

    const { data, error } = await supabase
        .from('workspace_members')
        .select('id, invite_email, role, status, invited_at, accepted_at')
        .eq('workspace_id', workspaceId)
        .eq('owner_id', user.id)
        .neq('status', 'revoked')
        .order('invited_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ members: data });
}

// POST: invite a team member
export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify user is on Empire plan
    const { data: userData } = await supabase.from('users').select('plan_tier').eq('id', user.id).single();
    if ((userData?.plan_tier || '').toLowerCase() !== 'empire') {
        return NextResponse.json({ error: 'Team access requires the Empire plan.' }, { status: 403 });
    }

    const { workspaceId, email, role } = await req.json();
    if (!workspaceId || !email || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    // Check workspace belongs to this user
    const { data: ws } = await supabase.from('ai_settings').select('id').eq('id', workspaceId).eq('user_id', user.id).single();
    if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    // Don't re-invite same email
    const { data: existing } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('invite_email', email.toLowerCase())
        .neq('status', 'revoked')
        .maybeSingle();

    if (existing) return NextResponse.json({ error: 'This email already has an active invite.' }, { status: 409 });

    // Check team size limit (max 3 members per workspace)
    const { count } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('owner_id', user.id)
        .neq('status', 'revoked');

    if ((count || 0) >= 3) {
        return NextResponse.json({ error: 'Maximum 3 team members per workspace.' }, { status: 400 });
    }

    const { data: member, error } = await supabase.from('workspace_members').insert({
        workspace_id: workspaceId,
        owner_id: user.id,
        invite_email: email.toLowerCase(),
        role: role,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // TODO: send invite email via Resend/SendGrid
    // For now, return the invite link concept
    return NextResponse.json({ member, message: 'Invite sent!' });
}

// DELETE: revoke a team member
export async function DELETE(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const memberId = req.nextUrl.searchParams.get('memberId');
    if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 });

    const { error } = await supabase
        .from('workspace_members')
        .update({ status: 'revoked' })
        .eq('id', memberId)
        .eq('owner_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
