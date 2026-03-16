import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { generateGhostReply } from '@/utils/ghost-brain';
import { upsertDmBuffer, claimDmBuffer, clearDmBuffer, releaseDmBuffer, DEBOUNCE_SECONDS } from '@/utils/dm-debounce';
import { containsAlertKeyword, triggerManagerAlert, ALERT_KEYWORDS } from '@/utils/whatsapp-alerts';
import {
    getCheckoutSession, createCheckoutSession,
    completeCheckoutOrder, extractAllCheckoutFields, detectsPurchaseIntent,
    buildCheckoutPromptSection
} from '@/utils/checkout-flow';
import crypto from 'crypto';
import { checkUserLimit } from '@/lib/billing';

// Extend Vercel function timeout to 60 seconds for AI processing
export const maxDuration = 60;

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

    // ⏰ Return 200 to Meta IMMEDIATELY so it never retries.
    // Use after() to process the event AFTER the response is sent.
    // Without this, Meta waits, times out, retries, and the retry
    // steals the pending-message lock → original defers → no reply.
    after(async () => {
        try {
            await processWebhookEvent(body);
            console.log("✅ Webhook event processed successfully.");
        } catch (err) {
            console.error("❌ Processing error:", err);
        }
    });

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

                    // ── FETCH SENDER PROFILE ──
                    const userProfileName = await fetchUserProfile(senderId, supabaseAdmin, workspaceId ?? undefined, ownerId);
                    const senderName = userProfileName || `User ${senderId.slice(-4)}`;

                    // ═══════════════════════════════════════
                    // 🚨 MANAGER ALERT CHECK (fire-and-forget, immediate)
                    // ═══════════════════════════════════════
                    void (async () => {
                        try {
                            // Try workspace-scoped settings first, then fall back to user-level
                            let ws: any = null;
                            if (workspaceId) {
                                const { data } = await supabaseAdmin.from('ai_settings').select('emergency_whatsapp, handoff_keywords').eq('id', workspaceId).maybeSingle();
                                ws = data;
                            }
                            if (!ws) {
                                const { data } = await supabaseAdmin.from('ai_settings').select('emergency_whatsapp, handoff_keywords').eq('user_id', ownerId).maybeSingle();
                                ws = data;
                            }

                            console.log(`🚨 [Alert] ai_settings found. emergency_whatsapp: "${ws?.emergency_whatsapp || 'NOT SET'}"`);

                            if (!ws?.emergency_whatsapp) {
                                console.log('🚨 [Alert] Skipping: no emergency_whatsapp configured.');
                                return;
                            }
                            if (!containsAlertKeyword(messageText, ws.handoff_keywords || [])) {
                                console.log(`🚨 [Alert] Skipping: no alert keyword in: "${messageText}"`);
                                return;
                            }

                            const allKeywords = [...ALERT_KEYWORDS, ...(Array.isArray(ws.handoff_keywords) ? ws.handoff_keywords : [])];
                            const matchedKeyword = allKeywords.find(k => messageText.toLowerCase().includes(k.toLowerCase())) || 'alert';
                            console.log(`🚨 [Alert] Keyword "${matchedKeyword}" detected. Firing WhatsApp alert.`);
                            await triggerManagerAlert({ ownerWhatsAppNumber: ws.emergency_whatsapp, triggerKeyword: matchedKeyword, customerMessage: messageText, senderName });
                        } catch (e) { console.error('🚨 [Alert] Error:', e); }
                    })();

                    // ── LOG INCOMING MESSAGE ──
                    try {
                        await supabaseAdmin.from('activity_log').insert({
                            user_id: ownerId,
                            workspace_id: workspaceId || null,
                            event_type: 'INCOMING_MESSAGE',
                            description: `${senderName}: "${messageText}"`,
                            timestamp: new Date().toISOString(),
                            metadata: { chat_id: senderId, platform: 'instagram', username: senderName, sender: { attendee_name: senderName } }
                        });
                    } catch (logErr) {
                        console.error('❌ [Log] Failed to insert activity_log (INCOMING_MESSAGE):', logErr);
                    }

                    // ═══════════════════════════════════════════════════════════
                    // 📦 UPSERT DM BUFFER — no sleeping, no racing
                    // Each DM upserts one row per sender and resets reply_at.
                    // The setTimeout below fires after the debounce window.
                    // If a newer DM arrives, it pushes reply_at forward and the
                    // newer timer will handle it — this one exits at claimDmBuffer.
                    // ═══════════════════════════════════════════════════════════
                    const replyAt = await upsertDmBuffer({
                        supabase: supabaseAdmin,
                        ownerId,
                        senderId,
                        workspaceId,
                        messageText,
                        channel: 'instagram',
                    });

                    // Schedule the processor. Capture all needed context in closure.
                    const debounceMs = DEBOUNCE_SECONDS * 1000 + 500; // +500ms safety margin
                    console.log(`⏱️ [Buffer] Waiting ${debounceMs}ms before processing reply for ${senderId} (reply_at: ${replyAt})`);

                    // ⚠️ MUST use await sleep — not setTimeout.
                    // setTimeout fires in a macrotask that Vercel kills once after() resolves.
                    // An awaited Promise keeps this after() invocation alive for the full window.
                    // This is safe because 200 was already returned to Meta above — no retries.
                    await new Promise(resolve => setTimeout(resolve, debounceMs));

                    await processDmBuffer({
                        supabaseAdmin,
                        ownerId,
                        senderId,
                        workspaceId,
                        scheduledReplyAt: replyAt,
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
                    const { userId: ownerId, workspaceId: commentWorkspaceId } = commentOwnerResult;

                    // Check for duplicate replies
                    const { data: existingReply } = await supabaseAdmin
                        .from('activity_log')
                        .select('id')
                        .eq('user_id', ownerId)
                        .eq('workspace_id', commentWorkspaceId || null)
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
                        workspace_id: commentWorkspaceId || null,
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
                            workspace_id: commentWorkspaceId || null,
                            event_type: 'SYSTEM_WARNING',
                            description: `⚠️ Comment Agent Paused: ${limitCheck.reason}`,
                            timestamp: new Date().toISOString(),
                            metadata: { chat_id: commenterId, platform: 'instagram', type: 'billing_limit' }
                        });
                        continue;
                    }

                    // Generate comment reply
                    const aiResponse = await generateCommentReply(ownerId, commentText, commenterName, supabaseAdmin, commentWorkspaceId ?? undefined);

                    if (!aiResponse) {
                        console.log('Ghost Protocol: No comment reply generated.');
                        continue;
                    }

                    // Autopilot check
                    const isAutopilot = await checkAutopilot(supabaseAdmin, ownerId, commenterId, commentWorkspaceId ?? undefined);

                    if (!isAutopilot) {
                        console.log('🛑 AUTOPILOT OFF: Saving draft comment reply.');
                        await supabaseAdmin.from('activity_log').insert({
                            user_id: ownerId,
                            workspace_id: commentWorkspaceId || null,
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

                    await sendCommentReply(ownerId, commentId, aiResponse, supabaseAdmin, commentWorkspaceId ?? undefined);

                    await supabaseAdmin.from('activity_log').insert({
                        user_id: ownerId,
                        workspace_id: commentWorkspaceId || null,
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

// ═══════════════════════════════════════════════════════════════
// 🔄 processDmBuffer — runs after the debounce window expires
//    Called by setTimeout in processWebhookEvent (inside after()).
//    Atomically claims the buffer → generates AI reply → sends.
// ═══════════════════════════════════════════════════════════════
interface ProcessDmBufferArgs {
    supabaseAdmin: any;
    ownerId: string;
    senderId: string;
    workspaceId: string | null;
    scheduledReplyAt: string;
}

async function processDmBuffer({
    supabaseAdmin,
    ownerId,
    senderId,
    workspaceId,
    scheduledReplyAt,
}: ProcessDmBufferArgs) {
    console.log(`🔄 [Buffer] processDmBuffer fired for sender ${senderId}`);

    // 1. Atomically claim the buffer row
    const claimed = await claimDmBuffer(supabaseAdmin, ownerId, senderId, scheduledReplyAt, 'instagram');
    if (!claimed) {
        // A newer message pushed reply_at forward — its timer will handle it
        return;
    }

    const { text: batchedMessage, workspaceId: bufferWorkspace } = claimed;
    const effectiveWorkspaceId = bufferWorkspace ?? workspaceId;

    console.log(`📦 [Buffer] Processing batched message: "${batchedMessage.slice(0, 100)}"`);

    try {
        // 2. Billing check
        const limitCheck = await checkUserLimit(ownerId);
        if (!limitCheck.allowed) {
            console.log(`🛑 LIMIT REACHED for ${ownerId}: ${limitCheck.reason}`);
            await supabaseAdmin.from('activity_log').insert({
                user_id: ownerId,
                workspace_id: effectiveWorkspaceId || null,
                event_type: 'SYSTEM_WARNING',
                description: `⚠️ Agent Paused: ${limitCheck.reason}`,
                timestamp: new Date().toISOString(),
                metadata: { chat_id: senderId, platform: 'instagram', type: 'billing_limit' }
            });
            await clearDmBuffer(supabaseAdmin, ownerId, senderId, 'instagram');
            return;
        }

        // 3. CHECK FOR ACTIVE CHECKOUT SESSION
        let checkoutCtx: string | undefined;
        let checkoutSession: any = null;
        let businessTypeStr = 'ecommerce';

        try {
            checkoutSession = await getCheckoutSession(supabaseAdmin, ownerId, senderId, effectiveWorkspaceId || null);

            const { data: wsData } = await supabaseAdmin
                .from('ai_settings')
                .select('business_type')
                .eq(effectiveWorkspaceId ? 'id' : 'user_id', effectiveWorkspaceId || ownerId)
                .maybeSingle();

            businessTypeStr = wsData?.business_type || 'ecommerce';

            if (!checkoutSession && detectsPurchaseIntent(batchedMessage)) {
                const itemMatch = batchedMessage.match(/(?:buy|order|purchase|get|take|want|book|schedule|reserve)\s+(?:a\s+|the\s+|an\s+)?(.*)/i);
                const item = itemMatch?.[1]?.trim() || 'an item or service';
                checkoutSession = await createCheckoutSession(supabaseAdmin, ownerId, effectiveWorkspaceId || null, senderId, item);
                console.log(`🛒 [Checkout] New session created for "${item}" (${businessTypeStr})`);
            }
            if (checkoutSession) {
                checkoutCtx = buildCheckoutPromptSection(checkoutSession, businessTypeStr);
            }
        } catch (checkoutErr) {
            console.warn('⚠️ [Checkout] Session lookup failed — proceeding without checkout ctx:', checkoutErr);
            checkoutSession = null;
            checkoutCtx = undefined;
        }

        // 4. Generate AI reply (with checkout context if active)
        let aiResponse: string | null;
        try {
            aiResponse = await generateGhostReply(
                ownerId,
                batchedMessage,
                supabaseAdmin,
                senderId,
                effectiveWorkspaceId ?? undefined,
                checkoutCtx
            );
        } catch (ghostErr) {
            console.error('❌ [Ghost Brain] generateGhostReply threw:', ghostErr);
            await clearDmBuffer(supabaseAdmin, ownerId, senderId, 'instagram');
            return;
        }

        if (!aiResponse) {
            console.log('Ghost Protocol: No reply (handoff or empty).');
            await clearDmBuffer(supabaseAdmin, ownerId, senderId, 'instagram');
            return;
        }

        // 5. Autopilot check
        const isAutopilot = await checkAutopilot(supabaseAdmin, ownerId, senderId, effectiveWorkspaceId ?? undefined);
        if (!isAutopilot) {
            console.log('🛑 AUTOPILOT OFF: Saving draft reply.');
            await supabaseAdmin.from('activity_log').insert({
                user_id: ownerId,
                workspace_id: effectiveWorkspaceId || null,
                event_type: 'DRAFT_REPLY',
                description: `Draft: "${aiResponse}"`,
                timestamp: new Date().toISOString(),
                metadata: { chat_id: senderId, platform: 'instagram', status: 'pending_approval', reply_text: aiResponse }
            });
            await clearDmBuffer(supabaseAdmin, ownerId, senderId, 'instagram');
            return;
        }

        // 6. Send the reply
        console.log('🤖 AI Reply:', aiResponse);
        await sendReply(ownerId, senderId, aiResponse, supabaseAdmin, effectiveWorkspaceId || undefined);

        // 7. Log the reply
        await supabaseAdmin.from('activity_log').insert({
            user_id: ownerId,
            workspace_id: effectiveWorkspaceId || null,
            event_type: 'AI_REPLY',
            description: `Sent: "${aiResponse}"`,
            timestamp: new Date().toISOString(),
            metadata: { chat_id: senderId, platform: 'instagram' }
        });

        // 8. 🛒 ADVANCE CHECKOUT (fire-and-forget — doesn't block)
        void (async () => {
            try {
                if (!checkoutSession) return;
                const info = await extractAllCheckoutFields(batchedMessage, businessTypeStr);
                console.log(`🛒 [Checkout] Extracted — name: "${info.name}", phone: "${info.phone}", address: "${info.address}"`);
                if (info.name && info.phone && info.address) {
                    const handle = await fetchUserProfile(senderId, supabaseAdmin, effectiveWorkspaceId ?? undefined, ownerId) || senderId;
                    await completeCheckoutOrder(supabaseAdmin, checkoutSession, info, handle);
                    console.log('✅ [Checkout] Order complete and saved.');
                } else {
                    console.log('🛒 [Checkout] Not all fields found yet — waiting for next message.');
                }
            } catch (e) {
                console.error('🛒 [Checkout] Advance error:', e);
            }
        })();

        // 9. Clear the buffer
        await clearDmBuffer(supabaseAdmin, ownerId, senderId, 'instagram');
        console.log(`✅ [Buffer] Reply sent and buffer cleared for sender ${senderId}`);


    } catch (err) {
        console.error(`❌ [Buffer] processDmBuffer failed for sender ${senderId}:`, err);
        // Release lock so TTL can allow retry
        await releaseDmBuffer(supabaseAdmin, ownerId, senderId, 'instagram');
    }
}

// ═══════════════════════════════════════
// 🔧 HELPER FUNCTIONS
// ═══════════════════════════════════════

async function fetchUserProfile(senderId: string, supabaseAdmin: any, workspaceId?: string, ownerId?: string) {
    let token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
    let isNewAPI = false;

    // Get the workspace-specific token from DB
    if (supabaseAdmin && workspaceId) {
        const { data: connection } = await supabaseAdmin.from('instagram_integrations')
            .select('access_token')
            .eq('workspace_id', workspaceId)
            .limit(1).maybeSingle();

        if (connection?.access_token) {
            token = connection.access_token;
            isNewAPI = true;
        }
    }

    if (!isNewAPI && supabaseAdmin && ownerId) {
        // Fallback to old table if migration isn't fully complete or for legacy reasons
        const { data: oldConn } = await supabaseAdmin.from('user_connections')
            .select('metadata')
            .eq('user_id', ownerId)
            .in('provider', ['INSTAGRAM', 'instagram_api_login'])
            .limit(1).maybeSingle();

        if (oldConn?.metadata?.access_token) {
            token = oldConn.metadata.access_token;
        }
    }

    if (token) {
        token = token.trim();
        if (token.startsWith('"') && token.endsWith('"')) {
            token = token.slice(1, -1);
        }
        if (token.startsWith('{')) {
            try {
                const parsed = JSON.parse(token);
                token = parsed.access_token || token;
            } catch (e) {
                // ignore
            }
        }
    }

    if (!token) return null;

    try {
        const baseUrl = isNewAPI ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
        const url = `${baseUrl}/v21.0/${senderId}?fields=name,username,profile_pic&access_token=${token}`;
        console.log(`🔍 [fetchUserProfile] Fetching profile from ${baseUrl} for ${senderId}`);
        const res = await fetch(url);
        const data = await res.json();

        console.log(`🔍 [fetchUserProfile] Metadata for ${senderId}:`, JSON.stringify(data));

        if (data.error) {
            console.error('⚠️ [fetchUserProfile] Graph API Error:', data.error);
            return null;
        }

        // Try Name, then Username
        const name = data.name || data.username || null;
        console.log(`👤 [fetchUserProfile] Resolved name: ${name}`);
        return name;
    } catch (e) {
        console.error('❌ [fetchUserProfile] Fatal Error fetching profile:', e);
        return null;
    }
}

async function sendReply(ownerId: string, recipientId: string, text: string, supabaseAdmin: any, workspaceId?: string) {
    let token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
    let url = `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`;
    let isNewAPI = false;

    // Get the workspace-specific token from DB (fix: use IS NULL when no workspaceId)
    let connectionQuery = supabaseAdmin.from('instagram_integrations').select('access_token');
    if (workspaceId) {
        connectionQuery = connectionQuery.eq('workspace_id', workspaceId);
    } else {
        connectionQuery = connectionQuery.is('workspace_id', null);
    }
    const { data: connection } = await connectionQuery.limit(1).maybeSingle();

    if (connection?.access_token) {
        token = connection.access_token;
        isNewAPI = true;
        console.log(`[sendReply] Using workspace token for ${workspaceId}`);
    } else {
        // Fallback to old table if migration isn't fully complete or for legacy reasons
        const { data: oldConn } = await supabaseAdmin.from('user_connections')
            .select('metadata')
            .eq('user_id', ownerId)
            .in('provider', ['INSTAGRAM', 'instagram_api_login'])
            .limit(1).maybeSingle();

        if (oldConn?.metadata?.access_token) {
            token = oldConn.metadata.access_token;
            console.log(`[sendReply] Using legacy user_connections token for ${ownerId}`);
        }
    }

    if (token) {
        token = token.trim();
        // Remove surrounding quotes if they exist
        if (token.startsWith('"') && token.endsWith('"')) {
            token = token.slice(1, -1);
        }
        // If the token is actually a JSON string (accidental backfill error)
        if (token.startsWith('{')) {
            try {
                const parsed = JSON.parse(token);
                token = parsed.access_token || token;
            } catch (e) {
                // Not JSON, continue with original trimmed token
            }
        }
    }

    if (!token) {
        // Absolute last resort: ENV
        token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
        console.log(`[sendReply] No DB token found, trying ENV fallback...`);
    }

    if (!token) {
        console.error("❌ REPLY FAILED: Missing Access Token for user", ownerId);
        return;
    }

    const baseUrl = isNewAPI ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
    url = `${baseUrl}/v21.0/me/messages?access_token=${token}`;
    console.log(`✉️ [sendReply] Sending to ${baseUrl} for ${recipientId}`);

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

    // 1. Try new instagram_integrations table first
    const { data: integration } = await supabaseAdmin.from('instagram_integrations')
        .select('workspace_id')
        .eq('instagram_account_id', accountId)
        .maybeSingle();

    if (integration?.workspace_id) {
        // Retrieve user_id from the linked ai_settings workspace
        const { data: workspace } = await supabaseAdmin.from('ai_settings')
            .select('user_id')
            .eq('id', integration.workspace_id)
            .maybeSingle();

        if (workspace?.user_id) {
            console.log(`[findOwner] ✅ Matched via instagram_integrations — workspace: ${integration.workspace_id}`);
            return { userId: workspace.user_id, workspaceId: integration.workspace_id };
        }
    }

    // 2. LEGACY FALLBACK: Check user_connections (old connection method)
    const { data: legacyConn } = await supabaseAdmin.from('user_connections')
        .select('user_id, metadata')
        .in('provider', ['INSTAGRAM', 'instagram_api_login'])
        .or(`metadata->>instagram_account_id.eq.${accountId},metadata->>page_id.eq.${accountId}`)
        .limit(1)
        .maybeSingle();

    if (legacyConn?.user_id) {
        console.log(`[findOwner] ✅ Matched via user_connections (legacy) — userId: ${legacyConn.user_id}`);
        return { userId: legacyConn.user_id, workspaceId: null };
    }

    // 3. LAST RESORT: Match by the recipient_id being this account's known IG page ID stored in ai_settings
    const { data: settingsByPage } = await supabaseAdmin.from('ai_settings')
        .select('id, user_id')
        .or(`contact_info.ilike.%${accountId}%`)
        .limit(1)
        .maybeSingle();

    if (settingsByPage?.user_id) {
        console.log(`[findOwner] ✅ Matched via ai_settings contact_info heuristic — userId: ${settingsByPage.user_id}`);
        return { userId: settingsByPage.user_id, workspaceId: settingsByPage.id || null };
    }

    console.log(`[findOwner] ❌ No owner found for account ${accountId}`);
    return null;
}

async function checkAutopilot(supabaseAdmin: any, ownerId: string, externalChatId?: string, workspaceId?: string): Promise<boolean> {
    // 1. Global/Workspace autopilot check
    // If workspaceId is provided, we check ai_settings for that specific workspace
    const { data: settings, error: settingsError } = await supabaseAdmin
        .from('ai_settings')
        .select('is_autopilot_enabled')
        .eq(workspaceId ? 'id' : 'user_id', workspaceId || ownerId)
        .maybeSingle();

    const globalAutopilot = settings?.is_autopilot_enabled ?? true;

    if (!globalAutopilot) {
        console.log(`🤖 Global Autopilot for ${workspaceId || ownerId}: OFF`);
        return false;
    }

    // 2. Chat-specific mute check
    if (externalChatId) {
        const { data: chatState } = await supabaseAdmin
            .from('conversation_states')
            .select('is_muted')
            .eq('user_id', ownerId)
            // Added workspace filter for chat state if available
            .eq(workspaceId ? 'workspace_id' : 'user_id', workspaceId || ownerId)
            .eq('external_chat_id', externalChatId)
            .maybeSingle();

        if (chatState?.is_muted) {
            console.log(`🛑 AI is Muted manually for chat ${externalChatId}`);
            return false;
        }
    }

    console.log(`🤖 Autopilot System for ${workspaceId || ownerId}: ON`);
    return true;
}

async function sendCommentReply(ownerId: string, commentId: string, message: string, supabaseAdmin: any, workspaceId?: string) {
    let token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
    let isNewAPI = false;

    // Get the workspace-specific token from DB (fix: proper null handling)
    let commentConnQuery = supabaseAdmin.from('instagram_integrations').select('access_token');
    if (workspaceId) {
        commentConnQuery = commentConnQuery.eq('workspace_id', workspaceId);
    } else {
        commentConnQuery = commentConnQuery.is('workspace_id', null);
    }
    const { data: connection } = await commentConnQuery.limit(1).maybeSingle();

    if (connection?.access_token) {
        token = connection.access_token;
        isNewAPI = true;
        console.log(`[sendCommentReply] Using workspace token for ${workspaceId}`);
    } else {
        const { data: oldConn } = await supabaseAdmin.from('user_connections')
            .select('metadata')
            .eq('user_id', ownerId)
            .in('provider', ['INSTAGRAM', 'instagram_api_login'])
            .limit(1).maybeSingle();

        if (oldConn?.metadata?.access_token) {
            token = oldConn.metadata.access_token;
            console.log(`[sendCommentReply] Using legacy user_connections token for ${ownerId}`);
        }
    }

    if (!token) {
        console.error("❌ COMMENT REPLY FAILED: Missing Access Token for user", ownerId);
        return;
    }

    // Dynamic host selection (Bug 3 fix)
    const baseUrlComment = isNewAPI ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
    const url = `${baseUrlComment}/v21.0/${commentId}/replies?access_token=${token}`;
    console.log(`💬 [sendCommentReply] Sending via ${baseUrlComment}`);

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
    supabase: any,
    workspaceId?: string
): Promise<string | null> {
    try {
        // Fetch from ai_settings (Workspace scoped)
        const { data: settings } = await supabase
            .from('ai_settings')
            .select('business_name, business_type, tone, system_instructions, language')
            .eq(workspaceId ? 'id' : 'user_id', workspaceId || userId)
            .maybeSingle();

        const businessName = settings?.business_name || 'our store';

        // Fetch workspace-scoped inventory
        const { data: inventory } = await supabase
            .from('inventory')
            .select('item_name, stock_level, price')
            .eq(workspaceId ? 'workspace_id' : 'user_id', workspaceId || userId);

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
