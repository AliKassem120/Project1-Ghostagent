/**
 * ═══════════════════════════════════════════════════════════════
 * God Mode — Bot Control Flags
 * ═══════════════════════════════════════════════════════════════
 * Shared helper checked by Instagram/WhatsApp webhook send paths.
 * Reads from bot_control_flags table (global → workspace → chat).
 *
 * Usage in webhook:
 *   const decision = await getBotControlDecision(supabase, { workspaceId, chatId, channel: 'instagram', type: 'dm' });
 *   if (decision.paused) { return; }
 *   if (decision.forceDraft) { return draft(); }
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface BotControlDecision {
    paused: boolean;
    forceDraft: boolean;
    disableExternalSends: boolean;
    reason: string | null;
}

interface BotControlInput {
    workspaceId?: string;
    chatId?: string;
    channel?: 'instagram' | 'whatsapp';
    type?: 'dm' | 'comment';
}

/**
 * Check bot_control_flags for the most specific matching rule.
 * Priority: chat > workspace > global.
 * Returns a merged decision.
 */
export async function getBotControlDecision(
    supabase: SupabaseClient,
    input: BotControlInput
): Promise<BotControlDecision> {
    const result: BotControlDecision = {
        paused: false,
        forceDraft: false,
        disableExternalSends: false,
        reason: null,
    };

    try {
        const { data: flags, error } = await supabase
            .from('bot_control_flags')
            .select('*')
            .order('scope', { ascending: true }); // global first, then chat, workspace

        if (error || !flags || flags.length === 0) return result;

        for (const flag of flags) {
            let applies = false;

            if (flag.scope === 'global') {
                applies = true;
            } else if (flag.scope === 'workspace' && input.workspaceId && flag.workspace_id === input.workspaceId) {
                applies = true;
            } else if (flag.scope === 'chat' && input.chatId && flag.chat_id === input.chatId) {
                applies = true;
            }

            if (!applies) continue;

            // Check type-specific pauses
            if (input.type === 'dm' && flag.pause_dms) {
                result.paused = true;
                result.reason = flag.reason || `Paused by ${flag.scope} flag`;
            }
            if (input.type === 'comment' && flag.pause_comments) {
                result.paused = true;
                result.reason = flag.reason || `Paused by ${flag.scope} flag`;
            }
            // If no type specified but DMs or comments paused, treat as paused
            if (!input.type && (flag.pause_dms || flag.pause_comments)) {
                result.paused = true;
                result.reason = flag.reason || `Paused by ${flag.scope} flag`;
            }

            if (flag.force_draft) {
                result.forceDraft = true;
                result.reason = result.reason || flag.reason || `Force draft by ${flag.scope} flag`;
            }
            if (flag.disable_external_sends) {
                result.disableExternalSends = true;
                result.reason = result.reason || flag.reason || `External sends disabled by ${flag.scope} flag`;
            }
        }
    } catch (err) {
        // Fail open — if we can't check flags, don't block
        console.error('[BOT_CONTROLS] Error checking flags:', err);
    }

    return result;
}

// ── Convenience helpers ─────────────────────────────────────

export async function shouldPauseDm(supabase: SupabaseClient, workspaceId?: string, chatId?: string): Promise<boolean> {
    const d = await getBotControlDecision(supabase, { workspaceId, chatId, type: 'dm' });
    return d.paused;
}

export async function shouldPauseComments(supabase: SupabaseClient, workspaceId?: string): Promise<boolean> {
    const d = await getBotControlDecision(supabase, { workspaceId, type: 'comment' });
    return d.paused;
}

export async function shouldForceDraft(supabase: SupabaseClient, workspaceId?: string, chatId?: string): Promise<boolean> {
    const d = await getBotControlDecision(supabase, { workspaceId, chatId });
    return d.forceDraft;
}

export async function shouldDisableExternalSends(supabase: SupabaseClient, workspaceId?: string): Promise<boolean> {
    const d = await getBotControlDecision(supabase, { workspaceId });
    return d.disableExternalSends;
}
