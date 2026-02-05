import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const UNIPILE_KEY = process.env.UNIPILE_API_KEY;
    // Switching back to api23 because it was reachable (returned 400), whereas api4 returned ECONNREFUSED.
    // The original 400 error was due to invalid parameters which are now fixed.
    const UNIPILE_URL = 'https://api23.unipile.com:15397/api/v1/hosted/accounts/link';

    // 1. Check for API Key
    if (!UNIPILE_KEY) {
        console.error('CRITICAL: UNIPILE_API_KEY is missing in environment variables.');
        return NextResponse.json({
            error: 'Configuration Error: UNIPILE_API_KEY is missing. Please add it to Vercel Environment Variables.'
        }, { status: 401 });
    }

    try {
        console.log(`Attempting to contact Unipile Link API at ${UNIPILE_URL}...`);

        // Context: 'name' helps link the connected account to a user in your system via webhooks
        let name = 'GhostUser';
        try {
            const body = await req.clone().json(); // Clone to avoid stream errors if read later
            if (body.userId) name = body.userId;
        } catch (e) { /* ignore request body errors */ }

        const response = await fetch(UNIPILE_URL, {
            method: 'POST',
            headers: {
                'X-API-KEY': UNIPILE_KEY,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify({
                type: 'create',
                providers: ['INSTAGRAM'], // MUST be uppercase per Unipile enum validation
                api_url: 'https://api23.unipile.com:15397',
                expiresOn: new Date(Date.now() + 3600 * 1000 * 24).toISOString(),
                success_redirect_url: 'https://project1-ghostagent.vercel.app/dashboard/settings',
                failure_redirect_url: 'https://project1-ghostagent.vercel.app/dashboard/settings?error=true',
                notify_url: 'https://project1-ghostagent.vercel.app/api/webhook',
                name: name
            })
        });

        // 2. Handle API Response
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Unipile API Error (${response.status}):`, errorText);

            let errorDetail = errorText;
            try {
                const errorJson = JSON.parse(errorText);
                errorDetail = errorJson.message || errorJson.detail || errorText;
            } catch (e) { /* ignore parse error */ }

            return NextResponse.json({
                error: `Unipile API Failed: ${errorDetail}`,
                details: errorText
            }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Connect Route EXCEPTION:', error);
        return NextResponse.json({
            error: 'Internal Server Error during connection attempt.',
            details: error.message
        }, { status: 500 });
    }
}
