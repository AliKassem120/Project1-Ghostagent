import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateGhostReply } from '@/utils/ghost-brain';
import { getBotControlDecision } from '@/lib/god-mode/bot-controls';
import { upsertDmBuffer, claimDmBuffer, clearDmBuffer, releaseDmBuffer, DEBOUNCE_SECONDS } from '@/utils/dm-debounce';

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

const WA_API_BASE = 'https://graph.facebook.com/v18.0';

type WorkspaceRoute = {
    id: string;
    user_id: string;
    business_name?: string | null;
    whatsapp_access_token?: string | null;
};

function normalizePhone(p: string) {
    return `+${p.replace(/\D/g, '')}`;
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isUnsafeOutbound(text: string | null | undefined) {
    return !text || text.includes('[HANDOFF]');
}

async function sendWhatsAppText(params: {
    phoneNumberId: string;
    accessToken: string;
    to: string;
    body: string;
}) {
    return fetch(`${WA_API_BASE}/${params.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${params.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: normalizePhone(params.to),
            type: 'text',
            text: { body: params.body },
        }),
    });
}

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

export async function POST(req: Request) {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return new NextResponse('EVENT_RECEIVED', { status: 200 });
    }

    after(async () => {
        try {
            await processWhatsAppEvent(body);
        } catch (err) {
            console.error('❌ WhatsApp webhook processing error:', err);
        }
    });

    return new NextResponse('EVENT_RECEIVED', { status: 200 });
}

async function resolveWorkspace(supabase: any, phoneNumberId: string): Promise<{ workspace: WorkspaceRoute | null; accessToken: string | null; fallback: boolean }> {
    const { data: workspace, error: wsError } = await supabase
        .from('ai_settings')
        .select('id, user_id, business_name, whatsapp_access_token')
        .eq('whatsapp_phone_number_id', phoneNumberId)
        .single();

    if (!wsError && workspace) {
        let accessToken = workspace.whatsapp_access_token || null;
        const systemToken = process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN || null;
        const systemPhoneId = process.env.WHATSAPP_FROM_PHONE_NUMBER_ID;
        if (!accessToken && phoneNumberId === systemPhoneId) accessToken = systemToken;
        return { workspace, accessToken, fallback: false };
    }

    const systemToken = process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN || null;
    const systemPhoneId = process.env.WHATSAPP_FROM_PHONE_NUMBER_ID;
    if (systemToken && systemPhoneId && phoneNumberId === systemPhoneId) {
        const { data: anyWorkspace } = await supabase
            .from('ai_settings')
            .select('id, user_id, business_name, whatsapp_access_token')
            .limit(1)
            .maybeSingle();
        if (anyWorkspace) return { workspace: anyWorkspace, accessToken: systemToken, fallback: true };
    }

    return { workspace: null, accessToken: null, fallback: false };
}

async function processClaimedWhatsAppBuffer(params: {
    supabase: any;
    workspace: WorkspaceRoute;
    accessToken: string;
    phoneNumberId: string;
    customerPhone: string;
    scheduledReplyAt: string;
}) {
    const { supabase, workspace, accessToken, phoneNumberId, customerPhone, scheduledReplyAt } = params;
    const ownerId = workspace.user_id;

    const claimed = await claimDmBuffer(supabase, ownerId, customerPhone, scheduledReplyAt, 'whatsapp');
    if (!claimed) return;

    const bufferedText = claimed.text;

    try {
        const brainRes = await generateGhostReply(
            ownerId,
            bufferedText,
            supabase,
            customerPhone,
            workspace.id,
            'whatsapp'
        );
        const aiResponse = brainRes?.replyText || null;

        if (isUnsafeOutbound(aiResponse)) {
            console.warn('🛡️ [WhatsApp Guard] Skipping unsafe/empty outbound reply', { customerPhone, aiResponse });
            await clearDmBuffer(supabase, ownerId, customerPhone, 'whatsapp');
            return;
        }

        const controls = await getBotControlDecision(supabase, {
            workspaceId: workspace.id,
            chatId: customerPhone,
            channel: 'whatsapp',
            type: 'dm'
        });
        if (controls.paused || controls.disableExternalSends || controls.forceDraft) {
            console.warn(`🛑 [KILL SWITCH] WhatsApp send blocked. Reason: ${controls.reason}`);
            await releaseDmBuffer(supabase, ownerId, customerPhone, 'whatsapp');
            return;
        }

        let sendResult = await sendWhatsAppText({ phoneNumberId, accessToken, to: customerPhone, body: aiResponse! });

        const systemToken = process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN || undefined;
        const systemPhoneId = process.env.WHATSAPP_FROM_PHONE_NUMBER_ID;
        if (sendResult.status === 401 && systemToken && accessToken !== systemToken && phoneNumberId === systemPhoneId) {
            console.warn('⚠️ [WhatsApp] Workspace token rejected. Falling back to system token.');
            sendResult = await sendWhatsAppText({ phoneNumberId, accessToken: systemToken, to: customerPhone, body: aiResponse! });
        }

        if (!sendResult.ok) {
            const errText = await sendResult.text();
            console.error(`❌ WhatsApp send failed (${sendResult.status}):`, errText);
            await releaseDmBuffer(supabase, ownerId, customerPhone, 'whatsapp');
            return;
        }

        await supabase.from('activity_log').insert({
            user_id: ownerId,
            workspace_id: workspace.id,
            event_type: 'AI_REPLY',
            description: `WhatsApp reply to ${customerPhone}: "${aiResponse}"`,
            timestamp: new Date().toISOString(),
            metadata: {
                chat_id: customerPhone,
                platform: 'whatsapp',
                buffered_text: bufferedText,
                actions: brainRes?.actions || [],
                stateBefore: brainRes?.stateBefore,
                stateAfter: brainRes?.stateAfter,
                dbWriteAttempted: brainRes?.dbWriteAttempted ?? false,
                dbWriteSuccess: brainRes?.dbWriteSuccess ?? false,
                error: brainRes?.error,
            },
        });

        await clearDmBuffer(supabase, ownerId, customerPhone, 'whatsapp');
        console.log(`✅ WhatsApp buffered reply sent to ${customerPhone}`);
    } catch (err) {
        console.error('❌ WhatsApp buffered processing failed:', err);
        await releaseDmBuffer(supabase, ownerId, customerPhone, 'whatsapp');
    }
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

            for (const status of statuses) {
                const messageId = status.id;
                const statusType = status.status;
                const recipient = status.recipient_id;

                if (statusType === 'failed') {
                    const error = status.errors?.[0];
                    console.error(`🔴 WhatsApp Delivery FAILURE to ${recipient}: [${error?.code}] ${error?.title} - ${error?.message}`);
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
                    console.log(`ℹ️ WhatsApp Status update for ${recipient}: ${statusType} (${String(messageId || '').slice(-8)})`);
                }
            }

            for (const message of messages) {
                if (message.type !== 'text') continue;

                const customerPhone: string = message.from;
                const messageText: string = message.text?.body;
                if (!messageText || !customerPhone || !phoneNumberId) continue;

                const { workspace, accessToken } = await resolveWorkspace(supabase, phoneNumberId);
                if (!workspace || !accessToken) {
                    console.warn(`⚠️ No WhatsApp workspace/token found for phone_number_id: ${phoneNumberId}`);
                    continue;
                }

                console.log(`📱 WhatsApp message from ${customerPhone}: "${messageText.slice(0, 80)}"`);

                await supabase.from('activity_log').insert({
                    user_id: workspace.user_id,
                    workspace_id: workspace.id,
                    event_type: 'INCOMING_MESSAGE',
                    description: `WhatsApp ${customerPhone}: "${messageText}"`,
                    timestamp: new Date().toISOString(),
                    metadata: {
                        chat_id: customerPhone,
                        platform: 'whatsapp',
                        username: customerPhone,
                        provider_message_id: message.id,
                    },
                });

                const scheduledReplyAt = await upsertDmBuffer({
                    supabase,
                    ownerId: workspace.user_id,
                    senderId: customerPhone,
                    workspaceId: workspace.id,
                    messageText,
                    channel: 'whatsapp',
                });

                after(async () => {
                    await sleep(DEBOUNCE_SECONDS * 1000 + 250);
                    await processClaimedWhatsAppBuffer({
                        supabase,
                        workspace,
                        accessToken,
                        phoneNumberId,
                        customerPhone,
                        scheduledReplyAt,
                    });
                });

                if (message.id) {
                    fetch(`${WA_API_BASE}/${phoneNumberId}/messages`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messaging_product: 'whatsapp', message_id: message.id, status: 'read' })
                    }).catch(e => console.error('Failed to mark WhatsApp read:', e));
                }
            }
        }
    }
}
