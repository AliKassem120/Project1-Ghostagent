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

// Simple in-memory store (per-process). Cleared on deploy.
// In production with multiple workers, use Redis instead.
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

    // ── In-memory burst + duplicate check ────────────────────
    let tracker = chatTrackers.get(key);
    if (!tracker) {
        tracker = { messages: [], lastChecked: now };
        // Evict oldest if too many trackers
        if (chatTrackers.size >= MAX_TRACKER_SIZE) {
            const oldest = [...chatTrackers.entries()]
                .sort((a, b) => a[1].lastChecked - b[1].lastChecked)[0];
            if (oldest) chatTrackers.delete(oldest[0]);
        }
        chatTrackers.set(key, tracker);
    }

    // Add current message
    tracker.messages.push({ text: message.trim().toLowerCase(), timestamp: now });
    tracker.lastChecked = now;

    // Clean old messages (older than burst window)
    tracker.messages = tracker.messages.filter(m => now - m.timestamp < BURST_WINDOW_MS);

    // Burst check: too many messages in window
    if (tracker.messages.length > BURST_LIMIT) {
        v2log.warn('RATE_LIMIT', `Burst detected: ${tracker.messages.length} msgs in ${BURST_WINDOW_MS}ms`, {
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
    const duplicateCount = tracker.messages.filter(m => m.text === normalizedMsg).length;
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
