/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — V3 Agent: Conversation History
 * ═══════════════════════════════════════════════════════════════
 * Fetches the last N messages from activity_log to give the
 * agent full conversation context.
 *
 * Maps activity_log rows to LLM-friendly message format:
 *   INCOMING_MESSAGE → { role: 'user', content }
 *   AI_REPLY / automation_v2 → { role: 'assistant', content }
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v2log } from './logger';

export interface HistoryMessage {
    role: 'user' | 'assistant';
    content: string;
}

const MAX_HISTORY = 4;

/**
 * Fetch the most recent conversation messages for a specific chat.
 * Returns them in chronological order (oldest first).
 */
export async function loadConversationHistory(
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string,
    chatId: string,
    limit: number = MAX_HISTORY
): Promise<HistoryMessage[]> {
    try {
        const { data, error } = await supabase
            .from('activity_log')
            .select('event_type, description, metadata, timestamp')
            .eq('user_id', userId)
            .eq('workspace_id', workspaceId)
            .or(
                `event_type.eq.INCOMING_MESSAGE,event_type.eq.AI_REPLY,event_type.eq.automation_v2`
            )
            .filter('metadata->>chat_id', 'eq', chatId)
            .order('timestamp', { ascending: false })
            .limit(limit * 2); // Fetch extra to account for non-message events

        if (error) {
            v2log.warn('V3_HISTORY', 'Failed to load conversation history', { error });
            return [];
        }

        if (!data || data.length === 0) return [];

        const messages: HistoryMessage[] = [];

        for (const row of data) {
            if (row.event_type === 'INCOMING_MESSAGE') {
                // User message — extract from metadata or description
                const content = row.metadata?.message || row.metadata?.text || row.description || '';
                if (content) {
                    messages.push({ role: 'user', content });
                }
            } else if (row.event_type === 'AI_REPLY' || row.event_type === 'automation_v2') {
                // Bot reply — extract the actual reply text
                const content = row.metadata?.reply || row.metadata?.message || '';
                if (content) {
                    messages.push({ role: 'assistant', content });
                }
            }

            if (messages.length >= limit) break;
        }

        // Reverse to chronological order (oldest first)
        messages.reverse();

        v2log.info('V3_HISTORY', `Loaded ${messages.length} history messages for chat`, { chatId });
        return messages;

    } catch (err) {
        v2log.warn('V3_HISTORY', 'Exception loading history', { err });
        return [];
    }
}
