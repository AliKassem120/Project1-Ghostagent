import { NextResponse } from 'next/server';

export async function POST() {
    const UNIPILE_KEY = process.env.UNIPILE_API_KEY;
    const UNIPILE_URL = 'https://api4.unipile.com:15373/api/v1/hosted/accounts/link';

    try {
        const response = await fetch(UNIPILE_URL, {
            method: 'POST',
            headers: {
                'X-API-KEY': UNIPILE_KEY as string,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify({
                type: 'create',
                providers: ['instagram'],
                api_url: 'https://project1-ghostagent.vercel.app',
                expiresOn: new Date(Date.now() + 3600 * 1000 * 24).toISOString()
            })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('Unipile Error:', data);
            return NextResponse.json({ error: data.message || 'Failed to connect' }, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
