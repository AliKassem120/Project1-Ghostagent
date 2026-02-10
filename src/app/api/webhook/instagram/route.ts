import { NextRequest, NextResponse } from "next/server";

// Keep your existing GET function here...
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

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log("Incoming Payload:", JSON.stringify(body));

        // 1. Check if this is an Instagram event
        if (body.object === "instagram") {

            // Loop through entries
            for (const entry of body.entry) {

                // Loop through messaging events
                for (const event of entry.messaging) {

                    // 🛑 CRITICAL FIX: Ignore "Echoes" (Bot's own messages)
                    if (event.message?.is_echo) {
                        console.log("⚠️ Ignoring Bot's own message (Echo)");
                        continue; // Skip to the next event
                    }

                    // 🛑 Ignore "Delivery" or "Read" receipts (no text)
                    if (event.delivery || event.read) {
                        console.log("⚠️ Ignoring Delivery/Read receipt");
                        continue;
                    }

                    const senderId = event.sender.id;
                    const messageText = event.message?.text;

                    if (messageText) {
                        console.log(`📩 Received from ${senderId}: ${messageText}`);

                        // Send the Reply
                        await sendReply(senderId, `I received your message: ${messageText}`);
                    }
                }
            }
        }

        return new NextResponse("EVENT_RECEIVED", { status: 200 });
    } catch (error) {
        console.error("❌ POST Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

// Your helper function to send messages
async function sendReply(recipientId: string, text: string) {
    // Using INSTAGRAM_PAGE_ACCESS_TOKEN as confirmed in previous steps
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
    const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`;

    if (!token) {
        console.error("❌ REPLY FAILED: Missing Access Token");
        return;
    }

    const body = {
        recipient: { id: recipientId },
        message: { text: text },
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        if (data.error) {
            console.error("❌ REPLY FAILED:", data);
        } else {
            console.log("✅ REPLY SENT:", data);
        }
    } catch (fetchError) {
        console.error("❌ FETCH ERROR:", fetchError);
    }
}
