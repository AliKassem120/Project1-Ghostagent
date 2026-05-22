/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Conversation Memory
 * ═══════════════════════════════════════════════════════════════
 * Gives the agent persistent memory across conversation sessions.
 *
 * When a chat goes idle for 30+ minutes, the current session is
 * summarized via a cheap LLM call and stored in the database.
 * On the next interaction the agent can load recent summaries to
 * recall what was previously discussed.
 */

import { generateText } from 'ai';
import { SupabaseClient } from '@supabase/supabase-js';
import { v2log } from './logger';

/** Gap (in ms) before we consider the conversation a new session. */
const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes

// ── Summary Generation ──────────────────────────────────────

/**
 * Generate a 1-2 sentence summary of a conversation session
 * using the cheap Groq model.
 */
export async function generateConversationSummary(
    groqInstance: any,
    messages: { role: string; content: string }[]
): Promise<string> {
    if (!messages || messages.length === 0) {
        return '';
    }

    const transcript = messages
        .map(m => `${m.role === 'user' ? 'Customer' : 'Agent'}: ${m.content}`)
        .join('\n');

    try {
        const result = await generateText({
            model: groqInstance('llama-3.1-8b-instant'),
            system:
                'Summarize this customer service conversation in 1-2 sentences. ' +
                'Focus on: what the customer wanted, what was discussed, and the outcome. Be concise.',
            prompt: transcript,
            temperature: 0,
        });

        const summary = result.text?.trim() || '';
        v2log.info('MEMORY', 'Generated conversation summary', {
            messageCount: messages.length,
            summaryLength: summary.length,
        });
        return summary;
    } catch (err) {
        v2log.error('MEMORY', 'Failed to generate conversation summary', { error: err });
        return '';
    }
}

// ── Persistence ─────────────────────────────────────────────

/**
 * Save a conversation summary to the database.
 */
export async function saveConversationSummary(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string,
    platform: string,
    summary: string,
    messageCount: number
): Promise<void> {
    if (!summary) return;

    try {
        const { error } = await supabase.from('conversation_summaries').insert({
            workspace_id: workspaceId,
            chat_id: chatId,
            platform,
            summary,
            message_count: messageCount,
            session_ended_at: new Date().toISOString(),
        });

        if (error) {
            v2log.error('MEMORY', 'Failed to save conversation summary', { error });
            return;
        }

        v2log.info('MEMORY', 'Saved conversation summary', {
            workspaceId,
            chatId,
            messageCount,
        });
    } catch (err) {
        v2log.error('MEMORY', 'Exception saving conversation summary', { error: err });
    }
}

// ── Retrieval ───────────────────────────────────────────────

/**
 * Load the last N summaries for a chat.
 * Fetches newest first from DB, then returns them in
 * chronological order (oldest first) so they read naturally.
 */
export async function loadRecentSummaries(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string,
    limit: number = 3
): Promise<string[]> {
    try {
        const { data, error } = await supabase
            .from('conversation_summaries')
            .select('summary')
            .eq('workspace_id', workspaceId)
            .eq('chat_id', chatId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            v2log.warn('MEMORY', 'Failed to load conversation summaries', { error });
            return [];
        }

        if (!data || data.length === 0) {
            return [];
        }

        // Reverse to chronological order (oldest first)
        const summaries = data.map(row => row.summary as string).reverse();

        v2log.info('MEMORY', `Loaded ${summaries.length} past summaries for chat`, {
            chatId,
            count: summaries.length,
        });

        return summaries;
    } catch (err) {
        v2log.warn('MEMORY', 'Exception loading conversation summaries', { error: err });
        return [];
    }
}

// ── Session Gap Detection ───────────────────────────────────

/**
 * Check if enough time has passed since the last message
 * to warrant generating a summary of the previous session.
 *
 * Returns true if the gap is > 30 minutes.
 * Returns false if lastMessageTimestamp is null (no prior history).
 */
export function shouldGenerateSummary(
    lastMessageTimestamp: string | null,
    currentTimestamp?: Date
): boolean {
    if (!lastMessageTimestamp) {
        return false;
    }

    const lastTime = new Date(lastMessageTimestamp).getTime();
    const now = (currentTimestamp ?? new Date()).getTime();
    const gap = now - lastTime;

    return gap > SESSION_GAP_MS;
}

/**
 * Check if the previous session needs to be summarized, generate it, and save it.
 */
export async function checkAndProcessSessionSummary(
    supabase: SupabaseClient,
    groqInstance: any,
    workspaceId: string,
    chatId: string,
    userId: string,
    platform: string
): Promise<void> {
    try {
        // Fetch the last 2 messages from activity_log to see if there's a new session gap
        const { data, error } = await supabase
            .from('activity_log')
            .select('timestamp')
            .eq('user_id', userId)
            .eq('workspace_id', workspaceId)
            .or('event_type.eq.INCOMING_MESSAGE,event_type.eq.AI_REPLY,event_type.eq.automation_v2')
            .filter('metadata->>chat_id', 'eq', chatId)
            .order('timestamp', { ascending: false })
            .limit(2);

        if (error) {
            v2log.warn('MEMORY', 'Failed to fetch messages for gap check', { error });
            return;
        }

        if (!data || data.length < 2) {
            // Not enough messages to have a gap
            return;
        }

        const newMsgTime = data[0].timestamp;
        const prevMsgTime = data[1].timestamp;

        if (shouldGenerateSummary(prevMsgTime, new Date(newMsgTime))) {
            v2log.info('MEMORY', 'Session gap detected. Summarizing previous session.', {
                prevMsgTime,
                newMsgTime,
            });

            // Fetch the last 30 messages strictly before the new message
            const { data: sessionRows, error: fetchErr } = await supabase
                .from('activity_log')
                .select('event_type, description, metadata, timestamp')
                .eq('user_id', userId)
                .eq('workspace_id', workspaceId)
                .or('event_type.eq.INCOMING_MESSAGE,event_type.eq.AI_REPLY,event_type.eq.automation_v2')
                .filter('metadata->>chat_id', 'eq', chatId)
                .lt('timestamp', newMsgTime)
                .order('timestamp', { ascending: false })
                .limit(30);

            if (fetchErr || !sessionRows || sessionRows.length === 0) {
                v2log.warn('MEMORY', 'Failed to fetch session messages for summary', { fetchErr });
                return;
            }

            // Convert to role/content, reverse to chronological order
            const messages = sessionRows
                .map((row: any) => {
                    const isUser = row.event_type === 'INCOMING_MESSAGE';
                    const content = isUser
                        ? row.metadata?.message || row.metadata?.text || row.description || ''
                        : row.metadata?.reply || row.metadata?.message || '';
                    return {
                        role: isUser ? 'user' : 'assistant',
                        content,
                    };
                })
                .filter(m => m.content)
                .reverse();

            if (messages.length === 0) return;

            const summary = await generateConversationSummary(groqInstance, messages);
            if (summary) {
                await saveConversationSummary(
                    supabase,
                    workspaceId,
                    chatId,
                    platform,
                    summary,
                    messages.length
                );
            }
        }
    } catch (err) {
        v2log.error('MEMORY', 'Error in checkAndProcessSessionSummary', { error: err });
    }
}
