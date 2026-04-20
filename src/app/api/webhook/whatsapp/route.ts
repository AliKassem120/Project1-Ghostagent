import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateGhostReply } from '@/utils/ghost-brain';

// ─── Admin Client ─────────────────────────────────────────────────────────────

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

const WA_API_BASE = 'https://graph.facebook.com/v18.0';

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
                // Only process inbound text messages
                if (message.type !== 'text') continue;

                const customerPhone: string = message.from;
                const messageText: string = message.text?.body;

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
                    console.warn(`⚠️ No workspace found for phone_number_id: ${phoneNumberId}`);
                    
                    // ── FALLBACK: use system-level env credentials ──────────
                    // This allows testing with the Meta test number before
                    // a workspace has been linked in ai_settings.
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
                        
                        const aiResponse = await generateGhostReply(
                            anyWorkspace.user_id,
                            messageText,
                            supabase,
                            customerPhone,
                            anyWorkspace.id
                        );
                        
                        if (!aiResponse) { console.log('👻 No reply (handoff/empty).'); continue; }
                        
                        const sendResult = await fetch(`${WA_API_BASE}/${phoneNumberId}/messages`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${systemToken}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                messaging_product: 'whatsapp',
                                recipient_type: 'individual',
                                to: customerPhone,
                                type: 'text',
                                text: { body: aiResponse },
                            }),
                        });
                        const sendBody = await sendResult.text();
                        if (!sendResult.ok) {
                            console.error(`❌ [Fallback] WhatsApp send failed (${sendResult.status}):`, sendBody);
                        } else {
                            console.log(`✅ [Fallback] WhatsApp reply sent to ${customerPhone}:`, sendBody);
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

                // ── 3. GENERATE AI REPLY ──────────────────────────────────
                const aiResponse = await generateGhostReply(
                    ownerId,
                    messageText,
                    supabase,
                    customerPhone,
                    workspace.id
                );

                if (!aiResponse) {
                    console.log('👻 Ghost Protocol: No reply generated (handoff or empty).');
                    continue;
                }

                // ── 4. SEND REPLY via WhatsApp Cloud API ──────────────────
                let sendResult = await fetch(`${WA_API_BASE}/${phoneNumberId}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: customerPhone,
                        type: 'text',
                        text: { body: aiResponse },
                    }),
                });

                // Retry with system token if the user's test token expired (401)
                if (sendResult.status === 401 && accessToken !== systemToken && phoneNumberId === systemPhoneId) {
                    console.warn('⚠️ [WhatsApp] Workspace token was rejected (401). Falling back to system token.');
                    sendResult = await fetch(`${WA_API_BASE}/${phoneNumberId}/messages`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${systemToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            messaging_product: 'whatsapp',
                            recipient_type: 'individual',
                            to: customerPhone,
                            type: 'text',
                            text: { body: aiResponse },
                        }),
                    });
                }

                if (!sendResult.ok) {
                    const errText = await sendResult.text();
                    console.error(`❌ WhatsApp send failed (${sendResult.status}):`, errText);
                    continue;
                }

                // Mark the incoming message as read
                if (message.id) {
                    fetch(`${WA_API_BASE}/${phoneNumberId}/messages`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${systemToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messaging_product: 'whatsapp', message_id: message.id, status: 'read' })
                    }).catch(e => console.error('Failed to mark read:', e));
                }

                // ── 5. LOG AI REPLY ───────────────────────────────────────
                await supabase.from('activity_log').insert({
                    user_id: ownerId,
                    workspace_id: workspace.id,
                    event_type: 'AI_REPLY',
                    description: `WhatsApp reply to ${customerPhone}: "${aiResponse}"`,
                    timestamp: new Date().toISOString(),
                    metadata: { chat_id: customerPhone, platform: 'whatsapp' },
                });

                console.log(`✅ WhatsApp reply sent to ${customerPhone}`);
            }
        }
    }
}
