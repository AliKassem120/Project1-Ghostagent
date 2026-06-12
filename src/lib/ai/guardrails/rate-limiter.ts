/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Rate Limiter
 * ═══════════════════════════════════════════════════════════════
 * Guardrail that detects and blocks:
 *   • Duplicate messages (same text 3x)
 *   • Burst detection (>5 messages in 60s)
 *   • Suspended users (manual block from dashboard)
 *
 * Uses in-memory LRU for fast checks, backed by DB for
 * suspended users.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v2log } from '../logger';

// ── Rate Limit Result ────────────────────────────────────────

export interface RateLimitResult {
    allowed: boolean;
    reason?: 'burst' | 'duplicate' | 'suspended' | 'blocked_word';
    /** Reply to send if blocked (null = silent block) */
    replyText?: string | null;
}

// ── In-Memory Tracking ──────────────────────────────────────

interface ChatTracker {
    messages: Array<{ text: string; timestamp: number }>;
    lastChecked: number;
}

// ── In-Memory Tracking ──────────────────────────────────────
// DEPRECATED: Burst/duplicate detection is now fully DB-backed
// using the automation_runs table. In-memory Map is vestigial —
// kept only for test compatibility via clearTrackers().
// In production with multiple workers, only the DB path is used.
const chatTrackers = new Map<string, ChatTracker>();

const MAX_TRACKER_SIZE = 1000; // Evict oldest after this many chats
const BURST_WINDOW_MS = 60_000; // 60 seconds
const BURST_LIMIT = 5;
const DUPLICATE_THRESHOLD = 3;

// ── Blocked Words ────────────────────────────────────────────

const BLOCKED_WORDS = [
    // Harassment patterns (keep this list small and obvious)
    /\b(fuck\s*you|kill\s*yourself|kys|die|rape)\b/i,
];

// ── Check Rate Limit ─────────────────────────────────────────

/**
 * Check if a message should be rate-limited.
 * Fast path: in-memory checks for burst/duplicate.
 * Slow path: DB check for suspended users (cached per session).
 */
export async function checkRateLimit(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string,
    message: string,
    language: string = 'english'
): Promise<RateLimitResult> {
    const key = `${workspaceId}:${chatId}`;
    const now = Date.now();

    // ── Blocked words check ──────────────────────────────────
    for (const pattern of BLOCKED_WORDS) {
        if (pattern.test(message)) {
            v2log.warn('RATE_LIMIT', 'Blocked word detected', { chatId, workspaceId });
            return {
                allowed: false,
                reason: 'blocked_word',
                replyText: null, // Silent block
            };
        }
    }

    // ── Distributed DB-backed burst + duplicate check ───────
    let recentRuns: any[] = [];
    try {
        const sixtySecondsAgo = new Date(now - BURST_WINDOW_MS).toISOString();
        const { data, error } = await supabase
            .from('automation_runs')
            .select('incoming_message, created_at')
            .eq('workspace_id', workspaceId)
            .eq('chat_id', chatId)
            .gte('created_at', sixtySecondsAgo)
            .order('created_at', { ascending: false });

        if (!error && data) {
            recentRuns = data;
        }
    } catch (dbErr) {
        v2log.warn('RATE_LIMIT', 'Failed to fetch automation runs from DB, failing open', { error: dbErr });
    }

    // Burst check: too many messages in window
    // Since the current message hasn't been logged to DB yet, we rate limit if prior runs >= BURST_LIMIT
    if (recentRuns.length >= BURST_LIMIT) {
        v2log.warn('RATE_LIMIT', `Burst detected: ${recentRuns.length + 1} msgs in ${BURST_WINDOW_MS}ms`, {
            chatId, workspaceId,
        });
        const isArabizi = language === 'arabizi' || language === 'arabic' || language === 'mixed';
        return {
            allowed: false,
            reason: 'burst',
            replyText: isArabizi
                ? 'Inta m3ajjal ktir. Stanna shway.'
                : "You're sending messages too fast. Please wait a moment.",
        };
    }

    // Duplicate check: same message 3+ times
    const normalizedMsg = message.trim().toLowerCase();
    const duplicateCount = recentRuns.filter(r => (r.incoming_message || '').trim().toLowerCase() === normalizedMsg).length + 1; // +1 for current
    if (duplicateCount >= DUPLICATE_THRESHOLD) {
        v2log.warn('RATE_LIMIT', `Duplicate detected: "${normalizedMsg}" x${duplicateCount}`, {
            chatId, workspaceId,
        });
        const isArabizi = language === 'arabizi' || language === 'arabic' || language === 'mixed';
        return {
            allowed: false,
            reason: 'duplicate',
            replyText: isArabizi
                ? 'Wasaltne hal message. Kif fiyi se3dak?'
                : "I've already received this message. How can I help?",
        };
    }

    // ── Suspended user check (DB, cached) ────────────────────
    // Only check every 5 minutes to avoid hammering the DB
    const suspendedCacheKey = `suspended:${key}`;
    const cachedSuspended = suspendedUserCache.get(suspendedCacheKey);
    if (cachedSuspended !== undefined && now - (cachedSuspended.checkedAt || 0) < 300_000) {
        if (cachedSuspended.suspended) {
            return { allowed: false, reason: 'suspended', replyText: null };
        }
    } else {
        // Check DB
        try {
            const { data } = await supabase
                .from('suspended_users')
                .select('id')
                .eq('workspace_id', workspaceId)
                .eq('chat_id', chatId)
                .eq('is_active', true)
                .maybeSingle();

            const isSuspended = !!data;
            suspendedUserCache.set(suspendedCacheKey, { suspended: isSuspended, checkedAt: now });

            if (isSuspended) {
                v2log.info('RATE_LIMIT', 'Suspended user blocked', { chatId, workspaceId });
                return { allowed: false, reason: 'suspended', replyText: null };
            }
        } catch {
            // DB check failed — allow through (fail open)
        }
    }

    return { allowed: true };
}

// ── Suspended User Cache ─────────────────────────────────────

const suspendedUserCache = new Map<string, { suspended: boolean; checkedAt: number }>();

// ── Clear Tracker (for testing) ──────────────────────────────

export function clearTrackers(): void {
    chatTrackers.clear();
    suspendedUserCache.clear();
}
