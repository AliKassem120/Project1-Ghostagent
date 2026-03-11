import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
    console.log("[Status] Checking Instagram Status...");
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.log("[Status] No user logged in.");
            return NextResponse.json({ connected: false, accounts: [] });
        }

        // Optional workspace_id filter — shows only connections for that workspace
        const workspaceId = request.nextUrl.searchParams.get('workspace_id');

        if (!workspaceId) {
            console.log("[Status] No workspace_id provided.");
            return NextResponse.json({ connected: false, accounts: [] });
        }

        // 1. Check database
        const { data: dbConnections, error } = await supabase
            .from('instagram_integrations')
            .select('*')
            .eq('workspace_id', workspaceId);

        if (error) {
            console.error("[Status] DB Error:", error);
            return NextResponse.json({ connected: false, error: error.message });
        }

        console.log(`[Status] Found ${dbConnections?.length || 0} connections for workspace ${workspaceId}`);

        if (dbConnections && dbConnections.length > 0) {
            const accounts = dbConnections.map(conn => {
                let name = conn.account_username || 'Connected Account';

                return {
                    id: conn.instagram_account_id,
                    username: name,
                    provider: 'INSTAGRAM',
                    connected_at: conn.connected_at
                };
            });

            return NextResponse.json({
                connected: true,
                accounts: accounts
            });
        }

        return NextResponse.json({ connected: false, accounts: [] });

    } catch (error: any) {
        console.error('[Status] Check error:', error);
        return NextResponse.json({ connected: false, error: error.message }, { status: 500 });
    }
}
