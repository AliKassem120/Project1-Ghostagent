import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
    try {
        const { accountId, workspaceId } = await req.json();

        if (!accountId || !workspaceId) {
            return NextResponse.json({ error: 'Missing accountId or workspaceId' }, { status: 400 });
        }

        const supabase = await createClient(); // Use server client to respect RLS or check session
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only delete if it belongs to the user and the workspace
        const { error } = await supabase
            .from('instagram_integrations')
            .delete()
            .eq('instagram_account_id', accountId)
            .eq('workspace_id', workspaceId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
