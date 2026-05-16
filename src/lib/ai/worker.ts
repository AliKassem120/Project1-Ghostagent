/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Worker (Message Job Processor)
 * ═══════════════════════════════════════════════════════════════
 * Processes a single message job end-to-end:
 *   Load session → Load profile → Orchestrate → Send reply
 *   → Save session → Upsert profile → Emit metrics
 *
 * Called by:
 *   - QStash worker endpoint (api/worker/process)
 *   - Local fallback (queue.ts setImmediate)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { MessageJob } from './queue';
import { v2log } from '@/lib/ai/logger';

// ── Process Message Job ──────────────────────────────────────

/**
 * Process a single queued message job. Handles the full lifecycle:
 * session → orchestrator → reply → persist → metrics.
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

        // 2. Load customer profile (cross-channel awareness)
        const { loadCustomerProfile, upsertCustomerProfile } = await import('./customer-profile');
        const profile = await loadCustomerProfile(
            supabase, job.workspaceId, job.chatId, job.platform
        );

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

        // 4. Send reply via platform API
        if (result.shouldReply && result.replyText) {
            await sendPlatformReply(supabase, job, result.replyText);
        }

        // ── PERSIST TO ANALYTICS (Live Dashboard Overview) ──
        try {
            await supabase.from('activity_log').insert({
                user_id: job.userId,
                workspace_id: job.workspaceId,
                event_type: 'AI_REPLY',
                description: result.replyText 
                    ? `Sent: "${result.replyText.slice(0, 80)}"`
                    : `Processed message: "${job.message.slice(0, 30)}..." (No reply)`,
                metadata: {
                    requestId: result.debug.requestId,
                    message: job.message,
                    reply: result.replyText,
                    intent: result.debug.intent,
                    language: result.debug.language,
                    stateBefore: result.stateBefore,
                    stateAfter: result.stateAfter,
                    actions: result.actions,
                    durationMs: result.debug.durationMs,
                    platform: job.platform,
                    chat_id: job.chatId,
                    engine: 'v3-worker'
                }
            });
        } catch (logErr) {
            v2log.warn('WORKER', 'Failed to persist analytics log', { error: logErr });
        }

        try {
            await supabase.from('automation_runs').insert({
                workspace_id: job.workspaceId,
                user_id: job.userId,
                platform: job.platform,
                chat_id: job.chatId,
                incoming_message: job.message,
                buffered_message: job.message,
                state_before: result.stateBefore,
                state_after: result.stateAfter,
                intent: result.debug.intent || null,
                actions: result.actions || [],
                db_write_attempted: result.debug.dbWriteAttempted,
                db_write_success: result.debug.dbWriteSuccess,
                source_path: 'ai/worker',
                error: result.error || null,
                metadata: {
                    requestId: result.debug.requestId,
                    language: result.debug.language,
                    durationMs: result.debug.durationMs,
                },
            });
        } catch (runLogErr) {
            v2log.warn('WORKER', 'Failed to persist automation run', { error: runLogErr });
        }

        // 5. Upsert customer profile (update last_seen)
        await upsertCustomerProfile(
            supabase, job.workspaceId, job.chatId, job.platform,
            { lastInteractionAt: new Date().toISOString() }
        );

        const durationMs = Date.now() - startTime;
        v2log.info('WORKER', 'Job completed', {
            workspaceId: job.workspaceId,
            chatId: job.chatId,
            platform: job.platform,
            durationMs,
            shouldReply: result.shouldReply,
            stateAfter: result.stateAfter,
        });

    } catch (err) {
        const durationMs = Date.now() - startTime;
        v2log.error('WORKER', 'Job processing failed', {
            workspaceId: job.workspaceId,
            chatId: job.chatId,
            platform: job.platform,
            durationMs,
            error: err instanceof Error ? err.message : String(err),
        });
        throw err; // Re-throw so QStash can retry
    }
}

// ── Platform Reply Dispatch ──────────────────────────────────

export async function sendPlatformReply(
    supabase: SupabaseClient,
    job: MessageJob,
    replyText: string
): Promise<void> {
    if (job.platform === 'instagram') {
        await sendInstagramReply(supabase, job, replyText);
    } else if (job.platform === 'whatsapp') {
        await sendWhatsAppReply(supabase, job, replyText);
    }
}

async function sendInstagramReply(
    supabase: SupabaseClient,
    job: MessageJob,
    text: string
): Promise<void> {
    // Load access token from DB
    const { data: integration } = await supabase
        .from('instagram_integrations')
        .select('access_token')
        .eq('workspace_id', job.workspaceId)
        .limit(1)
        .maybeSingle();

    let token = integration?.access_token;

    if (!token) {
        // Fallback to legacy connection
        const { data: legacy } = await supabase
            .from('user_connections')
            .select('metadata')
            .eq('user_id', job.userId)
            .in('provider', ['INSTAGRAM', 'instagram_api_login'])
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

    // Sanitize token
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
    // Load WhatsApp credentials from workspace
    const { data: workspace } = await supabase
        .from('ai_settings')
        .select('whatsapp_access_token, whatsapp_phone_number_id')
        .eq('id', job.workspaceId)
        .maybeSingle();

    let accessToken = workspace?.whatsapp_access_token;
    let phoneNumberId = workspace?.whatsapp_phone_number_id;

    // Fallback to system tokens
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
