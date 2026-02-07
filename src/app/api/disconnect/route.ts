import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
    try {
        const { accountId } = await req.json();

        // 1. Unipile Delete
        const dsn = process.env.UNIPILE_DSN || '';
        let baseUrl = 'https://api23.unipile.com:15397';
        let apiKey = process.env.UNIPILE_API_KEY || '';
        if (dsn.includes('@')) {
            const [proto, rest] = dsn.split('://');
            const [auth, domain] = rest.split('@');
            baseUrl = `${proto}://${domain}`;
            apiKey = auth;
        }

        const res = await fetch(`${baseUrl}/api/v1/accounts/${accountId}`, {
            method: 'DELETE',
            headers: { 'X-API-KEY': apiKey }
        });

        // 2. Supabase Delete
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        await supabase.from('user_connections').delete().eq('account_id', accountId);

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
