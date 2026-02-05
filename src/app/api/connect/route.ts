import { NextResponse } from 'next/server';

export async function POST() {
    const UNIPILE_KEY = process.env.UNIPILE_API_KEY;
    const UNIPILE_URL = 'https://api4.unipile.com:15373/api/v1/hosted/accounts/link';

    if (!UNIPILE_KEY) {
        console.error('Missing UNIPILE_API_KEY');
        return NextResponse.json({ error: 'Server Configuration Error: Missing API Key' }, { status: 500 });
    }

    try {
        const response = await fetch(UNIPILE_URL, {
            method: 'POST',
            headers: {
                'X-API-KEY': UNIPILE_KEY,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify({
                type: 'create',
                providers: ['instagram'],
                api_url: 'https://project1-ghostagent.vercel.app',
                expiresOn: new Date(Date.now() + 3600 * 1000 * 24).toISOString(),
                success_redirect_url: 'https://project1-ghostagent.vercel.app/dashboard/settings',
                failure_redirect_url: 'https://project1-ghostagent.vercel.app/dashboard/settings?error=true',
                notify_url: 'https://project1-ghostagent.vercel.app/api/webhook'
            })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('Unipile Error:', JSON.stringify(data, null, 2));
            return NextResponse.json({ error: data.message || 'Failed to connect' }, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Connect Route Internal Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
