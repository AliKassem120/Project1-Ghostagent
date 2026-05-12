/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Data Retention Purge Cron
 * ═══════════════════════════════════════════════════════════════
 * Runs weekly (Sunday midnight) to delete stale data.
 *
 * Retention windows:
 *   - conversation_states: 90 days
 *   - automation_runs: 90 days
 *   - handoff_queue (resolved): 30 days
 *   - metrics: 90 days
 *
 * Security: Requires Authorization: Bearer ${CRON_SECRET} header.
 * Vercel Cron calls this via vercel.json schedule.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── GET Handler (Vercel Cron uses GET) ───────────────────────

export async function GET(req: Request) {
    // 1. Verify authorization
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
        if (authHeader !== `Bearer ${cronSecret}`) {
            console.error('❌ [Purge] Unauthorized cron request');
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }
    } else {
        console.warn('⚠️ [Purge] CRON_SECRET not set — allowing request (dev mode)');
    }

    const startTime = Date.now();
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
    );

    const counts: Record<string, number> = {};

    // 2. Purge conversation_states older than 90 days
    try {
        const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

        const { count: statesCount } = await supabase
            .from('conversation_states')
            .delete({ count: 'exact' })
            .lt('updated_at', cutoff90);

        counts.conversation_states = statesCount || 0;
        console.log(`🗑️ [Purge] conversation_states: ${counts.conversation_states} rows deleted`);
    } catch (err) {
        console.error('❌ [Purge] conversation_states failed:', err);
        counts.conversation_states = -1;
    }

    // 3. Purge automation_runs older than 90 days
    try {
        const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

        const { count: runsCount } = await supabase
            .from('automation_runs')
            .delete({ count: 'exact' })
            .lt('created_at', cutoff90);

        counts.automation_runs = runsCount || 0;
        console.log(`🗑️ [Purge] automation_runs: ${counts.automation_runs} rows deleted`);
    } catch (err) {
        console.error('❌ [Purge] automation_runs failed:', err);
        counts.automation_runs = -1;
    }

    // 4. Purge resolved handoff_queue entries older than 30 days
    try {
        const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const { count: handoffCount } = await supabase
            .from('handoff_queue')
            .delete({ count: 'exact' })
            .eq('status', 'resolved')
            .lt('created_at', cutoff30);

        counts.handoff_queue = handoffCount || 0;
        console.log(`🗑️ [Purge] handoff_queue (resolved): ${counts.handoff_queue} rows deleted`);
    } catch (err) {
        console.error('❌ [Purge] handoff_queue failed:', err);
        counts.handoff_queue = -1;
    }

    // 5. Purge metrics older than 90 days
    try {
        const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

        const { count: metricsCount } = await supabase
            .from('metrics')
            .delete({ count: 'exact' })
            .lt('created_at', cutoff90);

        counts.metrics = metricsCount || 0;
        console.log(`🗑️ [Purge] metrics: ${counts.metrics} rows deleted`);
    } catch (err) {
        console.error('❌ [Purge] metrics failed:', err);
        counts.metrics = -1;
    }

    // 6. Purge message_dedup older than 5 minutes (high-frequency, short-lived)
    try {
        const cutoff5m = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        const { count: dedupCount } = await supabase
            .from('message_dedup')
            .delete({ count: 'exact' })
            .lt('created_at', cutoff5m);

        counts.message_dedup = dedupCount || 0;
        console.log(`🗑️ [Purge] message_dedup: ${counts.message_dedup} rows deleted`);
    } catch (err) {
        console.error('❌ [Purge] message_dedup failed:', err);
        counts.message_dedup = -1;
    }

    // 7. Purge failed_jobs older than 90 days
    try {
        const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

        const { count: failedCount } = await supabase
            .from('failed_jobs')
            .delete({ count: 'exact' })
            .lt('created_at', cutoff90);

        counts.failed_jobs = failedCount || 0;
        console.log(`🗑️ [Purge] failed_jobs: ${counts.failed_jobs} rows deleted`);
    } catch (err) {
        console.error('❌ [Purge] failed_jobs failed:', err);
        counts.failed_jobs = -1;
    }

    const durationMs = Date.now() - startTime;

    console.log(`✅ [Purge] Complete in ${durationMs}ms`, counts);

    return NextResponse.json({
        purged: true,
        counts,
        durationMs,
        timestamp: new Date().toISOString(),
    }, { status: 200 });
}
