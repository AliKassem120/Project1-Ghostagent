/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — V3 Webhook Ingestion Endpoint
 * ═══════════════════════════════════════════════════════════════
 * Non-blocking webhook handler for V3 workspaces.
 *
 * Flow: Receive → Verify Signature → Parse → Dedup → Enqueue → 200
 * Target: respond in <50ms so Meta never retries.
 *
 * Only handles workspaces with automation_engine_version = 'v3'.
 * All others get a 404 so they continue using the V2 handlers.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enqueueMessage, isDuplicate } from '@/lib/ai/queue';
import type { MessageJob } from '@/lib/ai/queue';
import crypto from 'crypto';

// ── Admin Client ─────────────────────────────────────────────

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

// ── Signature Verification ───────────────────────────────────

function verifyMetaSignature(rawBody: string, signature: string | null, platform: 'instagram' | 'whatsapp'): boolean {
    const appSecret = platform === 'instagram'
        ? (process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET)
        : process.env.FACEBOOK_APP_SECRET;

    if (!appSecret) {
        console.warn(`⚠️ [V3 Webhook] ${platform} app secret not set — skipping signature validation`);
        return true;
    }
    if (!signature) {
        console.warn(`⚠️ [V3 Webhook] No x-hub-signature-256 header`);
        return true;
    }

    const expected = 'sha256=' + crypto
        .createHmac('sha256', appSecret)
        .update(rawBody, 'utf8')
        .digest('hex');

    if (signature.length !== expected.length) return false;

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ── GET: Meta Webhook Verification Challenge ─────────────────

export async function GET(request: Request) {
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || 'ghost_agent_secret';

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('✅ [V3 Webhook] Verification challenge accepted');
        return new Response(challenge, { status: 200 });
    }

    return new Response('Forbidden', { status: 403 });
}

// ── POST: Incoming Webhook (Non-Blocking Ingestion) ──────────

