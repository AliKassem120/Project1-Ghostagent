import { NextResponse } from 'next/server';

export async function GET() {
    const unipileKey = process.env.UNIPILE_API_KEY;

    if (!unipileKey) {
        return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
    }

    try {
        // Fetch all connected accounts from Unipile
        const response = await fetch('https://api23.unipile.com:15397/api/v1/accounts', {
            method: 'GET',
            headers: {
                'X-API-KEY': unipileKey,
                'accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Unipile accounts fetch failed:', await response.text());
            return NextResponse.json({ connected: false, accounts: [] });
        }

        const data = await response.json();
        const instagramAccounts = Array.isArray(data.items)
            ? data.items.filter((acc: any) => acc.provider === 'INSTAGRAM')
            : [];

        return NextResponse.json({
            connected: instagramAccounts.length > 0,
            accounts: instagramAccounts.map((acc: any) => ({
                id: acc.account_id,
                username: acc.username || 'Instagram Account',
                provider: acc.provider
            }))
        });

    } catch (error: any) {
        console.error('Status check error:', error);
        return NextResponse.json({ connected: false, error: error.message }, { status: 500 });
    }
}
