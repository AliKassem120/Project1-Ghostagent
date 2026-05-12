/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Session Manager
 * ═══════════════════════════════════════════════════════════════
 * Wraps conversation_states with session-level metadata:
 *   • Session timeout (30 min default — stale sessions reset to idle)
 *   • Loop detection (loopCount, lastBotMessage, stateEnteredAt)
 *   • Fresh session detection (isFreshSession flag)
 *
 * This module solves:
 *   BUG 3 (stale session recovery)
 *   BUG 2 (infinite loops — via loop tracking data)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { ConversationStage, StateData, PostActionContext } from './state/types';
import { loadConversationState, saveConversationState, clearConversationState } from './state/store';
import { v2log } from './logger';

// ── Configuration ────────────────────────────────────────────

const SESSION_TIMEOUT_MINUTES = 30;

// ── Session Context ──────────────────────────────────────────

export interface CustomerProfile {
    name?: string;
    phone?: string;
    email?: string;
    [key: string]: any;
}

export interface SessionContext {
    state: ConversationStage;
    data: StateData | null;
    postContext: PostActionContext | null;
    loopCount: number;
    lastBotMessage: string | null;
    lastInteractionAt: string;    // ISO
    stateEnteredAt: string;       // ISO — when did we enter current state?
    isFreshSession: boolean;
    customerProfile: CustomerProfile | null;
    /** True if the DB query failed — the bot should NOT run transactional flows */
    loadFailed?: boolean;
    loadError?: string;
}

// ── Session Metadata (stored in data JSONB) ──────────────────

interface SessionMetadata {
    loopCount?: number;
    lastBotMessage?: string | null;
    stateEnteredAt?: string;
    lastInteractionAt?: string;
}

// ── Load Session ─────────────────────────────────────────────

/**
 * Load session with timeout + loop tracking.
 * If the session has been inactive for > SESSION_TIMEOUT_MINUTES and
 * is not idle, it gets reset to idle with isFreshSession = true.
 */
export async function loadSession(
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string,
    chatId: string,
    workspaceType: 'appointments' | 'ecommerce' | 'saas_support',
    platform: string = 'instagram',
    timeoutMinutes: number = SESSION_TIMEOUT_MINUTES
): Promise<SessionContext> {
    const loaded = await loadConversationState(supabase, userId, workspaceId, chatId, workspaceType);

    // Propagate load failures
    if (loaded.loadFailed) {
        return {
            state: 'idle',
            data: null,
            postContext: null,
            loopCount: 0,
            lastBotMessage: null,
            lastInteractionAt: new Date().toISOString(),
            stateEnteredAt: new Date().toISOString(),
            isFreshSession: false,
            customerProfile: null,
            loadFailed: true,
            loadError: loaded.loadError,
        };
    }

    const now = new Date();
    const nowISO = now.toISOString();

    // Extract session metadata from the data JSONB
    const rawData = loaded.data as any;
    const meta: SessionMetadata = {
        loopCount: rawData?.loopCount ?? 0,
        lastBotMessage: rawData?.lastBotMessage ?? null,
        stateEnteredAt: rawData?.stateEnteredAt ?? nowISO,
        lastInteractionAt: rawData?.lastInteractionAt ?? rawData?.updated_at ?? nowISO,
    };

    // ── TIMEOUT CHECK ────────────────────────────────────────
    // If we have an active (non-idle) state and the last interaction
    // was more than timeoutMinutes ago, reset to idle.
    if (loaded.stage !== 'idle' && loaded.stage !== 'handoff' && meta.lastInteractionAt) {
        const lastInteraction = new Date(meta.lastInteractionAt);
        const minutesSinceLastInteraction = (now.getTime() - lastInteraction.getTime()) / (1000 * 60);

        if (minutesSinceLastInteraction > timeoutMinutes) {
            v2log.info('SESSION', `Session timeout: ${minutesSinceLastInteraction.toFixed(0)} min since last interaction`, {
                chatId,
                previousStage: loaded.stage,
                lastInteractionAt: meta.lastInteractionAt,
            });

            return {
                state: 'idle',
                data: null,
                postContext: loaded.postContext,  // Preserve post-context for "where is my order?" etc.
                loopCount: 0,
                lastBotMessage: null,
                lastInteractionAt: meta.lastInteractionAt,
                stateEnteredAt: nowISO,
                isFreshSession: true,
                customerProfile: null,
            };
        }
    }

    // ── FRESH SESSION CHECK (was idle before) ────────────────
    const isFresh = loaded.stage === 'idle';

    return {
        state: loaded.stage,
        data: loaded.data,
        postContext: loaded.postContext,
        loopCount: meta.loopCount || 0,
        lastBotMessage: meta.lastBotMessage || null,
        lastInteractionAt: meta.lastInteractionAt || nowISO,
        stateEnteredAt: meta.stateEnteredAt || nowISO,
        isFreshSession: isFresh,
        customerProfile: null,
    };
}

