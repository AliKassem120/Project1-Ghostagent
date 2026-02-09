import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const MY_SECRET_TOKEN = 'ghost_agent_secret';

    console.log('Verifying:', { mode, token, challenge });

    if (mode === 'subscribe' && token === MY_SECRET_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        return new Response(challenge, { status: 200 });
    }

    return new Response('Forbidden - Token Mismatch', { status: 403 });
}

export async function POST(request: NextRequest) {
    console.log(" [DEBUG] /api/webhook/instagram POST HIT");

    try {
        const body = await request.json();
        console.log(" [DEBUG] Incoming Payload:", JSON.stringify(body).slice(0, 500));

        const entry = body.entry?.[0];
        const messaging = entry?.messaging?.[0];

        if (!messaging) {
            console.log("Ignored: No messaging object.");
            return NextResponse.json({ status: 'ignored' });
        }

        // Check for Read Receipt (No message text)
        // Note: Read receipts usually have 'read' property, or 'delivery'. 
        if (!messaging.message || !messaging.message.text) {
            console.log("Ignored: Read Receipt or Non-Text Event (No .message.text)");
            return NextResponse.json({ status: 'ok' });
        }

        const senderId = messaging.sender.id;
        const text = messaging.message.text;

        console.log("Sender ID:", senderId);
        console.log("Message Text:", text);

        // Reply Logic
        const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
        if (!PAGE_ACCESS_TOKEN) {
            console.error("CRITICAL: Missing INSTAGRAM_PAGE_ACCESS_TOKEN");
            return NextResponse.json({ status: 'error', reason: 'Configuration Error' });
        }

        const replyText = "I received your message: " + text;
        console.log("Attempting to reply: ", replyText);

        const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: senderId },
                message: { text: replyText }
            })
        });

        const responseData = await response.json();

        if (response.ok) {
            console.log("REPLY SUCCESS:", responseData);
            return NextResponse.json({ status: 'success', data: responseData });
        } else {
            console.error("REPLY FAILED:", responseData);
            return NextResponse.json({ status: 'error', details: responseData });
        }

    } catch (error) {
        console.error("CRITICAL POST ERROR:", error);
        return NextResponse.json({ status: 'error', message: String(error) }, { status: 500 });
    }
}
