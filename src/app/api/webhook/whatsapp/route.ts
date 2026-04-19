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
                    continue;
                }

                const { user_id: ownerId, whatsapp_access_token: accessToken } = workspace;

                if (!accessToken) {
                    console.warn(`⚠️ Workspace ${workspace.id} has no whatsapp_access_token`);
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
                // Reuses the same Ghost Brain — same prompt, memory, inventory.
                const aiResponse = await generateGhostReply(
                    ownerId,
                    messageText,
                    supabase,
                    customerPhone,   // chatId = customer phone for rolling memory
                    workspace.id     // Pass workspace ID for isolation
                );

                if (!aiResponse) {
                    console.log('👻 Ghost Protocol: No reply generated (handoff or empty).');
                    continue;
                }

                // ── 4. SEND REPLY via WhatsApp Cloud API ──────────────────
                const sendResult = await fetch(`${WA_API_BASE}/${phoneNumberId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: customerPhone,
                        type: 'text',
                        text: { body: aiResponse },
                    }),
                });

                if (!sendResult.ok) {
                    const errText = await sendResult.text();
                    console.error(`❌ WhatsApp send failed (${sendResult.status}):`, errText);
                    continue;
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
