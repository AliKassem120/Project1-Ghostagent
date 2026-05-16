import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { generateGhostReply } from '@/utils/ghost-brain';
import { upsertDmBuffer, claimDmBuffer, clearDmBuffer, releaseDmBuffer, DEBOUNCE_SECONDS } from '@/utils/dm-debounce';
import { containsAlertKeyword, triggerManagerAlert, ALERT_KEYWORDS } from '@/utils/whatsapp-alerts';
import { getBotControlDecision } from '@/lib/god-mode/bot-controls';
import { guardFinalReply } from '@/lib/ai/validation/final-reply-guard';
import { classifyByRegex } from '@/lib/ai/classify/regex-fallbacks';
import { extractAvailabilityCandidate } from '@/lib/ai/ecommerce/extract-product';
import { searchProducts, findBestProductMatch } from '@/lib/ai/ecommerce/products';
import { loadActiveServices, findBestServiceMatch } from '@/lib/ai/appointments/services';
import { clearConversationState } from '@/lib/ai/state/store';
import type { PostActionContext } from '@/lib/ai/state/types';

import crypto from 'crypto';
import { checkUserLimit } from '@/lib/billing';
import Groq from 'groq-sdk';
import { toFile } from 'groq-sdk';

// Extend Vercel function timeout to 60 seconds for AI processing
export const maxDuration = 60;

// Helper to get admin supabase client
const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    if (!supabaseServiceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    return createClient(supabaseUrl, supabaseServiceKey);
}

