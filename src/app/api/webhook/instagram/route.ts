import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { generateGhostReply } from '@/utils/ghost-brain';

// Helper to get admin supabase client
const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    if (!supabaseServiceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    return createClient(supabaseUrl, supabaseServiceKey);
}

// Keep your existing GET function
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
        console.log("Incoming Payload:", JSON.stringify(body).slice(0, 500));

        // 1. Check if this is an Instagram event
        if (body.object === "instagram") {

            const supabaseAdmin = getSupabaseAdmin();

            // Loop through entries
            for (const entry of body.entry) {

                // Loop through messaging events
                for (const event of entry.messaging) {

                    // 🛑 CRITICAL FIX: Ignore "Echoes" (Bot's own messages)
                    if (event.message?.is_echo) {
                        console.log("⚠️ Ignoring Bot's own message (Echo)");
                        continue;
                    }

                    // 🛑 Ignore "Delivery" or "Read" receipts
                    if (event.delivery || event.read) {
                        console.log("⚠️ Ignoring Delivery/Read receipt");
                        continue;
                    }

                    const senderId = event.sender.id;
                    const messageText = event.message?.text;
                    const recipientId = event.recipient?.id;

                    if (messageText) {
                        console.log(`📩 Received from ${senderId}: ${messageText}`);

                        // 2. Identify Owner (STRICT LOGIC with Metadata Fallback)
                        let ownerId;

                        if (recipientId) {
                            // 1. Strict DB Match
                            // Try to find the exact account_id match first (fastest)
                            const { data: connectedUser } = await supabaseAdmin.from('user_connections')
                                .select('user_id')
                                .eq('account_id', recipientId)
                                .limit(1).maybeSingle();

                            if (connectedUser) {
                                ownerId = connectedUser.user_id;
                            } else {
                                // 2. Metadata Scan (Fallback) - Only for INSTAGRAM provider
                                // The stored account_id might be the Facebook Page ID (e.g. 122...), 
                                // but webhook sends Instagram ID (e.g. 178...).
                                // We check if any connected page in metadata links to this IG ID.

                                const { data: allConnections } = await supabaseAdmin.from('user_connections')
                                    .select('user_id, metadata')
                                    .eq('provider', 'INSTAGRAM'); // Check exact provider string stored

                                if (allConnections) {
                                    for (const conn of allConnections) {
                                        // Metadata structure: { pages: [{ instagram_business_account: { id: "178..." } }] }
                                        const pages = (conn.metadata as any)?.pages || [];
                                        const hasPage = Array.isArray(pages) && pages.some((p: any) => p.instagram_business_account?.id === recipientId);

                                        if (hasPage) {
                                            console.log(`[Loose Match] Found owner ${conn.user_id} via metadata page link. Recipient: ${recipientId}`);
                                            ownerId = conn.user_id;
                                            break;
                                        }
                                    }
                                }

                                if (!ownerId) {
                                    console.log(`[Strict Check] No owner found for recipient ${recipientId} even after metadata scan. Bot will NOT reply.`);
                                }
                            }
                        }

                        if (!ownerId) {
                            console.log('🛑 SKIPPING: No connected owner found for this message.');
                            continue;
                        }

                        // Fetch Sender Profile Name
                        const pageToken = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
                        let senderName = "User";

                        if (pageToken) {
                            try {
                                const profileRes = await fetch(`https://graph.facebook.com/v21.0/${senderId}?fields=name,username&access_token=${pageToken}`);
                                const profileData = await profileRes.json();
                                senderName = profileData.name || profileData.username || "User";
                            } catch (e) {
                                console.error("Profile fetch error:", e);
                            }
                        }

                        // 🛑 LOG INCOMING MESSAGE
                        await supabaseAdmin.from('activity_log').insert({
                            user_id: ownerId,
                            event_type: 'INCOMING_MESSAGE',
                            description: `${senderName}: "${messageText}"`,
                            timestamp: new Date().toISOString(),
                            metadata: { chat_id: senderId, platform: 'instagram' }
                        });

                        // 3. AI Processing
                        const aiResponse = await generateGhostReply(
                            ownerId,
                            messageText,
                            supabaseAdmin,
                            senderId
                        );

                        if (!aiResponse) {
                            console.log('Ghost Protocol: No reply (handoff or empty).');
                            continue;
                        }

                        console.log('🤖 AI Reply:', aiResponse);

                        // 4. Send the Reply
                        await sendReply(senderId, aiResponse);

                        // 5. Log Activity
                        await supabaseAdmin.from('activity_log').insert({
                            user_id: ownerId,
                            event_type: 'AI_REPLY',
                            description: `Sent: "${aiResponse}"`,
                            timestamp: new Date().toISOString(),
                            metadata: { chat_id: senderId, platform: 'instagram' }
                        });
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
    // Using INSTAGRAM_PAGE_ACCESS_TOKEN
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
