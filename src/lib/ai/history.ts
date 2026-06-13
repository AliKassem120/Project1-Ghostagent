/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Conversation History
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

const MAX_HISTORY = 8;

/**
 * Fetch the most recent conversation messages for a specific chat,
 * scoped to the current session boundary (sessionStartedAt).
 * Returns them in chronological order (oldest first).
 */
export async function loadConversationHistory(
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string,
    chatId: string,
    limit: number = MAX_HISTORY,
    sessionStartedAt?: string
): Promise<HistoryMessage[]> {
    try {
        let query = supabase
            .from('activity_log')
            .select('event_type, description, metadata, timestamp')
            .eq('user_id', userId)
            .eq('workspace_id', workspaceId)
            .or(
                `event_type.eq.INCOMING_MESSAGE,event_type.eq.AI_REPLY,event_type.eq.automation_v2`
            )
            .filter('metadata->>chat_id', 'eq', chatId)
            .order('timestamp', { ascending: false })
            .limit(limit * 3); // Fetch extra to account for non-message events

        // Scope to current session: only load messages from this session's start time
        if (sessionStartedAt) {
            query = query.gte('timestamp', sessionStartedAt);
        }

        const { data, error } = await query;

        if (error || !data || data.length === 0) {
            // Fallback: try legacy chatId key, also scoped to session boundary
            let fbQuery = supabase
                .from('activity_log')
                .select('event_type, description, metadata, timestamp')
                .eq('user_id', userId)
                .eq('workspace_id', workspaceId)
                .or(
                    `event_type.eq.INCOMING_MESSAGE,event_type.eq.AI_REPLY,event_type.eq.automation_v2`
                )
                .filter('metadata->>chatId', 'eq', chatId)
                .order('timestamp', { ascending: false })
                .limit(limit * 3);

            if (sessionStartedAt) {
                fbQuery = fbQuery.gte('timestamp', sessionStartedAt);
            }

            const { data: fallbackData } = await fbQuery;
            if (fallbackData && fallbackData.length > 0) {
                return processHistoryRows(fallbackData, limit, chatId);
            }
            if (error) {
                v2log.warn('HISTORY', 'Failed to load conversation history', { error });
            }
            return [];
        }

        return processHistoryRows(data, limit, chatId);

    } catch (err) {
        v2log.warn('HISTORY', 'Exception loading history', { err });
        return [];
    }
}

function processHistoryRows(data: any[], limit: number, chatId: string): HistoryMessage[] {
    const messages: HistoryMessage[] = [];

    for (const row of data) {
        if (row.event_type === 'INCOMING_MESSAGE') {
            const content = row.metadata?.message || row.metadata?.text || row.description || '';
            if (content) {
                messages.push({ role: 'user', content });
            }
        } else if (row.event_type === 'AI_REPLY' || row.event_type === 'automation_v2') {
            const content = row.metadata?.reply || row.metadata?.message || '';
            if (content) {
                messages.push({ role: 'assistant', content });
            }
        }

        if (messages.length >= limit) break;
    }

    // Reverse to chronological order (oldest first)
    messages.reverse();

    v2log.info('HISTORY', `Loaded ${messages.length} history messages for chat`, { chatId });
    return messages;
}