function guardOutboundText(text: string | null | undefined, debug?: any, sourcePath = 'instagram_webhook'): string | null {
    const guarded = guardFinalReply({
        replyText: text,
        language: debug?.language,
        dbWriteAttempted: debug?.dbWriteAttempted,
        dbWriteSuccess: debug?.dbWriteSuccess,
        actionType: debug?.intent,
        sourcePath,
    });
    if (!guarded.shouldReply || !guarded.replyText) {
        console.warn(`Blocked outbound Instagram reply: ${guarded.blockedReason || 'empty'}`);
        return null;
    }
    return guarded.replyText;
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

                    // 🛑 Process echoes (outbound messages) for Passive Listening
                    if (event.message?.is_echo) {
                        const appId = event.message?.app_id;
                        const myAppId = process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID;
                        const isHuman = !appId || (myAppId && String(appId) !== String(myAppId));
                        
                        if (isHuman && event.message?.text) {
                            const pageId = event.sender.id;
                            const customerId = event.recipient?.id;
                            const humanReplyText = event.message.text.trim();
                            
                            console.log(`🎧 [Passive Listening] Human replied manually on IG to ${customerId}. Capturing for RAG...`);
                            
                            try {
                                // Find owner/workspace
                                const { data: wsUser } = await supabaseAdmin
                                    .from('workspace_users')
                                    .select('workspace_id, users(instagram_account_id)')
                                    .eq('users.instagram_account_id', pageId)
                                    .limit(1)
                                    .maybeSingle();
                                    
                                if (wsUser && wsUser.workspace_id) {
                                    // Find last message from customer
                                    const { data: lastCustMsg } = await supabaseAdmin
                                        .from('activity_log')
                                        .select('description')
                                        .eq('workspace_id', wsUser.workspace_id)
                                        .eq('event_type', 'INCOMING_MESSAGE')
                                        .like('metadata->>chat_id', customerId)
                                        .order('timestamp', { ascending: false })
                                        .limit(1)
                                        .maybeSingle();
                                        
                                    if (lastCustMsg && lastCustMsg.description) {
                                        // Extract just the message part (description format is 'Name: "Message"')
                                        const match = lastCustMsg.description.match(/:\s+"(.*)"$/);
                                        const pureCustomerMessage = match ? match[1] : lastCustMsg.description;
                                        
                                        await supabaseAdmin.from('business_training_data').insert({
                                            workspace_id: wsUser.workspace_id,
                                            source: 'passive_listening',
                                            customer_message: pureCustomerMessage,
                                            owner_reply: humanReplyText
                                        });
                                        console.log('✅ [Passive Listening] Saved IG training pair to database.');
                                    }
                                }
                            } catch (e) {
                                console.error('❌ [Passive Listening] Error capturing echo:', e);
                            }
                        }
                        
                        console.log("⚠️ Ignoring Bot's own message (Echo) for standard processing");
                        continue;
                    }

                    // 🛑 Ignore delivery/read receipts
                    if (event.delivery || event.read) {
                        console.log("⚠️ Ignoring Delivery/Read receipt");
                        continue;
                    }

                    const senderId = event.sender.id;
                    const recipientId = event.recipient?.id;

                    let messageText = event.message?.text || '';
                    const attachments = event.message?.attachments;

                    if (attachments && attachments.length > 0) {
                        const firstMedia = attachments.find((a: any) => a.type === 'image' || a.type === 'video' || a.type === 'share' || a.type === 'audio');
                        if (firstMedia && firstMedia.payload?.url) {
                            if (firstMedia.type === 'audio') {
                                console.log(`🎵 [VoiceNote] Received audio attachment from ${senderId}`);
                                try {
                                    const transcript = await transcribeVoiceNote(firstMedia.payload.url);
                                    if (transcript) {
                                        messageText += `\n[VOICE NOTE TRANSCRIPT: "${transcript.trim()}"]`;
                                        console.log(`🎵 [VoiceNote] Success: ${transcript}`);
                                    } else {
                                        messageText += `\n[VOICE NOTE: (untranscribable)]`;
                                    }
                                } catch (e) {
                                    console.error('❌ [VoiceNote] Transcription failed:', e);
                                    messageText += `\n[VOICE NOTE: (transcription failed)]`;
                                }
                            } else {
                                messageText += `\n[ATTACHMENT:${firstMedia.payload.url}]`;
                            }
                        } else if (firstMedia?.type === 'share' && firstMedia.payload?.share?.link) {
                            messageText += `\n[ATTACHMENT:${firstMedia.payload.share.link}]`;
                        }
                    }

                    messageText = messageText.trim();

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

                            // 🔒 WhatsApp alerts are a Pro & Empire feature
                            const { data: ownerUser } = await supabaseAdmin.from('users').select('plan_tier').eq('id', ownerId).single();
                            const planTier = ownerUser?.plan_tier?.toLowerCase() || 'starter';
                            if (planTier !== 'empire' && planTier !== 'pro' && planTier !== 'pro agent') {
                                console.log(`🚨 [Alert] Skipping: WhatsApp alerts require Pro/Empire plan (current: ${planTier}).`);
                                return;
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
                    // 🛡️ BOT LOOP SAFEGUARD
                    // If the sender is another connected page (e.g. Workspace 1 
                    // testing Workspace 2), we intentionally skip buffering to 
                    // prevent infinite AI-to-AI conversational loops.
                    // ═══════════════════════════════════════════════════════════
                    const isSenderBot = await checkIfSenderIsAnotherBot(supabaseAdmin, senderId);
                    if (isSenderBot) {
                        console.log(`🛑 [Bot Loop Safeguard] Sender ${senderId} is another AI instance. Skipping buffering/auto-reply.`);
                        continue;
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

                    // ── GATE: Starter tier cannot auto-reply to comments ──
                    const { data: ownerUser } = await supabaseAdmin.from('users').select('plan_tier').eq('id', ownerId).single();
                    const planTier = ownerUser?.plan_tier?.toLowerCase() || 'starter';
                    if (planTier === 'starter') {
                        console.log('🛑 SKIPPING COMMENT: Starter tier does not support Comment Auto-Reply.');
                        continue;
                    }

                    // ── GATE: Check user's comment_auto_reply setting ──
                    let commentSettings: any = null;
                    if (commentWorkspaceId) {
                        const { data: ws } = await supabaseAdmin.from('ai_settings').select('business_type, comment_auto_reply, comment_keywords, comment_max_per_post, comment_reply_style').eq('id', commentWorkspaceId).maybeSingle();
                        commentSettings = ws;
                    } else {
                        const { data: ws } = await supabaseAdmin.from('ai_settings').select('business_type, comment_auto_reply, comment_keywords, comment_max_per_post, comment_reply_style').eq('user_id', ownerId).maybeSingle();
                        commentSettings = ws;
                    }
                    if (commentSettings && commentSettings.comment_auto_reply === false) {
                        console.log('🛑 SKIPPING COMMENT: comment_auto_reply is disabled in settings.');
                        continue;
                    }
                    // ── Keyword Filter ──
                    const keywords: string[] = commentSettings?.comment_keywords || [];
                    if (keywords.length > 0) {
                        const commentTextLower = (commentText || '').toLowerCase();
                        const hasKeyword = keywords.some((k: string) => commentTextLower.includes(k.toLowerCase()));
                        if (!hasKeyword) {
                            console.log(`🛑 SKIPPING COMMENT: No matching keyword. Comment: "${commentText}"`);
                            continue;
                        }
                    }
                    // ── Max Replies per Post ──
                    const maxPerPost: number = commentSettings?.comment_max_per_post || 0;
                    if (maxPerPost > 0 && mediaId) {
                        const { count } = await supabaseAdmin.from('activity_log').select('*', { count: 'exact', head: true }).eq('user_id', ownerId).eq('event_type', 'COMMENT_REPLY').filter('metadata->>media_id', 'eq', mediaId);
                        if ((count || 0) >= maxPerPost) {
                            console.log(`🛑 SKIPPING COMMENT: Max replies (${maxPerPost}) reached for post ${mediaId}.`);
                            continue;
                        }
                    }

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

                    // 🛡️ BOT LOOP SAFEGUARD
                    const isSenderBot = await checkIfSenderIsAnotherBot(supabaseAdmin, commenterId);
                    if (isSenderBot) {
                        console.log(`🛑 [Bot Loop Safeguard] Commenter ${commenterId} is another AI instance. Skipping auto-reply.`);
                        continue;
                    }

                    // Generate comment reply plan (separate public + DM texts)
                    const replyStyle: 'public' | 'dm' | 'both' = commentSettings?.comment_reply_style || 'public';
                    const plan = await generateCommentReplyPlan(ownerId, commentText, commenterName, supabaseAdmin, replyStyle, commentWorkspaceId ?? undefined);

                    if (!plan || (!plan.publicCommentText && !plan.privateDmText)) {
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
                            description: `Draft Comment Reply: public="${plan.publicCommentText || '—'}", dm="${plan.privateDmText || '—'}"`,
                            timestamp: new Date().toISOString(),
                            metadata: {
                                chat_id: commenterId,
                                comment_id: commentId,
                                commenter_name: commenterName,
                                media_id: mediaId,
                                platform: 'instagram',
                                type: 'comment',
                                status: 'pending_approval',
                                reply_style: replyStyle,
                                public_comment_text: plan.publicCommentText,
                                private_dm_text: plan.privateDmText,
                            }
                        });
                        continue;
                    }

                    console.log(`🤖 Comment Reply to @${commenterName} (style: ${replyStyle}): public="${plan.publicCommentText || '—'}" dm="${plan.privateDmText || '—'}"`);

                    let logDescription = '';

                    // Send public comment
                    if (plan.publicCommentText && (replyStyle === 'public' || replyStyle === 'both')) {
                        await sendCommentReply(ownerId, commentId, plan.publicCommentText, supabaseAdmin, commentWorkspaceId ?? undefined);
                        logDescription = `Replied to @${commenterName}: "${plan.publicCommentText}"`;
                    }

                    // Send private DM
                    if (plan.privateDmText && (replyStyle === 'dm' || replyStyle === 'both')) {
                        await sendPrivateReplyToComment(ownerId, commentId, plan.privateDmText, supabaseAdmin, commentWorkspaceId ?? undefined);
                        logDescription = replyStyle === 'dm'
                            ? `Sent DM to @${commenterName}: "${plan.privateDmText}"`
                            : `Replied publicly & via DM to @${commenterName}`;

                        // ── Context Seeding (Brain Optimization) ──
                        try {
                            const businessType = commentSettings?.business_type || 'ecommerce';
                            const intentClass = classifyByRegex(commentText);
                            const intent = intentClass?.intent;

                            let seedContext: PostActionContext | undefined;

                            if ((intent === 'product_availability' || intent === 'purchase_intent') && businessType === 'ecommerce') {
                                const candidate = extractAvailabilityCandidate(commentText);
                                if (candidate) {
                                    const products = await searchProducts({ supabase: supabaseAdmin, workspaceId: commentWorkspaceId || ownerId, query: candidate, limit: 10 });
                                    const matched = findBestProductMatch(products, candidate);
                                    if (matched && matched.stockLevel > 0) {
                                        seedContext = {
                                            type: 'order',
                                            productName: matched.itemName,
                                            productId: matched.id,
                                            unitPrice: matched.price,
                                            quantity: 1,
                                            customer: { name: '', phone: '' },
                                            createdAt: new Date().toISOString(),
                                            editableUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                                            source: 'comment_private_reply',
                                            ctaType: 'purchase_offer',
                                        };
                                    }
                                }
                            } else if ((intent === 'product_availability' || intent === 'booking_intent' || intent === 'service_question') && businessType === 'appointments') {
                                const candidate = extractAvailabilityCandidate(commentText);
                                if (candidate) {
                                    const services = await loadActiveServices(supabaseAdmin, commentWorkspaceId || ownerId);
                                    const matched = findBestServiceMatch(services, candidate);
                                    if (matched) {
                                        seedContext = {
                                            type: 'appointment',
                                            serviceName: matched.name,
                                            serviceId: matched.id,
                                            servicePrice: matched.price,
                                            serviceDuration: matched.durationMinutes,
                                            customer: { name: '', phone: '' },
                                            createdAt: new Date().toISOString(),
                                            editableUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                                            source: 'comment_private_reply',
                                            ctaType: 'booking_offer',
                                        };
                                    }
                                }
                            }

                            if (seedContext) {
                                const stateWrite = await clearConversationState(
                                    supabaseAdmin, 
                                    ownerId, 
                                    commentWorkspaceId || ownerId, 
                                    commenterId, 
                                    businessType, 
                                    seedContext
                                );
                                if (!stateWrite.success) {
                                    console.error('Context seed save failed:', stateWrite.error);
                                }
                                console.log(`🌱 [Context Seed] Seeded ${seedContext.type} context for @${commenterName} from comment DM.`);
                            }
                        } catch (seedErr) {
                            console.error('❌ Failed to seed context from comment:', seedErr);
                        }
                    }

                    await supabaseAdmin.from('activity_log').insert({
                        user_id: ownerId,
                        workspace_id: commentWorkspaceId || null,
                        event_type: 'COMMENT_REPLY',
                        description: logDescription,
                        timestamp: new Date().toISOString(),
                        metadata: {
                            chat_id: commenterId,
                            comment_id: commentId,
                            commenter_name: commenterName,
                            commenter_id: commenterId,
                            media_id: mediaId,
                            platform: 'instagram',
                            type: 'comment',
                            reply_style: replyStyle,
                            public_comment_text: plan.publicCommentText,
                            private_dm_text: plan.privateDmText,
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
    const claimed = await claimDmBuffer(supabaseAdmin, ownerId, senderId, scheduledReplyAt, 'instagram', workspaceId);
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
            await clearDmBuffer(supabaseAdmin, ownerId, senderId, 'instagram', effectiveWorkspaceId);
            return;
        }

        // 3. Generate AI reply (ghost-brain v4 owns checkout via finalize_transaction tool)
        let aiResponse: string | null = null;
        let skipLegacyLogging = false;
        let brainDebug: any = null;
        try {
            const brainRes = await generateGhostReply(
                ownerId,
                batchedMessage,
                supabaseAdmin,
                senderId,
                effectiveWorkspaceId ?? undefined
            );
            brainDebug = brainRes?.debug || null;
            aiResponse = guardOutboundText(brainRes?.replyText || null, brainRes?.debug, 'instagram_dm_webhook');
            skipLegacyLogging = brainRes?.skipLegacyLogging || false;
        } catch (ghostErr) {
            console.error('❌ [Ghost Brain] generateGhostReply threw:', ghostErr);
            await clearDmBuffer(supabaseAdmin, ownerId, senderId, 'instagram', effectiveWorkspaceId);
            return;
        }

        if (!aiResponse) {
            console.log('Ghost Protocol: No reply (handoff or empty).');
            await clearDmBuffer(supabaseAdmin, ownerId, senderId, 'instagram', effectiveWorkspaceId);
            return;
        }

        // 6. Autopilot check
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
            await clearDmBuffer(supabaseAdmin, ownerId, senderId, 'instagram', effectiveWorkspaceId);
            return;
        }

        // 7. Reply Delay — makes the bot feel more human
        const replyDelay = await getReplyDelay(supabaseAdmin, ownerId, effectiveWorkspaceId);
        if (replyDelay > 0) {
            console.log(`⏱️ [Delay] Waiting ${replyDelay}s before replying to ${senderId}...`);
            await new Promise(resolve => setTimeout(resolve, replyDelay * 1000));
        }

        // 8. Send the reply
        console.log('🤖 AI Reply:', aiResponse);
        await sendReply(ownerId, senderId, aiResponse, supabaseAdmin, effectiveWorkspaceId || undefined, brainDebug);

        // 7. Log the reply (Only if not already logged by V2 engine)
        if (!skipLegacyLogging) {
            await supabaseAdmin.from('activity_log').insert({
                user_id: ownerId,
                workspace_id: effectiveWorkspaceId || null,
                event_type: 'AI_REPLY',
                description: `Sent: "${aiResponse}"`,
                timestamp: new Date().toISOString(),
                metadata: { chat_id: senderId, platform: 'instagram' }
            });
        }

        // 8. Clear the buffer
        await clearDmBuffer(supabaseAdmin, ownerId, senderId, 'instagram', effectiveWorkspaceId);
        console.log(`✅ [Buffer] Reply sent and buffer cleared for sender ${senderId}`);


    } catch (err) {
        console.error(`❌ [Buffer] processDmBuffer failed for sender ${senderId}:`, err);
        // Release lock so TTL can allow retry
        await releaseDmBuffer(supabaseAdmin, ownerId, senderId, 'instagram', workspaceId);
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

async function sendReply(ownerId: string, recipientId: string, text: string, supabaseAdmin: any, workspaceId?: string, debug?: any) {
    const guardedText = guardOutboundText(text, debug, 'instagram_send_reply');
    if (!guardedText) return;
    text = guardedText;

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

    // 🛑 KILL SWITCH CHECK
    const controls = await getBotControlDecision(supabaseAdmin, { workspaceId, chatId: recipientId, channel: 'instagram', type: 'dm' });
    if (controls.paused) {
        console.warn(`🛑 [KILL SWITCH] DM sending paused. Reason: ${controls.reason}`);
        return;
    }
    if (controls.disableExternalSends) {
        console.warn(`🛑 [KILL SWITCH] External Meta APIs disabled. Reason: ${controls.reason}`);
        return;
    }
    if (controls.forceDraft) {
        console.log(`📝 [KILL SWITCH] Force Draft active. Dropping send request. Reason: ${controls.reason}`);
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
        // Fetch the primary workspace ID to ensure activity logs map correctly to the dashboard workspace filter
        const { data: defaultWs } = await supabaseAdmin.from('ai_settings')
            .select('id')
            .eq('user_id', legacyConn.user_id)
            .limit(1)
            .maybeSingle();
        return { userId: legacyConn.user_id, workspaceId: defaultWs?.id || null };
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

    const globalAutopilot = settings?.is_autopilot_enabled ?? false;

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

/**
 * Fetch the configured reply delay (in seconds) from ai_settings.
 * Returns 0 if not configured or on free trial.
 */
async function getReplyDelay(supabaseAdmin: any, ownerId: string, workspaceId?: string | null): Promise<number> {
    try {
        const { data } = await supabaseAdmin
            .from('ai_settings')
            .select('reply_delay_seconds')
            .eq(workspaceId ? 'id' : 'user_id', workspaceId || ownerId)
            .maybeSingle();

        const delay = data?.reply_delay_seconds || 0;
        // Cap at 15 minutes (900s) for safety
        return Math.min(Math.max(0, delay), 900);
    } catch (err) {
        console.error('⚠️ [getReplyDelay] Failed to fetch delay:', err);
        return 0;
    }
}

async function sendCommentReply(ownerId: string, commentId: string, message: string, supabaseAdmin: any, workspaceId?: string) {
    const guardedText = guardOutboundText(message, null, 'instagram_comment_reply');
    if (!guardedText) return;
    message = guardedText;

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

    // 🛑 KILL SWITCH CHECK
    const controls = await getBotControlDecision(supabaseAdmin, { workspaceId, channel: 'instagram', type: 'comment' });
    if (controls.paused) {
        console.warn(`🛑 [KILL SWITCH] Comment reply paused. Reason: ${controls.reason}`);
        return;
    }
    if (controls.disableExternalSends) {
        console.warn(`🛑 [KILL SWITCH] External Meta APIs disabled. Reason: ${controls.reason}`);
        return;
    }
    if (controls.forceDraft) {
        console.log(`📝 [KILL SWITCH] Force Draft active. Dropping comment reply request. Reason: ${controls.reason}`);
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

async function sendPrivateReplyToComment(ownerId: string, commentId: string, message: string, supabaseAdmin: any, workspaceId?: string) {
    const guardedText = guardOutboundText(message, null, 'instagram_private_comment_reply');
    if (!guardedText) return;
    message = guardedText;

    let token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
    let isNewAPI = false;

    // Get the workspace-specific token from DB
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
        console.log(`[sendPrivateReply] Using workspace token for ${workspaceId}`);
    } else {
        const { data: oldConn } = await supabaseAdmin.from('user_connections')
            .select('metadata')
            .eq('user_id', ownerId)
            .in('provider', ['INSTAGRAM', 'instagram_api_login'])
            .limit(1).maybeSingle();

        if (oldConn?.metadata?.access_token) {
            token = oldConn.metadata.access_token;
            console.log(`[sendPrivateReply] Using legacy token for ${ownerId}`);
        }
    }

    if (!token) {
        console.error("❌ PRIVATE COMMENT REPLY FAILED: Missing Access Token for user", ownerId);
        return;
    }

    const baseUrl = isNewAPI ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
    const url = `${baseUrl}/v21.0/me/messages?access_token=${token}`;
    console.log(`✉️ [sendPrivateReply] Sending private reply for comment ${commentId}`);

    // 🛑 KILL SWITCH CHECK
    const controls = await getBotControlDecision(supabaseAdmin, { workspaceId, channel: 'instagram', type: 'dm' });
    if (controls.paused) {
        console.warn(`🛑 [KILL SWITCH] Private comment reply paused. Reason: ${controls.reason}`);
        return;
    }
    if (controls.disableExternalSends) {
        console.warn(`🛑 [KILL SWITCH] External Meta APIs disabled. Reason: ${controls.reason}`);
        return;
    }
    if (controls.forceDraft) {
        console.log(`📝 [KILL SWITCH] Force Draft active. Dropping private reply request. Reason: ${controls.reason}`);
        return;
    }

    const body = {
        recipient: { comment_id: commentId },
        message: { text: message },
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        if (data.error) {
            console.error("❌ PRIVATE REPLY FAILED:", data.error);
        } else {
            console.log("✅ PRIVATE REPLY SENT:", data);
        }
    } catch (fetchError) {
        console.error("❌ PRIVATE REPLY FETCH ERROR:", fetchError);
    }
}

// ── Comment Reply Plan Type ─────────────────────────────────

interface CommentReplyPlan {
    publicCommentText: string | null;
    privateDmText: string | null;
}

async function generateCommentReplyPlan(
    userId: string,
    commentText: string,
    commenterName: string,
    supabase: any,
    replyStyle: 'public' | 'dm' | 'both',
    workspaceId?: string
): Promise<CommentReplyPlan | null> {
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

        const langDirective = settings?.language === 'English' ? '⚠️ LANGUAGE OVERRIDE: Always reply in English.' : settings?.language === 'Lebanese Franco' ? '⚠️ LANGUAGE OVERRIDE: Always reply in Lebanese Arabizi.' : '';
        const toneDirective = settings?.tone || 'Professional & Friendly';
        const businessInstructions = settings?.system_instructions ? `BUSINESS INSTRUCTIONS: ${settings.system_instructions}` : '';

        const plan: CommentReplyPlan = { publicCommentText: null, privateDmText: null };

        if (settings?.business_type === 'ecommerce') {
            const candidate = extractAvailabilityCandidate(commentText);
            if (candidate) {
                const products = await searchProducts({
                    supabase,
                    workspaceId: workspaceId || userId,
                    query: candidate,
                    limit: 10,
                });
                const matched = findBestProductMatch(products, candidate);
                if (matched) {
                    const availability = matched.stockLevel > 0 ? 'in stock' : 'out of stock';
                    if (replyStyle === 'public' || replyStyle === 'both') {
                        plan.publicCommentText = replyStyle === 'both'
                            ? 'Check your DMs.'
                            : `DM us for ${matched.itemName} details.`;
                    }
                    if (replyStyle === 'dm' || replyStyle === 'both') {
                        plan.privateDmText = matched.stockLevel > 0
                            ? `${matched.itemName} - $${matched.price}, ${availability}. Want one?`
                            : `${matched.itemName} is currently out of stock.`;
                    }
                    return plan;
                }
            }
        }

        // ── Generate PUBLIC comment text (for 'public' and 'both' styles) ──
        if (replyStyle === 'public' || replyStyle === 'both') {
            const publicPrompt = replyStyle === 'both'
                ? `You are the official comment assistant for ${businessName} on Instagram.
${businessTypeDirective}

RULES (PUBLIC COMMENT — SHORT CTA ONLY):
- Keep reply to 1 short sentence (under 100 characters).
- Your job is to redirect the commenter to DMs.
- Examples: "Sent you a DM! 👻", "Check your DMs! 💬", "Just DM'd you the details! ✨"
- Be warm and friendly. Use 1 emoji.
- Match the commenter's language.
- NEVER include prices, stock info, or business details in the public comment.
${langDirective}
TONE: ${toneDirective}
${businessInstructions}`
                : `You are the official comment assistant for ${businessName} on Instagram.
${businessTypeDirective}

RULES FOR COMMENT REPLIES (PUBLIC — EVERYONE CAN SEE):
- Keep replies SHORT: 1-2 sentences max (under 150 characters ideally).
- Be warm, friendly, and professional.
- Use 1 emoji max.
- NEVER share private info (prices, stock levels, phone numbers) in comments.
- For pricing/availability questions, redirect to DMs: "DM us for details! 💬"
- For compliments: Thank them warmly.
- For questions about products: Give a brief answer and invite them to DM for more info.
- For complaints: Acknowledge and invite them to DM to resolve it privately.
- Address the commenter by name when natural (e.g., "@${commenterName}").
- Match the commenter's language.
- If the user asks about sports, politics, math, or anything outside the business, reply: "We're here to help with ${businessName}! DM us 💬"
${langDirective}
TONE: ${toneDirective}

AVAILABLE PRODUCTS (for reference only — do NOT list prices in comments):
${inventoryContext}

${businessInstructions}`;

            const publicResult = await generateText({
                model: groq("llama-3.3-70b-versatile"),
                system: publicPrompt,
                messages: [{ role: 'user', content: `Instagram comment from @${commenterName}: "${commentText}"` }],
            });
            plan.publicCommentText = publicResult.text || null;
        }

        // ── Generate PRIVATE DM text (for 'dm' and 'both' styles) ──
        if (replyStyle === 'dm' || replyStyle === 'both') {
            const dmPrompt = `You are the private DM assistant for ${businessName} on Instagram.
${businessTypeDirective}

CONTEXT: A user left a comment on Instagram and you are now DMing them privately with the actual answer.

RULES FOR PRIVATE DM REPLIES:
- This is a PRIVATE DM, not a public comment. Give the ACTUAL useful answer.
- Include specific details: prices, availability, booking info — whatever answers their question.
- Be warm, helpful, and conversational.
- Use 1-2 emojis max.
- Keep it concise but complete (2-4 sentences).
- NEVER say "check your DMs", "sent you a DM", "DM us", or "check inbox" — you ARE the DM.
- NEVER say "as I mentioned in the comment" — the user may not have seen a public reply.
- Address them by name naturally.
- Match the commenter's language.
- If you can answer their question using the inventory/business info, do so directly.
- End with an engagement hook like "Want me to reserve one?" or "Would you like to book?"
${langDirective}
TONE: ${toneDirective}

AVAILABLE PRODUCTS/SERVICES (use these to answer questions):
${inventoryContext}

${businessInstructions}`;

            const dmResult = await generateText({
                model: groq("llama-3.3-70b-versatile"),
                system: dmPrompt,
                messages: [{ role: 'user', content: `Instagram comment from @${commenterName}: "${commentText}"` }],
            });
            plan.privateDmText = dmResult.text || null;
        }

        // Validate: DM text must never contain CTA phrases meant for public comments
        if (plan.privateDmText) {
            const ctaPhrases = ['check your dm', 'sent you a dm', "i dm'd you", 'check inbox', 'check your inbox', 'dm us'];
            const dmLower = plan.privateDmText.toLowerCase();
            const hasCta = ctaPhrases.some(p => dmLower.includes(p));
            if (hasCta) {
                console.warn('⚠️ [CommentReply] DM text contained CTA phrase, regenerating...');
                // Strip the CTA and keep the rest, or regenerate
                for (const phrase of ctaPhrases) {
                    plan.privateDmText = plan.privateDmText.replace(new RegExp(phrase, 'gi'), '').trim();
                }
                // Clean up any double spaces or orphaned punctuation
                plan.privateDmText = plan.privateDmText.replace(/\s{2,}/g, ' ').replace(/^\s*[,!.]\s*/, '').trim();
            }
        }

        return plan;

    } catch (error) {
        console.error('Ghost Brain (Comment Plan) Error:', error);
        // Fallback plan
        if (replyStyle === 'public') {
            return { publicCommentText: "Thanks for your comment! DM us for more info 💬", privateDmText: null };
        } else if (replyStyle === 'dm') {
            return { publicCommentText: null, privateDmText: `Hey @${commenterName}! Thanks for reaching out. How can we help you? 😊` };
        } else {
            return {
                publicCommentText: "Sent you a DM! 👻",
                privateDmText: `Hey @${commenterName}! Thanks for reaching out. How can we help you? 😊`
            };
        }
    }
}
// ═══════════════════════════════════════
// 🛡️ SAFEGURADS
// ═══════════════════════════════════════

/**
 * Checks if the given sender ID belongs to an Instagram account 
 * that is currently connected to ANY Ghost Agent workspace. 
 * Prevents loops where Bot A talks to Bot B forever.
 */
async function checkIfSenderIsAnotherBot(supabaseAdmin: any, senderAccountId: string): Promise<boolean> {
    try {
        // Try new integrations table
        const { data: newConn } = await supabaseAdmin.from('instagram_integrations')
            .select('id')
            .eq('instagram_account_id', senderAccountId)
            .limit(1)
            .maybeSingle();

        if (newConn) return true;

        // Try old user connections
        const { data: oldConn } = await supabaseAdmin.from('user_connections')
            .select('id')
            .in('provider', ['INSTAGRAM', 'instagram_api_login'])
            .or(`metadata->>instagram_account_id.eq.${senderAccountId},metadata->>page_id.eq.${senderAccountId}`)
            .limit(1)
            .maybeSingle();

        if (oldConn) return true;

        return false;
    } catch {
        // Safe fail open to not break messaging on DB errors
        return false;
    }
}

/**
 * Downloads an Instagram audio attachment and transcribes it using Groq's Whisper API.
 * Uses whisper-large-v3 to process the voice note into text context for the Ghost AI.
 */
async function transcribeVoiceNote(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error fetching audio: ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Convert to a File-like object that the SDK accepts
        const file = await toFile(buffer, 'voicenote.m4a', { type: 'audio/mp4' });

        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const transcription = await groqClient.audio.transcriptions.create({
            file: file,
            model: 'whisper-large-v3', // Highest accuracy Whisper model
            response_format: 'text',
        });

        // When response_format is 'text', the SDK returns the raw string
        return typeof transcription === 'string' ? transcription : (transcription as any).text || null;
    } catch (error) {
        console.error("Transcribe Voice Note error:", error);
        return null;
    }
}
