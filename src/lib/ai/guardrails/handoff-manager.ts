/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Handoff Manager
 * ═══════════════════════════════════════════════════════════════
 * Creates handoff entries with full conversation context.
 * Stores in handoff_queue table for dashboard consumption.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v2log } from '../logger';

// ── Handoff Entry ────────────────────────────────────────────

export interface HandoffEntry {
    workspaceId: string;
    chatId: string;
    platform: 'instagram' | 'whatsapp';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    reason: string;
    /** Brief summary of the conversation context */
    conversationSummary?: string;
    /** Customer details if known */
    customerName?: string;
    customerPhone?: string;
    /** Recent messages (last 5) */
    recentMessages?: Array<{ role: string; content: string; timestamp?: string }>;
    /** Current FSM state when handoff triggered */
    currentState?: string;
    /** Actions taken before handoff */
    actionsTaken?: string[];
}

// ── Create Handoff ───────────────────────────────────────────

/**
 * Create a handoff entry in the queue.
 * Non-blocking — failures are logged but don't break the flow.
 */
export async function createHandoff(
    supabase: SupabaseClient,
    entry: HandoffEntry
): Promise<{ success: boolean; handoffId?: string }> {
    try {
        const { data, error } = await supabase
            .from('handoff_queue')
            .insert({
                workspace_id: entry.workspaceId,
                chat_id: entry.chatId,
                platform: entry.platform,
                priority: entry.priority,
                reason: entry.reason,
                conversation_summary: entry.conversationSummary,
                customer_name: entry.customerName,
                customer_phone: entry.customerPhone,
                recent_messages: entry.recentMessages,
                current_state: entry.currentState,
                actions_taken: entry.actionsTaken,
                status: 'pending',
            })
            .select('id')
            .single();

        if (error) {
            v2log.error('HANDOFF', 'Failed to create handoff', { error: error.message });
            return { success: false };
        }

        v2log.info('HANDOFF', `Handoff created: ${data.id}`, {
            workspaceId: entry.workspaceId,
            chatId: entry.chatId,
            priority: entry.priority,
            reason: entry.reason,
        });

        return { success: true, handoffId: data.id };
    } catch (err: any) {
        v2log.error('HANDOFF', 'Handoff creation failed', { error: err.message });
        return { success: false };
    }
}

// ── Resolve Handoff ──────────────────────────────────────────

/**
 * Mark a handoff as resolved.
 */
export async function resolveHandoff(
    supabase: SupabaseClient,
    handoffId: string,
    resolvedBy?: string
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('handoff_queue')
            .update({
                status: 'resolved',
                resolved_at: new Date().toISOString(),
                resolved_by: resolvedBy,
            })
            .eq('id', handoffId);

        return !error;
    } catch {
        return false;
    }
}

// ── Determine Priority ───────────────────────────────────────

/**
 * Determine handoff priority based on context.
 */
export function determineHandoffPriority(
    reason: string,
    loopCount: number = 0,
    hasActiveOrder: boolean = false
): 'low' | 'medium' | 'high' | 'urgent' {
    // Urgent: frustration or explicit request with active transaction
    if (hasActiveOrder && (reason === 'frustration_stop' || reason === 'human_handoff')) {
        return 'urgent';
    }

    // High: frustration or loop detection with high count
    if (reason === 'frustration_stop' || loopCount >= 5) {
        return 'high';
    }

    // Medium: explicit handoff request or loop detected
    if (reason === 'human_handoff' || reason === 'loop_detected') {
        return 'medium';
    }

    // Low: everything else
    return 'low';
}
