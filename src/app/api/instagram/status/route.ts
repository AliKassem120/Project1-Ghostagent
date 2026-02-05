import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ connected: false, accounts: [] });
        }

        // Fetch connections from database
        const { data: connections, error } = await supabase
            .from('user_connections')
            .select('*')
            .eq('user_id', user.id)
            .eq('provider', 'INSTAGRAM');

        if (error) {
            console.error('Error fetching connections:', error);
            return NextResponse.json({ connected: false, accounts: [] });
        }

        const instagramAccounts = connections || [];

        return NextResponse.json({
            connected: instagramAccounts.length > 0,
            accounts: instagramAccounts.map(conn => ({
                id: conn.account_id,
                username: conn.account_username || 'Instagram Account',
                provider: conn.provider
            }))
        });

    } catch (error: any) {
        console.error('Status check error:', error);
        return NextResponse.json({ connected: false, error: error.message }, { status: 500 });
    }
}
