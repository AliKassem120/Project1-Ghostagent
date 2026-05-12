/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Dead Letter Queue Handler
 * ═══════════════════════════════════════════════════════════════
 * Receives jobs that failed after 3 QStash retries.
 *
 * Actions:
 *   1. Log the failure with full context
 *   2. Insert into handoff_queue with status 'failed' for visibility
 *   3. Return 200 so QStash stops retrying
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { MessageJob } from '@/lib/automation-v3/queue';

// ── POST Handler ─────────────────────────────────────────────

export async function POST(req: Request) {
    let body: any;
    try {
        body = await req.json();
    } catch {
        console.error('❌ [Dead Letter] Failed to parse body');
        return NextResponse.json({ received: true }, { status: 200 });
    }

    const job = body as Partial<MessageJob>;

    console.error('💀 [Dead Letter] Job permanently failed after retries', {
        workspaceId: job.workspaceId,
        chatId: job.chatId,
        platform: job.platform,
        message: job.message?.slice(0, 100),
        receivedAt: job.receivedAt,
    });

    // Persist failure to failed_jobs (keeps handoff_queue clean for human agents)
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
        );

        await supabase.from('failed_jobs').insert({
            job_payload: job as any,
            error: `Dead letter: message processing failed after 3 QStash retries. Original message: "${job.message?.slice(0, 200) || 'N/A'}"`,
            retry_count: 3,
            status: 'dead_letter',
        });

        console.log('💀 [Dead Letter] Logged to failed_jobs for review');
    } catch (dbErr) {
        console.error('❌ [Dead Letter] Failed to persist to failed_jobs:', dbErr);
    }

    // Always return 200 so QStash stops retrying
    return NextResponse.json({
        received: true,
        action: 'logged_for_manual_review',
    }, { status: 200 });
}
