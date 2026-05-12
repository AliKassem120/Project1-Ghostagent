/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Worker Process Endpoint
 * ═══════════════════════════════════════════════════════════════
 * Receives queued message jobs from QStash and processes them.
 *
 * Security: Verifies QStash signature via HMAC before processing.
 * If QSTASH_CURRENT_SIGNING_KEY is not set, allows local dev calls.
 */

import { NextResponse } from 'next/server';
import { processMessageJob } from '@/lib/automation-v3/worker';
import type { MessageJob } from '@/lib/automation-v3/queue';
import crypto from 'crypto';

// Extend Vercel function timeout for AI processing
export const maxDuration = 60;

// ── QStash Signature Verification ────────────────────────────

function verifyQStashSignature(rawBody: string, req: Request): boolean {
    const signingKey = process.env.QSTASH_CURRENT_SIGNING_KEY;

    // Local dev: no signing key → allow all requests
    if (!signingKey) {
        console.warn('⚠️ [Worker] QSTASH_CURRENT_SIGNING_KEY not set — skipping signature check (dev mode)');
        return true;
    }

    const upstashSignature = req.headers.get('upstash-signature');
    if (!upstashSignature) {
        console.error('❌ [Worker] Missing upstash-signature header');
        return false;
    }

    try {
        // QStash signs with JWT — verify the body hash claim
        // For simplicity, we verify the HMAC of the body using the signing key
        const parts = upstashSignature.split('.');
        if (parts.length !== 3) {
            console.error('❌ [Worker] Invalid JWT format in upstash-signature');
            return false;
        }

        // Decode the payload to verify the body hash
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        const expectedBodyHash = crypto
            .createHash('sha256')
            .update(rawBody)
            .digest('base64url');

        if (payload.body !== expectedBodyHash) {
            console.error('❌ [Worker] Body hash mismatch');
            return false;
        }

        // Verify the JWT signature using the signing key
        const signatureInput = `${parts[0]}.${parts[1]}`;
        const expectedSig = crypto
            .createHmac('sha256', signingKey)
            .update(signatureInput)
            .digest('base64url');

        if (expectedSig !== parts[2]) {
            // Try the next signing key (rotation support)
            const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
            if (nextKey) {
                const nextSig = crypto
                    .createHmac('sha256', nextKey)
                    .update(signatureInput)
                    .digest('base64url');
                if (nextSig === parts[2]) return true;
            }
            console.error('❌ [Worker] JWT signature verification failed');
            return false;
        }

        return true;
    } catch (err) {
        console.error('❌ [Worker] Signature verification exception:', err);
        return false;
    }
}

// ── POST Handler ─────────────────────────────────────────────

export async function POST(req: Request) {
    const startTime = Date.now();

    // 1. Read raw body
    let rawBody: string;
    try {
        rawBody = await req.text();
    } catch {
        return NextResponse.json({ error: 'body_read_failed' }, { status: 400 });
    }

    // 2. Verify QStash signature
    if (!verifyQStashSignature(rawBody, req)) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // 3. Parse job payload
    let job: MessageJob;
    try {
        job = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    // 4. Validate required fields
    if (!job.workspaceId || !job.chatId || !job.message || !job.platform) {
        return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    // 5. Process the message job
    try {
        await processMessageJob(job);

        // Flush any buffered metrics before Vercel kills the function
        const { flushMetrics } = await import('@/lib/automation-v2/metrics');
        await flushMetrics();

        const durationMs = Date.now() - startTime;
        console.log(`✅ [Worker] Job processed in ${durationMs}ms`, {
            workspaceId: job.workspaceId,
            chatId: job.chatId,
            platform: job.platform,
        });

        return NextResponse.json({
            processed: true,
            durationMs,
        }, { status: 200 });

    } catch (err) {
        // Flush metrics even on failure
        try {
            const { flushMetrics } = await import('@/lib/automation-v2/metrics');
            await flushMetrics();
        } catch { /* best effort */ }

        const durationMs = Date.now() - startTime;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`❌ [Worker] Job failed in ${durationMs}ms:`, errMsg);

        // ── SMART RETRY LOGIC ────────────────────────────────
        // Only retry on transient errors (network, timeout, rate limit).
        // Permanent errors (bad data, missing config) → log to failed_jobs
        // and return 200 so QStash stops wasting retry budget.
        const isRetryable = /timeout|etimedout|econnreset|rate.?limit|network|fetch.?failed|socket/i.test(errMsg);

        if (isRetryable) {
            return NextResponse.json({
                processed: false,
                error: errMsg,
                retryable: true,
                durationMs,
            }, { status: 500 });
        }

        // Permanent failure — log to failed_jobs, stop retries
        try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
            );
            await supabase.from('failed_jobs').insert({
                job_payload: job as any,
                error: errMsg,
                retry_count: 0,
                status: 'permanent_failure',
            });
        } catch (dbErr) {
            console.error('❌ [Worker] Failed to persist to failed_jobs:', dbErr);
        }

        return NextResponse.json({
            processed: false,
            error: errMsg,
            retryable: false,
            durationMs,
        }, { status: 200 }); // 200 = QStash stops retrying
    }
}
