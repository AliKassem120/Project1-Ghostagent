/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Queue Worker (Async Message Processor)
 * ═══════════════════════════════════════════════════════════════
 *
 * Processes queued messages end-to-end:
 *   Load session → Typing indicator on → Orchestrate → Send reply
 *   → Typing indicator off → Save session → Upsert profile → Emit metrics
 *
 * With QUEUE_MODE enabled, webhooks enqueue and return 200 immediately.
 * This worker picks up jobs and handles the full lifecycle including
 * autopilot checks, bot controls, and draft saving.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { MessageJob } from './queue';
import { v2log } from '@/lib/ai/logger';

// ═══════════════════════════════════════════════════════════════
// TYPING INDICATORS
// ═══════════════════════════════════════════════════════════════

/**
 * Send typing indicator ("typing_on") to WhatsApp or Instagram.
 * This is called before the LLM starts processing so the customer
 * sees the "..." bubble immediately.
 */
export async function sendTypingIndicator(
    supabase: SupabaseClient,
    platform: 'instagram' | 'whatsapp',
    chatId: string,
    workspaceId: string,
    action: 'typing_on' | 'mark_seen'
): Promise<void> {
    try {
        if (platform === 'whatsapp') {
            const { data: ws } = await supabase
                .from('ai_settings')
                .select('whatsapp_access_token, whatsapp_phone_number_id')
                .eq('id', workspaceId)
                .maybeSingle();

            let token = ws?.whatsapp_access_token || process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN;
            let phoneId = ws?.whatsapp_phone_number_id || process.env.WHATSAPP_FROM_PHONE_NUMBER_ID;

            if (!token || !phoneId) return;

            // Sanitize recipient: strip non-digits, prepend '+'
            const recipient = `+${chatId.replace(/\D/g, '')}`;

            if (action === 'mark_seen') {
                // Mark message as read
                await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        status: 'read',
                        message_id: chatId, // Use the incoming message ID
                    }),
                });
            } else {
                // Send typing indicator
                await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: recipient,
                        type: 'text',
                        text: { body: '...' },
                    }),
                });
            }
        } else if (platform === 'instagram') {
            const { data: ws } = await supabase
                .from('ai_settings')
                .select('instagram_page_id, instagram_admin_id')
                .eq('id', workspaceId)
                .maybeSingle();

            let pageId = ws?.instagram_page_id;
            if (!pageId) {
                // Fallback to env
                const igBusinessId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
                if (!igBusinessId) return;
                pageId = igBusinessId;
            }

            // Instagram sends typing via the sender actions API
            const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
            if (!token) return;

            if (action === 'typing_on') {
                await fetch(`https://graph.facebook.com/v21.0/${pageId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        recipient: { id: chatId },
                        sender_action: 'typing_on',
                    }),
                });
            }
        }
    } catch (_e) {
        // Typing indicators are non-critical — fail silently
    }
}

// ═══════════════════════════════════════════════════════════════
// FULL WORKER PIPELINE
// ═══════════════════════════════════════════════════════════════

/**
 * Process a single queued message job. Handles the full lifecycle:
 * session → typing indicator → orchestrator → send reply → persist.
 */
export async function processMessageJob(job: MessageJob): Promise<void> {
    const startTime = Date.now();

    v2log.info('WORKER', 'Processing job', {
        workspaceId: job.workspaceId,
        chatId: job.chatId,
        platform: job.platform,
        receivedAt: job.receivedAt,
        queueLatencyMs: startTime - job.receivedAt,
    });

    const supabase = getSupabaseAdmin();

    try {
        // 1. Load workspace config
        const { loadWorkspaceConfig } = await import('@/lib/ai/config');
        const config = await loadWorkspaceConfig(supabase, job.workspaceId, job.userId);

        if (!config) {
            v2log.error('WORKER', 'Failed to load workspace config', {
                workspaceId: job.workspaceId,
            });
            return;
        }

        // 2. Send typing indicator — show "..." immediately
        await sendTypingIndicator(supabase, job.platform, job.chatId, job.workspaceId, 'typing_on');

        // 3. Run V3 LLM Agent
        const { runV3Agent } = await import('./agent');
        const result = await runV3Agent({
            workspaceId: job.workspaceId,
            workspaceType: job.workspaceType,
            chatId: job.chatId,
            message: job.message,
            platform: job.platform,
            supabase,
            userId: job.userId,
        }, config);

        // 4. Send reply via platform API (typing_off is implicit once message is sent)
        if (result.shouldReply && result.replyText) {
            await sendPlatformReply(supabase, job, result.replyText);
        }

        // ── PERSIST TO ANALYTICS ──
        try {
            await supabase.from('activity_log').insert({
                user_id: job.userId,
                workspace_id: job.workspaceId,
                event_type: 'AI_REPLY',
                description: result.replyText
                    ? `Sent: "${result.replyText.slice(0, 200)}"`
                    : `Processed: "${job.message.slice(0, 50)}..." (No reply)`,
                timestamp: new Date().toISOString(),
                metadata: {
                    chat_id: job.chatId,
                    platform: job.platform,
                    reply_text: result.replyText?.slice(0, 500),
                    debug: result.debug,
                },
            });
        } catch (logErr) {
            v2log.warn('WORKER', 'Failed to persist analytics log', { error: logErr });
        }

        // ── PERSIST AUTOMATION RUN ──
        try {
            await supabase.from('automation_runs').insert({
                workspace_id: job.workspaceId,
                chat_id: job.chatId,
                platform: job.platform,
                incoming_message: job.message,
                outgoing_reply: result.replyText || null,
                intent: result.debug?.intent || 'unknown',
                state_before: result.stateBefore,
                state_after: result.stateAfter,
                actions: result.actions,
                db_write_attempted: result.debug?.dbWriteAttempted || false,
                db_write_success: result.debug?.dbWriteSuccess || false,
                error: result.error || null,
                duration_ms: result.debug?.durationMs || (Date.now() - startTime),
                created_at: new Date().toISOString(),
            });
        } catch (runLogErr) {
            v2log.warn('WORKER', 'Failed to persist automation run', { error: runLogErr });
        }

        // CRITICAL ALERT: DB write was attempted but failed — fire multi-channel alert
        if (result.debug?.dbWriteAttempted && !result.debug?.dbWriteSuccess) {
            try {
                const { alertDbWriteFailure } = await import('@/lib/ai/guardrails/db-write-alerting');
                await alertDbWriteFailure(supabase, {
                    workspaceId: job.workspaceId,
                    chatId: job.chatId,
                    platform: job.platform,
                    businessType: config.businessType,
                    stateBefore: result.stateBefore,
                    stateAfter: result.stateAfter,
                    actions: result.actions,
                    requestId: result.debug.requestId,
                });
            } catch (alertErr) {
                v2log.warn('WORKER', 'DB write failure alert itself failed', {
                    error: alertErr instanceof Error ? alertErr.message : String(alertErr),
                });
            }
        }

        // 5. Upsert customer profile
        const { upsertCustomerProfile } = await import('./customer-profile');
        await upsertCustomerProfile(
            supabase, job.workspaceId, job.chatId, job.platform,
            { totalOrders: 0 } as any
        ).catch(() => {});

        const totalDuration = Date.now() - startTime;
        v2log.info('WORKER', 'Job completed', {
            workspaceId: job.workspaceId,
            chatId: job.chatId,
            durationMs: totalDuration,
        });

    } catch (err) {
        v2log.error('WORKER', 'Job processing failed', {
            error: err instanceof Error ? err.message : String(err),
            workspaceId: job.workspaceId,
            chatId: job.chatId,
            durationMs: Date.now() - startTime,
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// PLATFORM REPLY SENDERS
// ═══════════════════════════════════════════════════════════════

async function sendPlatformReply(
    supabase: SupabaseClient,
    job: MessageJob,
    text: string
): Promise<void> {
    if (job.platform === 'instagram') {
        await sendInstagramReply(supabase, job, text);
    } else {
        await sendWhatsAppReply(supabase, job, text);
    }
}

async function sendInstagramReply(
    supabase: SupabaseClient,
    job: MessageJob,
    text: string
): Promise<void> {
    // Try workspace-specific token first, fallback to env
    const { data: integration } = await supabase
        .from('platform_integrations')
        .select('access_token, metadata')
        .eq('workspace_id', job.workspaceId)
        .eq('platform', 'instagram')
        .maybeSingle();

    let token = integration?.access_token;

    if (!token) {
        // Check legacy storage in ai_settings
        const { data: legacy } = await supabase
            .from('ai_settings')
            .select('metadata')
            .eq('id', job.workspaceId)
            .limit(1)
            .maybeSingle();

        token = legacy?.metadata?.access_token;
    }

    if (!token) {
        token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
    }

    if (!token) {
        v2log.error('WORKER', 'No Instagram access token available', {
            workspaceId: job.workspaceId,
        });
        return;
    }

    token = token.trim();
    if (token.startsWith('"') && token.endsWith('"')) token = token.slice(1, -1);

    const baseUrl = integration?.access_token
        ? 'https://graph.instagram.com'
        : 'https://graph.facebook.com';

    const response = await fetch(`${baseUrl}/v21.0/me/messages?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: job.chatId },
            message: { text },
        }),
    });

    if (!response.ok) {
        const errBody = await response.text();
        v2log.error('WORKER', 'Instagram send failed', {
            status: response.status,
            error: errBody,
            chatId: job.chatId,
        });
    } else {
        v2log.info('WORKER', 'Instagram reply sent', { chatId: job.chatId });
    }
}