export async function POST(req: Request) {
    const receivedAt = Date.now();

    // 1. Read raw body for signature verification
    let rawBody: string;
    try {
        rawBody = await req.text();
    } catch {
        return NextResponse.json({ received: true, error: 'body_read_failed' }, { status: 200 });
    }

    // 2. Determine platform from payload
    let body: any;
    try {
        body = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ received: true, error: 'json_parse_failed' }, { status: 200 });
    }

    const platform: 'instagram' | 'whatsapp' =
        body.object === 'whatsapp_business_account' ? 'whatsapp' : 'instagram';

    // 3. Verify signature
    const signature = req.headers.get('x-hub-signature-256');
    if (!verifyMetaSignature(rawBody, signature, platform)) {
        console.error('❌ [V3 Webhook] Signature verification failed');
        return NextResponse.json({ received: true, error: 'signature_invalid' }, { status: 401 });
    }

    // 4. Extract messages and enqueue
    const supabase = getSupabaseAdmin();
    const jobs: MessageJob[] = [];

    if (platform === 'instagram' && body.object === 'instagram') {
        for (const entry of body.entry || []) {
            for (const event of entry.messaging || []) {
                if (event.message?.is_echo || event.delivery || event.read) continue;

                const chatId = event.sender?.id;
                const recipientId = event.recipient?.id;
                const messageText = event.message?.text?.trim();

                if (!chatId || !messageText) continue;

                // Deduplication check
                if (await isDuplicate(chatId, messageText, receivedAt)) {
                    console.log(`🔄 [V3 Webhook] Duplicate rejected: ${chatId}`);
                    continue;
                }

                // Look up workspace by recipient IG account
                const workspace = await findWorkspaceForInstagram(supabase, recipientId);
                if (!workspace) continue;

                // Only handle V3 workspaces asynchronously via queue
                if (workspace.engineVersion !== 'v3') {
                    console.log(`⚡ [V3 Webhook] Routing V2 workspace synchronously: ${workspace.workspaceId}`);
                    const { handleAutomationMessage } = await import('@/lib/ai');
                    const { sendPlatformReply } = await import('@/lib/ai/worker');
                    
                    const dummyJob: MessageJob = {
                        workspaceId: workspace.workspaceId,
                        chatId,
                        userId: workspace.userId,
                        message: messageText,
                        platform: 'instagram',
                        workspaceType: workspace.workspaceType,
                        receivedAt,
                        webhookPayload: event,
                    };

                    const result = await handleAutomationMessage({
                        workspaceId: workspace.workspaceId,
                        workspaceType: workspace.workspaceType,
                        chatId,
                        message: messageText,
                        platform: 'instagram',
                        supabase,
                        userId: workspace.userId,
                    });

                    if (result.shouldReply && result.replyText) {
                        await sendPlatformReply(supabase, dummyJob, result.replyText);
                    }

                    return NextResponse.json({ handled: 'v2', shouldReply: result.shouldReply }, { status: 200 });
                }

                jobs.push({
                    workspaceId: workspace.workspaceId,
                    chatId,
                    userId: workspace.userId,
                    message: messageText,
                    platform: 'instagram',
                    workspaceType: workspace.workspaceType,
                    receivedAt,
                    webhookPayload: event,
                });
            }
        }
    } else if (platform === 'whatsapp' && body.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []) {
            for (const change of entry.changes || []) {
                if (change.field !== 'messages') continue;

                const phoneNumberId = change.value?.metadata?.phone_number_id;
                const messages = change.value?.messages || [];

                for (const message of messages) {
                    if (message.type !== 'text') continue;

                    const chatId = message.from;
                    const messageText = message.text?.body?.trim();

                    if (!chatId || !messageText) continue;

                    // Deduplication check
                    if (await isDuplicate(chatId, messageText, receivedAt)) {
                        console.log(`🔄 [V3 Webhook] Duplicate rejected: ${chatId}`);
                        continue;
                    }

                    // Look up workspace by WhatsApp phone number ID
                    const workspace = await findWorkspaceForWhatsApp(supabase, phoneNumberId);
                    if (!workspace) continue;

                    // Only handle V3 workspaces asynchronously via queue
                    if (workspace.engineVersion !== 'v3') {
                        console.log(`⚡ [V3 Webhook] Routing V2 workspace synchronously: ${workspace.workspaceId}`);
                        const { handleAutomationMessage } = await import('@/lib/ai');
                        const { sendPlatformReply } = await import('@/lib/ai/worker');
                        
                        const dummyJob: MessageJob = {
                            workspaceId: workspace.workspaceId,
                            chatId,
                            userId: workspace.userId,
                            message: messageText,
                            platform: 'whatsapp',
                            workspaceType: workspace.workspaceType,
                            receivedAt,
                            webhookPayload: message,
                        };

                        const result = await handleAutomationMessage({
                            workspaceId: workspace.workspaceId,
                            workspaceType: workspace.workspaceType,
                            chatId,
                            message: messageText,
                            platform: 'whatsapp',
                            supabase,
                            userId: workspace.userId,
                        });

                        if (result.shouldReply && result.replyText) {
                            await sendPlatformReply(supabase, dummyJob, result.replyText);
                        }

                        return NextResponse.json({ handled: 'v2', shouldReply: result.shouldReply }, { status: 200 });
                    }

                    jobs.push({
                        workspaceId: workspace.workspaceId,
                        chatId,
                        userId: workspace.userId,
                        message: messageText,
                        platform: 'whatsapp',
                        workspaceType: workspace.workspaceType,
                        receivedAt,
                        webhookPayload: message,
                    });
                }
            }
        }
    }

    // 5. Enqueue all jobs (non-blocking)
    if (jobs.length === 0) {
        return NextResponse.json({ received: true, queued: false, reason: 'no_v3_messages' }, { status: 200 });
    }

    // Fire-and-forget enqueue — don't await all, just kick them off
    const enqueuePromises = jobs.map(job => enqueueMessage(job).catch(err => {
        console.error('❌ [V3 Webhook] Enqueue failed:', err);
    }));

    // Await enqueue calls (they're fast REST calls to QStash)
    await Promise.all(enqueuePromises);

    console.log(`📤 [V3 Webhook] Enqueued ${jobs.length} job(s) in ${Date.now() - receivedAt}ms`);

    return NextResponse.json({
        received: true,
        queued: true,
        count: jobs.length,
        latencyMs: Date.now() - receivedAt,
    }, { status: 200 });
}

// ── Workspace Lookup Helpers ─────────────────────────────────

interface WorkspaceLookup {
    workspaceId: string;
    userId: string;
    workspaceType: 'ecommerce' | 'appointments' ;
    engineVersion: string;
}

async function findWorkspaceForInstagram(
    supabase: any,
    recipientId: string | undefined
): Promise<WorkspaceLookup | null> {
    if (!recipientId) return null;

    // Check instagram_integrations first
    const { data: integration } = await supabase
        .from('instagram_integrations')
        .select('workspace_id')
        .eq('instagram_account_id', recipientId)
        .maybeSingle();

    if (!integration?.workspace_id) return null;

    const { data: settings } = await supabase
        .from('ai_settings')
        .select('id, user_id, business_type, automation_engine_version')
        .eq('id', integration.workspace_id)
        .maybeSingle();

    if (!settings) return null;

    return {
        workspaceId: settings.id,
        userId: settings.user_id,
        workspaceType: settings.business_type || 'ecommerce',
        engineVersion: settings.automation_engine_version || 'v2',
    };
}

async function findWorkspaceForWhatsApp(
    supabase: any,
    phoneNumberId: string | undefined
): Promise<WorkspaceLookup | null> {
    if (!phoneNumberId) return null;

    const { data: settings } = await supabase
        .from('ai_settings')
        .select('id, user_id, business_type, automation_engine_version')
        .eq('whatsapp_phone_number_id', phoneNumberId)
        .maybeSingle();

    if (!settings) return null;

    return {
        workspaceId: settings.id,
        userId: settings.user_id,
        workspaceType: settings.business_type || 'ecommerce',
        engineVersion: settings.automation_engine_version || 'v2',
    };
}
