import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
    console.log("[Status] Checking Instagram Status...");
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.log("[Status] No user logged in.");
            return NextResponse.json({ connected: false, accounts: [] });
        }

        // 1. Check database
        // Look for provider='INSTAGRAM' (Meta Graph API)
        const { data: dbConnections, error } = await supabase
            .from('user_connections')
            .select('*')
            .eq('user_id', user.id)
            .eq('provider', 'INSTAGRAM');

        if (error) {
            console.error("[Status] DB Error:", error);
            return NextResponse.json({ connected: false, error: error.message });
        }

        console.log(`[Status] Found ${dbConnections?.length || 0} connections for user ${user.id}`);

        if (dbConnections && dbConnections.length > 0) {
            const accounts = dbConnections.map(conn => {
                // Determine display name
                let name = conn.account_username;
                const meta = conn.metadata || {};

                // DEBUG LOGGING
                if (meta.pages && Array.isArray(meta.pages)) {
                    meta.pages.forEach((p: any, i: number) => {
                        console.log(`[Status Debug] Page ${i} (ID: ${p.id}): Has IG? ${!!p.instagram_business_account}`);
                        if (p.instagram_business_account) {
                            console.log(`[Status Debug] IG ID: ${p.instagram_business_account.id}`);
                        }
                    });
                }

                // If username is missing, try to find it in metadata or fallback
                if (!name) {
                    if (meta.pages && Array.isArray(meta.pages) && meta.pages.length > 0) {
                        name = meta.pages[0].name; // Use first page name
                    } else if (meta.username) {
                        name = meta.username;
                    } else {
                        name = 'Connected Account';
                    }
                }

                return {
                    id: conn.account_id,
                    username: name,
                    provider: conn.provider,
                    metadata: meta
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
