/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Message Queue (QStash + Local Fallback)
 * ═══════════════════════════════════════════════════════════════
 * Enqueues incoming webhook messages for asynchronous processing.
 *
 * Production: publishes to QStash REST API → worker endpoint
 * Development: fire-and-forget via setImmediate → inline worker
 *
 * QStash retry policy: 3 retries with exponential backoff.
 * Dead letter endpoint receives permanently failed jobs.
 */

// ── Job Payload ──────────────────────────────────────────────

export interface MessageJob {
    workspaceId: string;
    chatId: string;
    userId: string;
    message: string;
    platform: 'instagram' | 'whatsapp';
    workspaceType: 'ecommerce' | 'appointments' ;
    receivedAt: number;
    webhookPayload: any;
}

// ── QStash Configuration ─────────────────────────────────────

const QSTASH_PUBLISH_URL = 'https://qstash.upstash.io/v2/publish/';

function getQStashToken(): string | undefined {
    return process.env.QSTASH_TOKEN;
}

function getWorkerUrl(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';
    return `${base}/api/worker/process`;
}

function getDeadLetterUrl(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';
    return `${base}/api/worker/dead-letter`;
}

// ── Enqueue Message ──────────────────────────────────────────

/**
 * Enqueue a message job for asynchronous processing.
 *
 * If QSTASH_TOKEN is set → publishes to QStash REST API.
 * Otherwise → uses setImmediate for fire-and-forget local processing.
 *
 * Returns immediately in both cases — never blocks the caller.
 */
export async function enqueueMessage(job: MessageJob): Promise<void> {
    const token = getQStashToken();

    if (token) {
        await enqueueViaQStash(job, token);
    } else {
        enqueueLocal(job);
    }
}

// ── QStash Publisher ─────────────────────────────────────────

async function enqueueViaQStash(job: MessageJob, token: string): Promise<void> {
    const workerUrl = getWorkerUrl();
    const deadLetterUrl = getDeadLetterUrl();

    try {
        const response = await fetch(`${QSTASH_PUBLISH_URL}${workerUrl}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Upstash-Retries': '3',
                'Upstash-Dead-Letter-Queue-Url': deadLetterUrl,
                'Upstash-Forward-Content-Type': 'application/json',
            },
            body: JSON.stringify(job),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ [Queue] QStash publish failed (${response.status}):`, errorText);
            // Fall back to local processing if QStash fails
            enqueueLocal(job);
            return;
        }

        const result = await response.json();
        console.log(`📤 [Queue] Published to QStash: messageId=${result.messageId}`, {
            workspaceId: job.workspaceId,
            chatId: job.chatId,
            platform: job.platform,
        });
    } catch (error) {
        console.error('❌ [Queue] QStash publish exception:', error);
        // Fall back to local processing on network error
        enqueueLocal(job);
    }
}

// ── Local Fallback (Development / No QStash) ─────────────────

async function enqueueLocal(job: MessageJob): Promise<void> {
    console.log(`📤 [Queue] Local fallback: processing synchronously`, {
        workspaceId: job.workspaceId,
        chatId: job.chatId,
        platform: job.platform,
    });

    // Process synchronously — setImmediate is killed when Vercel
    // returns the response, so we must await inline.
    try {
        const { processMessageJob } = await import('./worker');
        await processMessageJob(job);
    } catch (err) {
        console.error('❌ [Queue] Local processing failed:', err);
    }
}

// ── Deduplication Helper (DB-backed) ─────────────────────────

import { createClient } from '@supabase/supabase-js';

/**
 * Returns true if this message was already seen within the dedup window.
 * Uses Supabase `message_dedup` table with PK constraint for distributed
 * consistency across serverless instances.
 */
export async function isDuplicate(chatId: string, message: string, timestamp: number): Promise<boolean> {
    const key = `${chatId}:${hashMessage(message)}:${Math.floor(timestamp / 60000)}`;

    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
        );

        const { error } = await supabase
            .from('message_dedup')
            .insert({ id: key });

        if (error) {
            // Unique constraint violation = duplicate
            if (error.code === '23505') return true;
            // On any other DB error, fall through (don't block messages)
            console.warn('⚠️ [Dedup] DB check failed, allowing message:', error.message);
            return false;
        }

        return false;
    } catch {
        // If DB is unreachable, allow the message through
        return false;
    }
}

function hashMessage(message: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < message.length; i++) {
        h ^= message.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
}
