import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateGhostReply } from '@/utils/ghost-brain';
import { getBotControlDecision } from '@/lib/god-mode/bot-controls';
import { upsertDmBuffer, claimDmBuffer, clearDmBuffer, releaseDmBuffer, DEBOUNCE_SECONDS } from '@/utils/dm-debounce';
import { checkUserLimit } from '@/lib/billing';

// ─── Admin Client ─────────────────────────────────────────────────────────────

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

const WA_API_BASE = 'https://graph.facebook.com/v18.0';

function normalizeWhatsAppRecipient(phone: string) {
    return `+${phone.replace(/\D/g, '')}`;
}

function guardWhatsAppOutbound(text: string | null | undefined, debug?: any): string | null {
    if (!text || text.trim() === '') {
        console.warn(`Blocked outbound WhatsApp reply: empty text`);
        return null;
    }
    return text.trim();
}

// ═══════════════════════════════════════
// 🔑 GET — Meta Webhook Verification
// ═══════════════════════════════════════
export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const mode = params.get('hub.mode');
    const token = params.get('hub.verify_token');
    const challenge = params.get('hub.challenge');

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'ghost_agent_whatsapp_secret';

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('✅ WhatsApp webhook verified');
        return new Response(challenge, { status: 200 });
    }

    return new Response('Forbidden', { status: 403 });
}

// ═══════════════════════════════════════
// 📨 POST — Incoming WhatsApp Messages
// ═══════════════════════════════════════
export async function POST(req: Request) {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return new NextResponse('EVENT_RECEIVED', { status: 200 });
    }

    // ⏰ Return 200 to Meta IMMEDIATELY so it never times out.
    // Use after() to process the event AFTER the response is sent.
    after(async () => {
        try {
            await processWhatsAppEvent(body);
        } catch (err) {
            console.error('❌ WhatsApp webhook processing error:', err);
        }
    });

    return new NextResponse('EVENT_RECEIVED', { status: 200 });
}

