import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const unipileKey = process.env.UNIPILE_API_KEY;

        if (!user) {
            return NextResponse.json({ connected: false, accounts: [] });
        }

        // 1. Check database first (fastest)
        const { data: dbConnections } = await supabase
            .from('user_connections')
            .select('*')
            .eq('user_id', user.id)
            .eq('provider', 'INSTAGRAM');

        if (dbConnections && dbConnections.length > 0) {
            return NextResponse.json({
                connected: true,
                accounts: dbConnections.map(conn => ({
                    id: conn.account_id,
                    username: conn.account_username || 'Instagram Account',
                    provider: conn.provider
                }))
            });
        }

        // 2. Fallback: Check Unipile API directly (in case webhook failed)
        if (!unipileKey) {
            return NextResponse.json({ connected: false, accounts: [] });
        }

        try {
            const unipileResponse = await fetch('https://api23.unipile.com:15397/api/v1/accounts', {
                method: 'GET',
                headers: {
                    'X-API-KEY': unipileKey,
                    'accept': 'application/json'
                }
            });

            if (unipileResponse.ok) {
                const data = await unipileResponse.json();
                const instagramAccounts = Array.isArray(data.items)
                    ? data.items.filter((acc: any) => acc.provider === 'INSTAGRAM')
                    : [];

                // If we found accounts in Unipile but not in DB, save them
                if (instagramAccounts.length > 0) {
                    for (const acc of instagramAccounts) {
                        await supabase.from('user_connections').upsert({
                            user_id: user.id,
                            provider: 'INSTAGRAM',
                            account_id: acc.account_id,
                            account_username: acc.username || null,
                            metadata: acc
                        }, {
                            onConflict: 'user_id,provider'
                        });
                    }

                    return NextResponse.json({
                        connected: true,
                        accounts: instagramAccounts.map((acc: any) => ({
                            id: acc.account_id,
                            username: acc.username || 'Instagram Account',
                            provider: acc.provider
                        }))
                    });
                }
            }
        } catch (apiError) {
            console.error('Unipile API fallback error:', apiError);
        }

        return NextResponse.json({ connected: false, accounts: [] });

    } catch (error: any) {
        console.error('Status check error:', error);
        return NextResponse.json({ connected: false, error: error.message }, { status: 500 });
    }
}
