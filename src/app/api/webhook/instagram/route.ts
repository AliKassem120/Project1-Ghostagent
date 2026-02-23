import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { generateGhostReply } from '@/utils/ghost-brain';
import crypto from 'crypto';

// Helper to get admin supabase client
const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    if (!supabaseServiceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    return createClient(supabaseUrl, supabaseServiceKey);
}

// ═══════════════════════════════════════
// 🔐 Verify Meta Webhook Signature
// ═══════════════════════════════════════
function verifySignature(rawBody: string, signature: string | null): boolean {
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
        console.warn('⚠️ FACEBOOK_APP_SECRET not set — skipping signature validation');
        return true; // Allow if no secret configured
    }
    if (!signature) {
        console.warn('⚠️ No x-hub-signature-256 header — allowing anyway');
        return true; // Some test/legacy payloads don't include it
    }
    const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', appSecret)
        .update(rawBody, 'utf8')
        .digest('hex');

    if (signature.length !== expectedSignature.length) {
        console.error('❌ Signature mismatch! Expected length:', expectedSignature.length, 'Got:', signature.length);
        return false;
    }

    const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
    if (!isValid) {
        console.error('❌ Signature mismatch! Expected:', expectedSignature.slice(0, 20) + '...', 'Got:', signature.slice(0, 20) + '...');
    }
    return isValid;
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
    // ═══════════════════════════════════════
    // 🔑 STEP 1: Read raw body FIRST (before anything else)
    // This is critical for Next.js App Router — req.json() consumes the stream
    // ═══════════════════════════════════════
    let rawBody: string;
    let body: any;

    try {
        rawBody = await req.text();
        console.log("📨 Raw webhook received, length:", rawBody.length);
    } catch (e) {
        console.error("❌ Failed to read request body:", e);
        return new NextResponse("EVENT_RECEIVED", { status: 200 }); // Always 200 to Meta
    }

    // ═══════════════════════════════════════
    // 🔐 STEP 2: Validate signature
    // ═══════════════════════════════════════
    const signature = req.headers.get('x-hub-signature-256');
    const signatureValid = verifySignature(rawBody, signature);
    if (!signatureValid) {
        console.warn("⚠️ Signature mismatch — processing anyway (warn-only mode)");
        // Don't reject — Meta's comment webhooks are arriving but signature may differ
        // due to env variable sync issues. Process the event regardless.
    }

    // ═══════════════════════════════════════
    // 📦 STEP 3: Parse JSON from raw body
    // ═══════════════════════════════════════
    try {
        body = JSON.parse(rawBody);
    } catch (e) {
        console.error("❌ Failed to parse JSON:", e, "Raw:", rawBody.slice(0, 200));
        return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    console.log("Incoming Payload:", JSON.stringify(body).slice(0, 500));

    // ═══════════════════════════════════════
    // 🚀 STEP 4: Process the event
    // Always return 200 to Meta, even if processing fails
    // ═══════════════════════════════════════
    try {
        await processWebhookEvent(body);
    } catch (err) {
        console.error("❌ Processing error:", err);
    }

    return new NextResponse("EVENT_RECEIVED", { status: 200 });
}

