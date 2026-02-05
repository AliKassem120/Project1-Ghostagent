import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const unipileKey = process.env.UNIPILE_API_KEY;

    if (!unipileKey) {
        return NextResponse.json({ error: 'Configuration Error: Missing UNIPILE_API_KEY' }, { status: 500 });
    }

    try {
        const { redirectUrl } = await req.json();

        const response = await fetch('https://api23.unipile.com:15397/api/v1/hosted/accounts/link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': unipileKey,
            },
            body: JSON.stringify({
                type: 'create',
                providers: ['instagram'],
                api_url: 'https://project1-ghostagent.vercel.app', // Base URL for the accounts
                expiresOn: new Date(Date.now() + 3600 * 1000 * 24).toISOString(), // 24 hours link validity
                redirectUrl: redirectUrl || 'https://project1-ghostagent.vercel.app/dashboard/settings',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Unipile Error:', errorText);
            return NextResponse.json({ error: `Unipile API Failed: ${response.statusText}` }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (e: any) {
        console.error('Connect Route Error:', e);
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}
