/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Replay Evaluation Script
 * ═══════════════════════════════════════════════════════════════
 * 
 * Replays past activity_log conversations through the new brain
 * WITHOUT sending real messages. Compares old reply vs new reply.
 *
 * Usage:
 *   npx ts-node scripts/replay-brain.ts --workspace <id> --chat <id>
 *
 * Output: Table of old_reply | new_reply | state | intent | actions | would_send
 */

import { createClient } from '@supabase/supabase-js';
import { classifyByRegex } from '../src/lib/automation-v2/classify/regex-fallbacks';
import { classifyPostContext } from '../src/lib/automation-v2/classify/post-context-classifier';
import { shouldReplyToMessage } from '../src/lib/automation-v2/should-reply';
import { detectLanguage } from '../src/lib/automation-v2/language';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface ReplayRow {
    originalMessage: string;
    originalReply: string | null;
    newIntent: string;
    newPostContext: string;
    gateResult: string;
    wouldSend: boolean;
    language: string;
}

async function main() {
    const args = process.argv.slice(2);
    const workspaceIdx = args.indexOf('--workspace');
    const chatIdx = args.indexOf('--chat');

    if (workspaceIdx === -1) {
        console.error('Usage: npx ts-node scripts/replay-brain.ts --workspace <id> [--chat <id>]');
        process.exit(1);
    }

    const workspaceId = args[workspaceIdx + 1];
    const chatId = chatIdx !== -1 ? args[chatIdx + 1] : null;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Load activity logs
    let query = supabase
        .from('activity_log')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('timestamp', { ascending: true })
        .limit(200);

    if (chatId) {
        query = query.or(`metadata->>chat_id.eq.${chatId},metadata->>chatId.eq.${chatId}`);
    }

    const { data: logs, error } = await query;

    if (error || !logs || logs.length === 0) {
        console.error('No logs found', error);
        process.exit(1);
    }

    console.log(`\nReplaying ${logs.length} messages for workspace ${workspaceId}\n`);
    console.log('─'.repeat(120));
    console.log(
        padRight('Message', 30) +
        padRight('Old Reply', 30) +
        padRight('Intent', 20) +
        padRight('PostCtx', 15) +
        padRight('Gate', 15) +
        padRight('Send?', 5)
    );
    console.log('─'.repeat(120));

    const results: ReplayRow[] = [];

    for (const log of logs) {
        const msg = log.metadata?.message || log.description || '';
        const oldReply = log.metadata?.reply || null;

        if (!msg || typeof msg !== 'string') continue;

        // 1. Should-reply gate
        const gate = shouldReplyToMessage(msg);

        // 2. Classify intent
        const intentResult = classifyByRegex(msg);
        const intent = intentResult?.intent || 'unknown';

        // 3. Post-context check
        const pcResult = classifyPostContext(msg);

        // 4. Language
        const lang = detectLanguage(msg);

        const row: ReplayRow = {
            originalMessage: msg.slice(0, 28),
            originalReply: oldReply?.slice(0, 28) || '—',
            newIntent: intent,
            newPostContext: pcResult.intent !== 'unrelated' ? pcResult.intent : '—',
            gateResult: gate.reason,
            wouldSend: gate.shouldReply,
            language: lang,
        };
        results.push(row);

        console.log(
            padRight(row.originalMessage, 30) +
            padRight(row.originalReply || '—', 30) +
            padRight(row.newIntent, 20) +
            padRight(row.newPostContext, 15) +
            padRight(row.gateResult, 15) +
            padRight(row.wouldSend ? '✅' : '❌', 5)
        );
    }

    console.log('─'.repeat(120));
    console.log(`\nTotal: ${results.length} messages replayed`);
    console.log(`Would send: ${results.filter(r => r.wouldSend).length}`);
    console.log(`Would skip: ${results.filter(r => !r.wouldSend).length}`);
}

function padRight(s: string, len: number): string {
    return (s || '').slice(0, len).padEnd(len);
}

main().catch(console.error);