async function sendWhatsAppReply(
    supabase: SupabaseClient,
    job: MessageJob,
    text: string
): Promise<void> {
    const { data: workspace } = await supabase
        .from('ai_settings')
        .select('whatsapp_access_token, whatsapp_phone_number_id')
        .eq('id', job.workspaceId)
        .maybeSingle();

    let accessToken = workspace?.whatsapp_access_token;
    let phoneNumberId = workspace?.whatsapp_phone_number_id;

    if (!accessToken) accessToken = process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN;
    if (!phoneNumberId) phoneNumberId = process.env.WHATSAPP_FROM_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
        v2log.error('WORKER', 'No WhatsApp credentials available', {
            workspaceId: job.workspaceId,
        });
        return;
    }

    const recipient = `+${job.chatId.replace(/\D/g, '')}`;

    const response = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: recipient,
                type: 'text',
                text: { body: text },
            }),
        }
    );

    if (!response.ok) {
        const errBody = await response.text();
        v2log.error('WORKER', 'WhatsApp send failed', {
            status: response.status,
            error: errBody,
            chatId: job.chatId,
        });
    } else {
        v2log.info('WORKER', 'WhatsApp reply sent', { chatId: job.chatId });
    }
}

// ── Supabase Admin Client ────────────────────────────────────

function getSupabaseAdmin(): SupabaseClient {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
    );
}
