import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { generateGhostReply } from '@/utils/ghost-brain';
import { savePendingMessage, waitAndBatchMessages } from '@/utils/message-batcher';
import { containsAlertKeyword, triggerManagerAlert, ALERT_KEYWORDS } from '@/utils/whatsapp-alerts';
import crypto from 'crypto';
import { checkUserLimit } from '@/lib/billing';

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
    // New Instagram Login uses INSTAGRAM_APP_SECRET to sign webhooks
    const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
        console.warn('⚠️ INSTAGRAM_APP_SECRET not set — skipping signature validation');
        return true;
    }
    if (!signature) {
        console.warn('⚠️ No x-hub-signature-256 header — allowing anyway');
        return true;
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

// ═══════════════════════════════════════
// 🔑 GET — Meta Webhook Verification
// ═══════════════════════════════════════
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

// ═══════════════════════════════════════
// 📨 POST — Incoming Webhook Handler
// ═══════════════════════════════════════
export async function POST(req: Request) {
    // Step 1: Read raw body FIRST (Next.js App Router consumes the stream)
    let rawBody: string;
    let body: any;

    try {
        rawBody = await req.text();
        console.log("📨 Raw webhook received, length:", rawBody.length);
    } catch (e) {
        console.error("❌ Failed to read request body:", e);
        return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    // Step 2: Validate signature
    const signature = req.headers.get('x-hub-signature-256');
    const signatureValid = verifySignature(rawBody, signature);
    if (!signatureValid) {
        console.warn("⚠️ Signature mismatch — processing anyway (warn-only mode)");
    }

    // Step 3: Parse JSON
    try {
        body = JSON.parse(rawBody);
    } catch (e) {
        console.error("❌ Failed to parse JSON:", e, "Raw:", rawBody.slice(0, 200));
        return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    console.log("Incoming Payload:", JSON.stringify(body).slice(0, 500));

    // Step 4: Process the event (fire-and-forget for long processing)
    // Return 200 immediately to Meta, then process in background
    try {
        await processWebhookEvent(body);
    } catch (err) {
        console.error("❌ Processing error:", err);
    }

    return new NextResponse("EVENT_RECEIVED", { status: 200 });
}

// ═══════════════════════════════════════
// 🧠 Main Processing Logic
// ═══════════════════════════════════════
async function processWebhookEvent(body: any) {
    try {
        if (body.object !== "instagram") return;

        const supabaseAdmin = getSupabaseAdmin();

        for (const entry of body.entry) {

            // ═══════════════════════════════════════
            // 📩 HANDLE DIRECT MESSAGES
            // ═══════════════════════════════════════
            if (entry.messaging) {
                for (const event of entry.messaging) {

                    // 🛑 Ignore echoes (bot's own messages)
                    if (event.message?.is_echo) {
                        console.log("⚠️ Ignoring Bot's own message (Echo)");
                        continue;
                    }

                    // 🛑 Ignore delivery/read receipts
                    if (event.delivery || event.read) {
                        console.log("⚠️ Ignoring Delivery/Read receipt");
                        continue;
                    }

                    const senderId = event.sender.id;
                    const messageText = event.message?.text;
                    const recipientId = event.recipient?.id;

                    if (!messageText) continue;

                    console.log(`📩 Received from ${senderId}: ${messageText}`);

                    // ── IDENTIFY THE BUSINESS OWNER + WORKSPACE ──
                    const ownerResult = await findOwner(supabaseAdmin, recipientId);
                    if (!ownerResult) {
                        console.log('🛑 SKIPPING: No connected owner found.');
                        continue;
                    }
                    const { userId: ownerId, workspaceId } = ownerResult;

                    // ═══════════════════════════════════════
                    // 📦 SAVE PENDING (Do this FIRST, before any slow calls)
                    // Claiming the pending slot immediately prevents Meta retries
                    // from winning the race and causing "already taken" deferrals
                    // ═══════════════════════════════════════
                    const messageId = await savePendingMessage(
                        supabaseAdmin,
                        ownerId,
                        senderId,
                        messageText
                    );

                    // ── FETCH SENDER PROFILE (slow, but can happen after slot claim) ──
                    const userProfileName = await fetchUserProfile(senderId);
                    const senderName = userProfileName || `User ${senderId.slice(-4)}`;

                    // ═══════════════════════════════════════
                    // 🚨 MANAGER ALERT CHECK (fire-and-forget, before batch wait)
                    // ═══════════════════════════════════════
                    void (async () => {
                        try {
                            let q = supabaseAdmin.from('bot_settings').select('emergency_whatsapp, handoff_keywords');
                            if (workspaceId) {
                                q = q.eq('id', workspaceId);
                            } else {
                                q = q.eq('user_id', ownerId);
                            }
                            const { data: ws } = await q.single();
                            if (!ws?.emergency_whatsapp) return;
                            if (!containsAlertKeyword(messageText, ws.handoff_keywords || [])) return;

                            const allKeywords = [
                                ...ALERT_KEYWORDS,
                                ...(Array.isArray(ws.handoff_keywords) ? ws.handoff_keywords : [])
                            ];
                            const matchedKeyword = allKeywords.find(k =>
                                messageText.toLowerCase().includes(k.toLowerCase())
                            ) || 'alert';

                            console.log(`🚨 [Alert] Keyword "${matchedKeyword}" detected. Firing WhatsApp alert.`);
                            await triggerManagerAlert({
                                ownerWhatsAppNumber: ws.emergency_whatsapp,
                                triggerKeyword: matchedKeyword,
                                customerMessage: messageText,
                                senderName,
                            });
                        } catch (e) {
                            console.error('🚨 [Alert] Error firing manager alert:', e);
                        }
                    })();

                    // ── LOG INCOMING MESSAGE ──
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

                    // ── BATCH WAIT: check if newer message arrived during the window ──
                    const batchedMessage = await waitAndBatchMessages(
                        supabaseAdmin,
                        ownerId,
                        senderId,
                        messageId
                    );

                    if (batchedMessage === null) {
                        console.log(`⏳ Deferring: Newer message exists for sender ${senderId}`);
                        continue;
                    }

                    console.log(`📦 Processing batched message: "${batchedMessage.slice(0, 100)}"`);

                    // ═══════════════════════════════════════
                    // 💰 BILLING CHECK
                    // ═══════════════════════════════════════
                    const limitCheck = await checkUserLimit(ownerId);
                    if (!limitCheck.allowed) {
                        console.log(`🛑 LIMIT REACHED for ${ownerId}: ${limitCheck.reason}`);
                        await supabaseAdmin.from('activity_log').insert({
                            user_id: ownerId,
                            event_type: 'SYSTEM_WARNING',
                            description: `⚠️ Agent Paused: ${limitCheck.reason}`,
                            timestamp: new Date().toISOString(),
                            metadata: { chat_id: senderId, platform: 'instagram', type: 'billing_limit' }
                        });
                        continue;
                    }

                    // ═══════════════════════════════════════
                    // 🧠 AI PROCESSING (with batched message)
                    // ═══════════════════════════════════════
                    const aiResponse = await generateGhostReply(
                        ownerId,
                        batchedMessage, // ← Single concatenated message
                        supabaseAdmin,
                        senderId,
                        workspaceId ?? undefined  // ← Workspace-scoped AI brain
                    );

                    if (!aiResponse) {
                        console.log('Ghost Protocol: No reply (handoff or empty).');
                        continue;
                    }

                    // ═══════════════════════════════════════
                    // 🤖 AUTOPILOT CHECK
                    // ═══════════════════════════════════════
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

                    // ═══════════════════════════════════════
                    // 📤 SEND THE REPLY
                    // ═══════════════════════════════════════
                    await sendReply(ownerId, senderId, aiResponse, supabaseAdmin);

                    // ═══════════════════════════════════════
                    // 📝 LOG AI REPLY
                    // ═══════════════════════════════════════
                    await supabaseAdmin.from('activity_log').insert({
                        user_id: ownerId,
                        event_type: 'AI_REPLY',
                        description: `Sent: "${aiResponse}"`,
                        timestamp: new Date().toISOString(),
                        metadata: { chat_id: senderId, platform: 'instagram' }
                    });
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
                    const parentId = commentData?.parent_id;

                    if (!commentText || !commentId) {
                        console.log('⚠️ Skipping: Missing comment data');
                        continue;
                    }

                    if (parentId) {
                        console.log('⚠️ Skipping: Reply to another comment (not top-level)');
                        continue;
                    }

                    console.log(`💬 Comment from @${commenterName}: "${commentText}"`);

                    const igAccountId = entry.id;
                    const commentOwnerResult = await findOwner(supabaseAdmin, igAccountId);

                    if (!commentOwnerResult) {
                        console.log('🛑 SKIPPING COMMENT: No connected owner found.');
                        continue;
                    }
                    const { userId: ownerId } = commentOwnerResult;

                    // Check for duplicate replies
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

                    // Log incoming comment
                    await supabaseAdmin.from('activity_log').insert({
                        user_id: ownerId,
                        event_type: 'INCOMING_COMMENT',
                        description: `Comment from @${commenterName}: "${commentText}"`,
                        timestamp: new Date().toISOString(),
                        metadata: {
                            chat_id: commenterId,
                            comment_id: commentId,
                            commenter_name: commenterName,
                            commenter_id: commenterId,
                            media_id: mediaId,
                            platform: 'instagram',
                            type: 'comment'
                        }
                    });

                    // Billing check
                    const limitCheck = await checkUserLimit(ownerId);
                    if (!limitCheck.allowed) {
                        console.log(`🛑 LIMIT REACHED for ${ownerId}: ${limitCheck.reason}`);
                        await supabaseAdmin.from('activity_log').insert({
                            user_id: ownerId,
                            event_type: 'SYSTEM_WARNING',
                            description: `⚠️ Comment Agent Paused: ${limitCheck.reason}`,
                            timestamp: new Date().toISOString(),
                            metadata: { chat_id: commenterId, platform: 'instagram', type: 'billing_limit' }
                        });
                        continue;
                    }

                    // Generate comment reply
                    const aiResponse = await generateCommentReply(ownerId, commentText, commenterName, supabaseAdmin);

                    if (!aiResponse) {
                        console.log('Ghost Protocol: No comment reply generated.');
                        continue;
                    }

                    // Autopilot check
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

                    await sendCommentReply(ownerId, commentId, aiResponse, supabaseAdmin);

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

        console.log("✅ Webhook event processed successfully.");
    } catch (error) {
        console.error("❌ Processing Error:", error);
    }
}

// ═══════════════════════════════════════
// 🔧 HELPER FUNCTIONS
// ═══════════════════════════════════════

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

async function sendReply(ownerId: string, recipientId: string, text: string, supabaseAdmin: any) {
    let token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
    let url = `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`;

    // Get the user's specific token from DB
    const { data: connection } = await supabaseAdmin.from('user_connections')
        .select('metadata, provider')
        .eq('user_id', ownerId)
        .in('provider', ['INSTAGRAM', 'instagram_api_login'])
        .limit(1).maybeSingle();

    if (connection?.metadata?.access_token) {
        token = connection.metadata.access_token;
        // Check metadata.provider (not the DB column which is always 'INSTAGRAM')
        const isInstagramLogin = connection.metadata?.provider === 'instagram_api_login';
        if (isInstagramLogin) {
            url = `https://graph.instagram.com/v21.0/me/messages?access_token=${token}`;
        } else {
            url = `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`;
        }
        console.log(`[sendReply] Using ${isInstagramLogin ? 'Instagram' : 'Facebook'} API for user ${ownerId}`);
    }

    if (!token) {
        console.error("❌ REPLY FAILED: Missing Access Token for user", ownerId);
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

async function findOwner(supabaseAdmin: any, accountId: string | undefined): Promise<{ userId: string; workspaceId: string | null } | null> {
    if (!accountId) return null;

    // 1. Strict DB Match — now also returns workspace_id
    const { data: connectedUser } = await supabaseAdmin.from('user_connections')
        .select('user_id, workspace_id')
        .eq('account_id', accountId)
        .limit(1).maybeSingle();

    if (connectedUser) return { userId: connectedUser.user_id, workspaceId: connectedUser.workspace_id ?? null };

    // 2. Metadata Scan (Fallback) - handles token mismatch formats
    const { data: allConnections } = await supabaseAdmin.from('user_connections')
        .select('user_id, workspace_id, metadata, account_id')
        .in('provider', ['INSTAGRAM', 'instagram_api_login']);

    if (allConnections) {
        for (const conn of allConnections) {
            const meta = conn.metadata as any || {};

            // Old Pages methodology
            const pages = meta.pages || [];
            const hasPage = Array.isArray(pages) && pages.some((p: any) => p.instagram_business_account?.id === accountId);

            if (hasPage) {
                console.log(`[Loose Match] Found owner ${conn.user_id} via metadata page link. Account: ${accountId}`);
                return { userId: conn.user_id, workspaceId: conn.workspace_id ?? null };
            }

            // New Instagram API methodology: The token exchange returned app-scoped IDs while webhook returns global IDs
            // So we explicitly match the metadata fields that might contain the correct global ID
            if (meta.user_id?.toString() === accountId || meta.instagram_account_id?.toString() === accountId) {
                console.log(`[Loose Match] Found owner ${conn.user_id} via metadata internal match. Account: ${accountId}`);
                return { userId: conn.user_id, workspaceId: conn.workspace_id ?? null };
            }
        }
    }

    console.log(`[findOwner] No owner found for account ${accountId}`);
    return null;
}

async function checkAutopilot(supabaseAdmin: any, ownerId: string, externalChatId?: string): Promise<boolean> {
    // 1. Global autopilot check
    const { data: settings, error: settingsError } = await supabaseAdmin
        .from('users')
        .select('is_autopilot_enabled')
        .eq('id', ownerId)
        .maybeSingle();

    if (settingsError) {
        console.error('⚠️ Global Autopilot Check Failed:', settingsError.message);
    }

    const globalAutopilot = settings?.is_autopilot_enabled ?? true;

    if (!globalAutopilot) {
        console.log(`🤖 Global Autopilot for ${ownerId}: OFF`);
        return false;
    }

    // 2. Chat-specific mute check
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

async function sendCommentReply(ownerId: string, commentId: string, message: string, supabaseAdmin: any) {
    let token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
    let url = `https://graph.facebook.com/v21.0/${commentId}/replies?access_token=${token}`;

    const { data: connection } = await supabaseAdmin.from('user_connections')
        .select('metadata, provider')
        .eq('user_id', ownerId)
        .in('provider', ['INSTAGRAM', 'instagram_api_login'])
        .limit(1).maybeSingle();

    if (connection?.metadata?.access_token) {
        token = connection.metadata.access_token;
        // Check metadata.provider (not the DB column which is always 'INSTAGRAM')
        const isInstagramLogin = connection.metadata?.provider === 'instagram_api_login';
        if (isInstagramLogin) {
            url = `https://graph.instagram.com/v21.0/${commentId}/replies?access_token=${token}`;
        } else {
            url = `https://graph.facebook.com/v21.0/${commentId}/replies?access_token=${token}`;
        }
        console.log(`[sendCommentReply] Using ${isInstagramLogin ? 'Instagram' : 'Facebook'} API for user ${ownerId}`);
    }

    if (!token) {
        console.error("❌ COMMENT REPLY FAILED: Missing Access Token for user", ownerId);
        return;
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: message,
            }), // Removed the URL param access_token and body access_token duplication
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

async function generateCommentReply(
    userId: string,
    commentText: string,
    commenterName: string,
    supabase: any
): Promise<string | null> {
    try {
        const { data: settings } = await supabase
            .from('bot_settings')
            .select('business_name, business_type, tone, system_instructions, language')
            .eq('user_id', userId)
            .single();

        const businessName = settings?.business_name || 'our store';

        const { data: inventory } = await supabase
            .from('inventory')
            .select('item_name, stock_level, price')
            .eq('user_id', userId);

        let inventoryContext = "No inventory items listed.";
        if (inventory?.length) {
            inventoryContext = inventory
                .map((i: any) => {
                    const availability = i.stock_level > 0 ? 'In Stock' : 'Out of Stock';
                    return `- ${i.item_name}: ${availability} ($${i.price})`;
                })
                .join('\n');
        }

        const { createGroq } = await import('@ai-sdk/groq');
        const { generateText } = await import('ai');

        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

        // Dynamic comment prompt based on business type
        let businessTypeDirective = 'This is a product-based business. Focus on products and orders.';
        switch (settings?.business_type) {
            case 'ecommerce':
                businessTypeDirective = 'This is an ecommerce business. Focus on products, shipping, and orders.';
                break;
            case 'appointments':
                businessTypeDirective = 'This is a service business. Focus on booking and appointments.';
                break;
            case 'real_estate':
                businessTypeDirective = 'This is a real estate business. Focus on properties, locations, and viewings.';
                break;
            case 'food_and_beverage':
                businessTypeDirective = 'This is a food/beverage business. Focus on menu items, reservations, and delivery.';
                break;
            case 'events_ticketing':
                businessTypeDirective = 'This is an events/ticketing business. Focus on tickets, guest lists, and venues.';
                break;
            case 'digital_services':
                businessTypeDirective = 'This is a digital services business. Focus on digital products, consulting, and support.';
                break;
        }

        const systemPrompt = `You are the official comment assistant for ${businessName} on Instagram.
${businessTypeDirective}

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
- If the user asks about sports, politics, math, or anything outside the business, reply: "We're here to help with ${businessName}! DM us 💬"

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