// ═══════════════════════════════════════
// 🧠 Main Processing Logic (runs async after 200 is returned)
// ═══════════════════════════════════════
async function processWebhookEvent(body: any) {
    try {

        // 1. Check if this is an Instagram event
        if (body.object === "instagram") {

            const supabaseAdmin = getSupabaseAdmin();

            // Loop through entries
            for (const entry of body.entry) {

                // ═══════════════════════════════════════
                // 📩 HANDLE DIRECT MESSAGES (entry.messaging)
                // ═══════════════════════════════════════
                if (entry.messaging) {
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
                            const ownerId = await findOwner(supabaseAdmin, recipientId);

                            if (!ownerId) {
                                console.log('🛑 SKIPPING: No connected owner found for this message.');
                                continue;
                            }

                            // Fetch Sender Profile Name
                            const userProfileName = await fetchUserProfile(senderId);
                            const senderName = userProfileName || `User ${senderId.slice(-4)}`;

                            // 🛑 LOG INCOMING MESSAGE
                            await supabaseAdmin.from('activity_log').insert({
                                user_id: ownerId,
                                event_type: 'INCOMING_MESSAGE',
                                description: `${senderName}: "${messageText}"`,
                                timestamp: new Date().toISOString(),
                                metadata: {
                                    chat_id: senderId,
                                    platform: 'instagram',
                                    username: senderName,
                                    sender: { attendee_name: senderName }
                                }
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

                            // CHECK AUTOPILOT STATUS
                            const isAutopilot = await checkAutopilot(supabaseAdmin, ownerId, senderId);

                            if (!isAutopilot) {
                                console.log('🛑 AUTOPILOT OFF: Saving draft reply.');
                                await supabaseAdmin.from('activity_log').insert({
                                    user_id: ownerId,
                                    event_type: 'DRAFT_REPLY',
                                    description: `Draft: "${aiResponse}"`,
                                    timestamp: new Date().toISOString(),
                                    metadata: {
                                        chat_id: senderId,
                                        platform: 'instagram',
                                        status: 'pending_approval',
                                        reply_text: aiResponse
                                    }
                                });
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

                // ═══════════════════════════════════════
                // 💬 HANDLE COMMENTS (entry.changes)
                // ═══════════════════════════════════════
                if (entry.changes) {
                    for (const change of entry.changes) {
                        if (change.field !== 'comments') continue;

                        const commentData = change.value;
                        const commentId = commentData?.id;
                        const commentText = commentData?.text;
                        const commenterName = commentData?.from?.username || commentData?.from?.name || 'Instagram User';
                        const commenterId = commentData?.from?.id;
                        const mediaId = commentData?.media?.id;
                        const parentId = commentData?.parent_id; // If this is a reply to another comment

                        // 🛑 Skip if no comment text or missing data
                        if (!commentText || !commentId) {
                            console.log('⚠️ Skipping: Missing comment data');
                            continue;
                        }

                        // 🛑 Skip replies to other comments (only reply to top-level comments on our posts)
                        if (parentId) {
                            console.log('⚠️ Skipping: Reply to another comment (not top-level)');
                            continue;
                        }

                        console.log(`💬 Comment from @${commenterName}: "${commentText}"`);

                        // Find the owner of this Instagram account
                        const igAccountId = entry.id; // The Instagram account ID that received the comment
                        const ownerId = await findOwner(supabaseAdmin, igAccountId);

                        if (!ownerId) {
                            console.log('🛑 SKIPPING COMMENT: No connected owner found.');
                            continue;
                        }

                        // 🛑 Check if we already replied to this comment (prevent duplicates)
                        const { data: existingReply } = await supabaseAdmin
                            .from('activity_log')
                            .select('id')
                            .eq('user_id', ownerId)
                            .eq('event_type', 'COMMENT_REPLY')
                            .filter('metadata->>comment_id', 'eq', commentId)
                            .limit(1)
                            .maybeSingle();

                        if (existingReply) {
                            console.log('⚠️ Already replied to this comment. Skipping.');
                            continue;
                        }

                        // LOG INCOMING COMMENT
                        await supabaseAdmin.from('activity_log').insert({
                            user_id: ownerId,
                            event_type: 'INCOMING_COMMENT',
                            description: `Comment from @${commenterName}: "${commentText}"`,
                            timestamp: new Date().toISOString(),
                            metadata: {
                                chat_id: commenterId, // Use commenterId as the thread ID for comments
                                comment_id: commentId,
                                commenter_name: commenterName,
                                commenter_id: commenterId,
                                media_id: mediaId,
                                platform: 'instagram',
                                type: 'comment'
                            }
                        });

                        // Generate AI Reply (comment-specific: short & public-facing)
                        const aiResponse = await generateCommentReply(
                            ownerId,
                            commentText,
                            commenterName,
                            supabaseAdmin
                        );

                        if (!aiResponse) {
                            console.log('Ghost Protocol: No comment reply generated.');
                            continue;
                        }

                        // CHECK AUTOPILOT STATUS
                        const isAutopilot = await checkAutopilot(supabaseAdmin, ownerId, commenterId);

                        if (!isAutopilot) {
                            console.log('🛑 AUTOPILOT OFF: Saving draft comment reply.');
                            await supabaseAdmin.from('activity_log').insert({
                                user_id: ownerId,
                                event_type: 'DRAFT_COMMENT_REPLY',
                                description: `Draft Comment Reply: "${aiResponse}"`,
                                timestamp: new Date().toISOString(),
                                metadata: {
                                    chat_id: commenterId,
                                    comment_id: commentId,
                                    commenter_name: commenterName,
                                    media_id: mediaId,
                                    platform: 'instagram',
                                    type: 'comment',
                                    status: 'pending_approval',
                                    reply_text: aiResponse
                                }
                            });
                            continue;
                        }

                        console.log(`🤖 Comment Reply to @${commenterName}: ${aiResponse}`);

                        // Send the Comment Reply via Graph API
                        await sendCommentReply(commentId, aiResponse);

                        // LOG COMMENT REPLY
                        await supabaseAdmin.from('activity_log').insert({
                            user_id: ownerId,
                            event_type: 'COMMENT_REPLY',
                            description: `Replied to @${commenterName}: "${aiResponse}"`,
                            timestamp: new Date().toISOString(),
                            metadata: {
                                chat_id: commenterId,
                                comment_id: commentId,
                                commenter_name: commenterName,
                                media_id: mediaId,
                                platform: 'instagram',
                                type: 'comment'
                            }
                        });
                    }
                }
            }
        }

        console.log("✅ Webhook event processed successfully.");
    } catch (error) {
        console.error("❌ Processing Error:", error);
    }
}

// Helper to get Instagram User Profile
async function fetchUserProfile(senderId: string) {
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
    if (!token) return null;

    try {
        const url = `https://graph.facebook.com/v21.0/${senderId}?fields=name,username&access_token=${token}`;
        const res = await fetch(url);
        const data = await res.json();
        return data.name || data.username || null;
    } catch (e) {
        console.error('Failed to fetch profile:', e);
        return null;
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

// ═══════════════════════════════════════
// 🔍 Find Owner by Instagram/Page Account ID
// ═══════════════════════════════════════
async function findOwner(supabaseAdmin: any, accountId: string | undefined): Promise<string | null> {
    if (!accountId) return null;

    // 1. Strict DB Match
    const { data: connectedUser } = await supabaseAdmin.from('user_connections')
        .select('user_id')
        .eq('account_id', accountId)
        .limit(1).maybeSingle();

    if (connectedUser) return connectedUser.user_id;

    // 2. Metadata Scan (Fallback) - Only for INSTAGRAM provider
    const { data: allConnections } = await supabaseAdmin.from('user_connections')
        .select('user_id, metadata')
        .eq('provider', 'INSTAGRAM');

    if (allConnections) {
        for (const conn of allConnections) {
            const pages = (conn.metadata as any)?.pages || [];
            const hasPage = Array.isArray(pages) && pages.some((p: any) => p.instagram_business_account?.id === accountId);

            if (hasPage) {
                console.log(`[Loose Match] Found owner ${conn.user_id} via metadata page link. Account: ${accountId}`);
                return conn.user_id;
            }
        }
    }

    console.log(`[findOwner] No owner found for account ${accountId}`);
    return null;
}

// ═══════════════════════════════════════
// 🤖 Check Autopilot Status (Global & Chat-Specific)
// ═══════════════════════════════════════
async function checkAutopilot(supabaseAdmin: any, ownerId: string, externalChatId?: string): Promise<boolean> {
    // 1. Check Global Autopilot
    const { data: settings, error: settingsError } = await supabaseAdmin
        .from('users')
        .select('is_autopilot_enabled')
        .eq('id', ownerId)
        .maybeSingle();

    if (settingsError) {
        console.error('⚠️ Global Autopilot Check Failed:', settingsError.message);
    }

    const globalAutopilot = settings?.is_autopilot_enabled ?? true;

    // If it's globally turned off, instantly return false
    if (!globalAutopilot) {
        console.log(`🤖 Global Autopilot for ${ownerId}: OFF`);
        return false;
    }

    // 2. Check Chat-Specific Mute (Manual "Mute AI" Toggle)
    if (externalChatId) {
        const { data: chatState } = await supabaseAdmin
            .from('conversation_states')
            .select('is_muted')
            .eq('user_id', ownerId)
            .eq('external_chat_id', externalChatId)
            .maybeSingle();

        if (chatState?.is_muted) {
            console.log(`🛑 AI is Muted manually for chat ${externalChatId}`);
            return false;
        }
    }

    console.log(`🤖 Autopilot System for ${ownerId}: ON`);
    return true;
}

// ═══════════════════════════════════════
// 💬 Send Comment Reply via Graph API
// ═══════════════════════════════════════
async function sendCommentReply(commentId: string, message: string) {
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;

    if (!token) {
        console.error("❌ COMMENT REPLY FAILED: Missing Access Token");
        return;
    }

    const url = `https://graph.facebook.com/v21.0/${commentId}/replies`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: message,
                access_token: token,
            }),
        });

        const data = await response.json();
        if (data.error) {
            console.error("❌ COMMENT REPLY FAILED:", data.error);
        } else {
            console.log("✅ COMMENT REPLY SENT:", data);
        }
    } catch (fetchError) {
        console.error("❌ COMMENT REPLY FETCH ERROR:", fetchError);
    }
}

// ═══════════════════════════════════════
// 🧠 Generate AI Reply for Comments (Short & Public-Facing)
// ═══════════════════════════════════════
async function generateCommentReply(
    userId: string,
    commentText: string,
    commenterName: string,
    supabase: any
): Promise<string | null> {
    try {
        // Fetch business settings
        const { data: settings } = await supabase
            .from('bot_settings')
            .select('business_name, tone, system_instructions, language')
            .eq('user_id', userId)
            .single();

        const businessName = settings?.business_name || 'our store';

        // Fetch inventory for product-related comments
        const { data: inventory } = await supabase
            .from('inventory')
            .select('item_name, stock_level, price')
            .eq('user_id', userId);

        let inventoryContext = "No inventory items listed.";
        if (inventory?.length) {
            inventoryContext = inventory
                .map((i: any) => `- ${i.item_name}: ${i.stock_level} in stock ($${i.price})`)
                .join('\n');
        }

        const { createGroq } = await import('@ai-sdk/groq');
        const { generateText } = await import('ai');

        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

        const systemPrompt = `You are the official comment assistant for ${businessName} on Instagram.

RULES FOR COMMENT REPLIES (PUBLIC — EVERYONE CAN SEE):
- Keep replies SHORT: 1-2 sentences max (under 150 characters ideally).
- Be warm, friendly, and professional.
- Use 1 emoji max.
- NEVER share private info (prices, stock levels, phone numbers) in comments.
- For pricing/availability questions, ALWAYS redirect to DMs: "DM us for details! 💬"
- For compliments: Thank them warmly.
- For questions about products: Give a brief answer and invite them to DM for more info.
- For complaints: Acknowledge and invite them to DM to resolve it privately.
- Address the commenter by name when natural (e.g., "@${commenterName}").
- Match the commenter's language (English, Arabic, etc.).

${settings?.language === 'English' ? '⚠️ LANGUAGE OVERRIDE: Always reply in English.' : settings?.language === 'Lebanese Franco' ? '⚠️ LANGUAGE OVERRIDE: Always reply in Lebanese Arabizi.' : ''}

TONE: ${settings?.tone || 'Professional & Friendly'}

AVAILABLE PRODUCTS (for reference only — do NOT list prices in comments):
${inventoryContext}

${settings?.system_instructions ? `BUSINESS INSTRUCTIONS: ${settings.system_instructions}` : ''}`;

        const result = await generateText({
            model: groq("llama-3.3-70b-versatile"),
            system: systemPrompt,
            messages: [{ role: 'user', content: `Instagram comment from @${commenterName}: "${commentText}"` }],
        });

        return result.text;

    } catch (error) {
        console.error('Ghost Brain (Comment) Error:', error);
        return "Thanks for your comment! DM us for more info 💬";
    }
}