// ── Save Session ─────────────────────────────────────────────

/**
 * Save session state with metadata.
 * Injects loopCount, lastBotMessage, stateEnteredAt, and
 * lastInteractionAt into the data JSONB.
 */
export async function saveSession(
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string,
    chatId: string,
    workspaceType: 'appointments' | 'ecommerce' | 'saas_support',
    session: SessionContext,
    platform: string = 'instagram'
): Promise<void> {
    const nowISO = new Date().toISOString();

    if (session.state === 'idle') {
        // Clear to idle but preserve postContext and session metadata
        await clearConversationState(
            supabase,
            userId,
            workspaceId,
            chatId,
            workspaceType,
            session.postContext,
            platform
        );
        return;
    }

    // Inject session metadata into the data JSONB
    const dataWithMeta = {
        ...(session.data || {}),
        loopCount: session.loopCount,
        lastBotMessage: session.lastBotMessage,
        stateEnteredAt: session.stateEnteredAt,
        postContext: session.postContext,
        lastInteractionAt: nowISO,
    };

    await saveConversationState(
        supabase,
        userId,
        workspaceId,
        chatId,
        workspaceType,
        session.state,
        dataWithMeta as any,
        platform
    );
}

// ── Update Loop Count ────────────────────────────────────────

/**
 * Update loop tracking after FSM returns a result.
 * - If the state stayed the same → increment loopCount
 * - If the state changed → reset loopCount to 0
 * - If the bot reply is identical to lastBotMessage → increment loopCount
 */
export function updateLoopTracking(
    session: SessionContext,
    nextStage: ConversationStage,
    botReply: string | null
): SessionContext {
    const stateChanged = nextStage !== session.state;
    const nowISO = new Date().toISOString();

    if (stateChanged) {
        // New state → reset loop counter
        return {
            ...session,
            state: nextStage,
            loopCount: 0,
            lastBotMessage: botReply,
            stateEnteredAt: nowISO,
            lastInteractionAt: nowISO,
        };
    }

    // Same state → check if bot reply is identical
    const isRepeatedReply = botReply && session.lastBotMessage && botReply === session.lastBotMessage;

    return {
        ...session,
        loopCount: session.loopCount + 1,
        lastBotMessage: botReply,
        lastInteractionAt: nowISO,
        // If the reply is identical, we definitely want to count this as a loop
        ...(isRepeatedReply ? {} : {}),
    };
}

// ── Greeting Detection ───────────────────────────────────────

const GREETING_PATTERNS = [
    // English
    /^(hi|hey|hello|yo|sup|hii+|heyy+|helloo+|good\s*(morning|afternoon|evening)|gm|gn)\s*[!.?]*$/i,
    // Arabic
    /^(مرحبا|مرحب|سلام|هلا|اهلا|اهلين|السلام عليكم)\s*[!.?]*$/i,
    // Arabizi
    /^(salam|marhaba|hala|kifak|kifik|kifkon|ahla|ahlein|hi+|heyy*)\s*[!.?]*$/i,
    // French
    /^(bonjour|bonsoir|salut|coucou)\s*[!.?]*$/i,
    // Spanish
    /^(hola|buenos?\s*(dias|tardes|noches))\s*[!.?]*$/i,
];

/**
 * Detect if a message is a pure greeting (no other content).
 */
export function isGreeting(message: string): boolean {
    const trimmed = message.trim();
    return GREETING_PATTERNS.some(p => p.test(trimmed));
}

// ── Session Timeout Check ────────────────────────────────────

/**
 * Check if a session has timed out based on lastInteractionAt.
 */
export function isSessionTimedOut(
    lastInteractionAt: string,
    timeoutMinutes: number = SESSION_TIMEOUT_MINUTES
): boolean {
    const last = new Date(lastInteractionAt);
    const now = new Date();
    const minutesSince = (now.getTime() - last.getTime()) / (1000 * 60);
    return minutesSince > timeoutMinutes;
}