// ═══════════════════════════════════════
// 🧠 Core Processing Logic
// ═══════════════════════════════════════
async function sendWhatsAppText({
    phoneNumberId,
    accessToken,
    recipient,
    text,
}: {
    phoneNumberId: string;
    accessToken: string;
    recipient: string;
    text: string;
}): Promise<Response> {
    return fetch(`${WA_API_BASE}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
            type: 'text',
            text: { body: text },
        }),
    });
}

async function processWhatsAppBuffer({
    supabase,
    ownerId,
    workspaceId,
    customerPhone,
    phoneNumberId,
    accessToken,
    scheduledReplyAt,
    messageId,
    systemToken,
    systemPhoneId,
}: {
    supabase: any;
    ownerId: string;
    workspaceId: string;
    customerPhone: string;
    phoneNumberId: string;
    accessToken: string;
    scheduledReplyAt: string;
    messageId?: string;
    systemToken?: string;
    systemPhoneId?: string;
}) {
    // ── BILLING GATE: Enforce reply limits before processing ──
    const limitCheck = await checkUserLimit(ownerId);
    if (!limitCheck.allowed) {
        console.warn(`🚫 WhatsApp reply blocked for ${ownerId}: ${limitCheck.reason}`);
        return;
    }

    const claimed = await claimDmBuffer(supabase, ownerId, customerPhone, scheduledReplyAt, 'whatsapp', workspaceId);
    if (!claimed) return;

    const effectiveWorkspaceId = claimed.workspaceId || workspaceId;

    try {
        const brainRes = await generateGhostReply(
            ownerId,
            claimed.text,
            supabase,
            customerPhone,
            effectiveWorkspaceId,
            'whatsapp'
        );

        const aiResponse = guardWhatsAppOutbound(brainRes?.replyText || null, brainRes?.debug);
        if (!aiResponse) {
            await clearDmBuffer(supabase, ownerId, customerPhone, 'whatsapp', effectiveWorkspaceId);
            return;
        }

        const isAutopilot = await checkAutopilot(supabase, ownerId, customerPhone, effectiveWorkspaceId);
        if (!isAutopilot) {
            console.log('🛑 AUTOPILOT OFF: Saving draft WhatsApp reply.');
            await supabase.from('activity_log').insert({
                user_id: ownerId,
                workspace_id: effectiveWorkspaceId || null,
                event_type: 'DRAFT_REPLY',
                description: `Draft: "${aiResponse}"`,
                timestamp: new Date().toISOString(),
                metadata: {
                    chat_id: customerPhone,
                    platform: 'whatsapp',
                    status: 'pending_approval',
                    reply_text: aiResponse
                }
            });
            await clearDmBuffer(supabase, ownerId, customerPhone, 'whatsapp', effectiveWorkspaceId);
            return;
        }

        const controls = await getBotControlDecision(supabase, { workspaceId: effectiveWorkspaceId, chatId: customerPhone, channel: 'whatsapp', type: 'dm' });
        if (controls.paused || controls.disableExternalSends || controls.forceDraft) {
            console.warn(`WhatsApp send blocked by controls. Reason: ${controls.reason}`);
            await clearDmBuffer(supabase, ownerId, customerPhone, 'whatsapp', effectiveWorkspaceId);
            return;
        }

        const formattedRecipient = normalizeWhatsAppRecipient(customerPhone);
        let sendResult = await sendWhatsAppText({ phoneNumberId, accessToken, recipient: formattedRecipient, text: aiResponse });

        if (sendResult.status === 401 && systemToken && accessToken !== systemToken && phoneNumberId === systemPhoneId) {
            console.warn('WhatsApp workspace token rejected. Retrying with system token.');
            sendResult = await sendWhatsAppText({ phoneNumberId, accessToken: systemToken, recipient: formattedRecipient, text: aiResponse });
        }

        if (!sendResult.ok) {
            const errText = await sendResult.text();
            console.error(`WhatsApp send failed (${sendResult.status}):`, errText);
            await clearDmBuffer(supabase, ownerId, customerPhone, 'whatsapp', effectiveWorkspaceId);
            return;
        }

        if (messageId) {
            fetch(`${WA_API_BASE}/${phoneNumberId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ messaging_product: 'whatsapp', message_id: messageId, status: 'read' })
            }).catch(e => console.error('Failed to mark read:', e));
        }

        // ── 3. LOG OUTGOING AI REPLY ───────────────────────────────
        try {
            const autoResult = brainRes?.automationResult;
            await supabase.from('activity_log').insert({
                user_id: ownerId,
                workspace_id: effectiveWorkspaceId,
                event_type: 'AI_REPLY',
                description: `Sent: "${aiResponse}"`,
                timestamp: new Date().toISOString(),
                metadata: {
                    chat_id: customerPhone,
                    platform: 'whatsapp',
                    username: customerPhone,
                    message: claimed.text,
                    reply: aiResponse,
                    intent: autoResult?.debug?.intent || null,
                    actions: autoResult?.actions || [],
                    stateBefore: autoResult?.stateBefore || null,
                    stateAfter: autoResult?.stateAfter || null,
                    engine: 'v3-webhook'
                },
            });
        } catch (logErr) {
            console.error('Failed to log AI_REPLY to activity_log:', logErr);
        }

        await clearDmBuffer(supabase, ownerId, customerPhone, 'whatsapp', effectiveWorkspaceId);
        console.log(`WhatsApp reply sent to ${customerPhone}`);
    } catch (err) {
        console.error(`WhatsApp buffer processing failed for ${customerPhone}:`, err);
        await releaseDmBuffer(supabase, ownerId, customerPhone, 'whatsapp', effectiveWorkspaceId);
    }
}

async function enqueueWhatsAppMessage(args: {
    supabase: any;
    ownerId: string;
    workspaceId: string;
    customerPhone: string;
    messageText: string;
    phoneNumberId: string;
    accessToken: string;
    messageId?: string;
    systemToken?: string;
    systemPhoneId?: string;
}) {
    const replyAt = await upsertDmBuffer({
        supabase: args.supabase,
        ownerId: args.ownerId,
        senderId: args.customerPhone,
        workspaceId: args.workspaceId,
        messageText: args.messageText,
        channel: 'whatsapp',
    });

    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_SECONDS * 1000 + 500));
    await processWhatsAppBuffer({ ...args, scheduledReplyAt: replyAt });
}

async function processWhatsAppEvent(body: any) {
    if (body.object !== 'whatsapp_business_account') return;

    const supabase = getSupabaseAdmin();

    for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
            if (change.field !== 'messages') continue;

            const value = change.value;
            const phoneNumberId: string = value?.metadata?.phone_number_id;
            const messages: any[] = value?.messages ?? [];
            const statuses: any[] = value?.statuses ?? [];


            // ── 1. HANDLE STATUS UPDATES (Sent, Delivered, Read, Failed) ──
            for (const status of statuses) {
                const messageId = status.id;
                const statusType = status.status; // sent, delivered, read, failed
                const recipient = status.recipient_id;

                if (statusType === 'failed') {
                    const error = status.errors?.[0];
                    console.error(`🔴 WhatsApp Delivery FAILURE to ${recipient}: [${error?.code}] ${error?.title} - ${error?.message}`);
                    
                    // Log the failure to activity log so the user can see it in dashboard
                    await supabase.from('activity_log').insert({
                        event_type: 'SYSTEM_ALERT',
                        description: `WhatsApp failed to ${recipient}: ${error?.title || 'Unknown error'}`,
                        timestamp: new Date().toISOString(),
                        metadata: { 
                            error_code: error?.code, 
                            error_details: error?.message,
                            message_id: messageId,
                            platform: 'whatsapp'
                        },
                    });
                } else {
                    console.log(`ℹ️ WhatsApp Status update for ${recipient}: ${statusType} (${messageId.slice(-8)})`);
                }
            }

            // ── 2. HANDLE INCOMING MESSAGES ──
            for (const message of messages) {
                // Support standard text, interactive quick-replies, and button replies
                if (message.type !== 'text' && message.type !== 'interactive' && message.type !== 'button') continue;

                const customerPhone: string = message.from;
                let messageText = '';

                if (message.type === 'text') {
                    messageText = message.text?.body || '';
                } else if (message.type === 'interactive') {
                    const interactive = message.interactive;
                    if (interactive?.type === 'button_reply') {
                        messageText = `[SYSTEM NOTE: Customer clicked the "${interactive.button_reply?.title}" button. DO NOT send the button again. You MUST proceed with the next step in text format.]`;
                    } else if (interactive?.type === 'list_reply') {
                        messageText = `[SYSTEM NOTE: Customer selected "${interactive.list_reply?.title}" from the list.]`;
                    } else if (interactive?.type === 'nfm_reply') {
                        const nfmReply = interactive.nfm_reply;
                        try {
                            const data = JSON.parse(nfmReply?.response_json || '{}');
                            const name = data.customer_name || 'Not provided';
                            const phone = data.customer_phone || 'Not provided';
                            const date = data.booking_date || 'Not provided';
                            const time = data.booking_time || 'Not provided';
                            const notes = data.notes || 'None';
                            
                            messageText = `[SYSTEM NOTE: Customer completed the native Booking Flow. Here is the submitted data:\n- Name: ${name}\n- Phone: ${phone}\n- Preferred Date: ${date}\n- Preferred Time: ${time}\n- Notes: ${notes}\n\nAction required: You must check availability, then immediately call the book_appointment tool with these details, and write a warm, custom confirmation message to the customer in Lebanese Arabizi/English.]`;
                        } catch (err) {
                            console.error('Error parsing nfm_reply JSON:', err);
                            messageText = `[SYSTEM NOTE: Customer submitted the native Booking Flow, but there was an error parsing the data.]`;
                        }
                    }
                } else if (message.type === 'button') {
                    messageText = `[SYSTEM NOTE: Customer clicked the "${message.button?.text}" button. DO NOT send the button again. You MUST proceed with the next step in text format.]`;
                }

                if (!messageText || !customerPhone || !phoneNumberId) continue;

                console.log(`📱 WhatsApp message from ${customerPhone}: "${messageText.slice(0, 80)}"`);

                // ── 1. FIND WORKSPACE ──────────────────────────────────────
                // Match by whatsapp_phone_number_id so each SaaS user's
                // connected number routes to their correct agent.
                const { data: workspace, error: wsError } = await supabase
                    .from('ai_settings')
                    .select('id, user_id, business_name, whatsapp_access_token')
                    .eq('whatsapp_phone_number_id', phoneNumberId)
                    .single();

                if (wsError || !workspace) {
                    // ── PRODUCTION SAFETY: Never route to a random workspace ──
                    const allowDevFallback = process.env.WHATSAPP_ALLOW_DEV_FALLBACK === 'true';

                    if (!allowDevFallback) {
                        console.error(`🚨 [SYSTEM_ALERT] No workspace found for whatsapp_phone_number_id: ${phoneNumberId}. Message from ${customerPhone} DROPPED. Set WHATSAPP_ALLOW_DEV_FALLBACK=true for dev testing.`);
                        continue; // Do not reply — prevents wrong-workspace routing
                    }

                    // ── DEV-ONLY FALLBACK: use system-level env credentials ──────────
                    console.warn(`⚠️ [DEV FALLBACK] No workspace for phone_number_id: ${phoneNumberId}. Using system credentials (dev mode).`);
                    const systemToken = process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN;
                    const systemPhoneId = process.env.WHATSAPP_FROM_PHONE_NUMBER_ID;
                    
                    if (systemToken && systemPhoneId && phoneNumberId === systemPhoneId) {
                        console.log(`🔧 [WhatsApp Fallback] Using system-level credentials for phone ID: ${phoneNumberId}`);
                        
                        // Find the first workspace owner as a fallback user
                        const { data: anyWorkspace } = await supabase
                            .from('ai_settings')
                            .select('id, user_id')
                            .limit(1)
                            .maybeSingle();
                        
                        if (!anyWorkspace) {
                            console.warn('⚠️ No workspace at all in DB. Skipping.');
                            continue;
                        }
                        
                        const brainRes = await generateGhostReply(
                            anyWorkspace.user_id,
                            messageText,
                            supabase,
                            customerPhone,
                            anyWorkspace.id,
                            'whatsapp'
                        );
                        const aiResponse = guardWhatsAppOutbound(brainRes?.replyText || null, brainRes?.debug);
                        if (!aiResponse) { console.log('👻 No reply (handoff/empty).'); continue; }
                        
                        const formattedRecipient = normalizeWhatsAppRecipient(customerPhone);
                        console.log(`🔧 [Fallback] Sending to: ${formattedRecipient}`);
                        
                        const sendResult = await fetch(`${WA_API_BASE}/${phoneNumberId}/messages`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${systemToken}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                messaging_product: 'whatsapp',
                                recipient_type: 'individual',
                                to: formattedRecipient,
                                type: 'text',
                                text: { body: aiResponse },
                            }),
                        });
                        const sendBody = await sendResult.text();
                        if (!sendResult.ok) {
                            console.error(`❌ [Fallback] WhatsApp send failed (${sendResult.status}):`, sendBody);
                        } else {
                            console.log(`✅ [Fallback] WhatsApp reply sent to ${customerPhone}:`, sendBody);
                            try {
                                const autoResult = brainRes?.automationResult;
                                await supabase.from('activity_log').insert({
                                    user_id: anyWorkspace.user_id,
                                    workspace_id: anyWorkspace.id,
                                    event_type: 'AI_REPLY',
                                    description: `Sent: "${aiResponse}"`,
                                    timestamp: new Date().toISOString(),
                                    metadata: {
                                        chat_id: customerPhone,
                                        platform: 'whatsapp',
                                        username: customerPhone,
                                        message: messageText,
                                        reply: aiResponse,
                                        intent: autoResult?.debug?.intent || null,
                                        actions: autoResult?.actions || [],
                                        stateBefore: autoResult?.stateBefore || null,
                                        stateAfter: autoResult?.stateAfter || null,
                                        engine: 'v3-fallback'
                                    },
                                });
                            } catch (logErr) {
                                console.error('Failed to log Fallback AI_REPLY:', logErr);
                            }
                        }
                    } else {
                        console.warn(`⚠️ Phone ID ${phoneNumberId} does not match system ID ${process.env.WHATSAPP_FROM_PHONE_NUMBER_ID}. No handler found.`);
                    }
                    continue;
                }

                let accessToken = workspace?.whatsapp_access_token;
                const ownerId = workspace?.user_id;
                const systemToken = process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN;
                const systemPhoneId = process.env.WHATSAPP_FROM_PHONE_NUMBER_ID;

                // ── PLAN GATE: Verify user has Pro or Empire for WhatsApp ──
                const { data: ownerData } = await supabase
                    .from('users')
                    .select('plan_tier')
                    .eq('id', ownerId)
                    .single();
                const ownerPlan = (ownerData?.plan_tier || '').toLowerCase();
                const allowDevFallbackWA = process.env.WHATSAPP_ALLOW_DEV_FALLBACK === 'true';
                const hasWhatsAppAccess = ownerPlan === 'pro' || ownerPlan === 'empire' || ownerPlan === 'free_trial';
                if (!hasWhatsAppAccess && !allowDevFallbackWA) {
                    console.warn(`🚫 WhatsApp blocked for ${ownerId}: plan is '${ownerPlan}', requires Pro or Empire. Message from ${customerPhone} dropped.`);
                    continue;
                }

                // If DB token missing, fallback to system token (for testing stability)
                if (!accessToken && phoneNumberId === systemPhoneId) {
                    console.log('🔧 [WhatsApp] No workspace token found. Using system-level test token.');
                    accessToken = systemToken;
                }

                if (!accessToken) {
                    console.warn(`⚠️ Phone ID ${phoneNumberId} has no WhatsApp access token in DB and does not match system fallback.`);
                    continue;
                }

                // ── 2. LOG INCOMING MESSAGE ───────────────────────────────
                await supabase.from('activity_log').insert({
                    user_id: ownerId,
                    workspace_id: workspace.id,
                    event_type: 'INCOMING_MESSAGE',
                    description: `WhatsApp ${customerPhone}: "${messageText}"`,
                    timestamp: new Date().toISOString(),
                    metadata: { chat_id: customerPhone, platform: 'whatsapp', username: customerPhone },
                });

                await enqueueWhatsAppMessage({
                    supabase,
                    ownerId,
                    workspaceId: workspace.id,
                    customerPhone,
                    messageText,
                    phoneNumberId,
                    accessToken,
                    messageId: message.id,
                    systemToken,
                    systemPhoneId,
                });
            }
        }
    }
}

async function checkAutopilot(supabaseAdmin: any, ownerId: string, externalChatId?: string, workspaceId?: string): Promise<boolean> {
    // 1. Global/Workspace autopilot check
    const { data: settings } = await supabaseAdmin
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
        const query = supabaseAdmin
            .from('conversation_states')
            .select('id, is_muted, muted_until')
            .eq('user_id', ownerId)
            .eq('external_chat_id', externalChatId);

        if (workspaceId) {
            query.eq('workspace_id', workspaceId);
        }

        const { data: chatState } = await query.maybeSingle();

        if (chatState?.is_muted) {
            const now = new Date();
            const until = chatState.muted_until ? new Date(chatState.muted_until) : null;
            if (until && now > until) {
                // Mute has expired! Automatically unmute in DB
                await supabaseAdmin
                    .from('conversation_states')
                    .update({ is_muted: false, muted_until: null })
                    .eq('id', chatState.id);
                console.log(`🔓 Mute expired for chat ${externalChatId}, unmuting and allowing autopilot.`);
            } else {
                console.log(`🛑 AI is Muted manually for chat ${externalChatId}`);
                return false;
            }
        }
    }

    console.log(`🤖 Autopilot System for ${workspaceId || ownerId}: ON`);
    return true;
}
