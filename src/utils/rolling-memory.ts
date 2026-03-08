// ═══════════════════════════════════════════════════════════════
// 🧠 GHOST AGENT — Rolling Summarization Engine
// Compresses old conversation history into bullet-point summaries
// to prevent token overflow while preserving context.
// ═══════════════════════════════════════════════════════════════

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const SUMMARY_THRESHOLD = 8; // Trigger summarization after this many messages
const RECENT_MESSAGES_TO_KEEP = 2; // Always pass these recent messages in full

interface ConversationRecord {
    context_summary: string | null;
    message_count: number;
}

interface HistoryEntry {
    description: string;
    event_type: string;
    metadata: Record<string, unknown>;
    timestamp: string;
}

/**
 * Fetches the conversation record (or creates one) and returns
 * the rolling summary + recent messages for prompt injection.
 */
export async function getConversationMemory(
    supabase: any,
    ownerId: string,
    externalChatId: string
): Promise<{
    contextSummary: string | null;
    recentHistory: string;
    fullHistory: HistoryEntry[];
    conversationRecord: ConversationRecord | null;
}> {
    // 1. Fetch or create the conversation record
    const { data: conversation } = await supabase
        .from('conversations')
        .select('id, context_summary, message_count')
        .eq('owner_id', ownerId)
        .eq('external_chat_id', externalChatId)
        .maybeSingle();

    // 2. Fetch full chat history from activity_log
    const { data: history } = await supabase
        .from('activity_log')
        .select('description, event_type, metadata, timestamp')
        .eq('user_id', ownerId)
        .filter('metadata->>chat_id', 'eq', externalChatId)
        .in('event_type', ['INCOMING_MESSAGE', 'AI_REPLY', 'MANUAL_REPLY'])
        .order('timestamp', { ascending: true });

    const fullHistory: HistoryEntry[] = history || [];

    // 3. Format history entries
    const formatEntry = (h: HistoryEntry): string => {
        const role = h.event_type === 'AI_REPLY' ? 'AI'
            : h.event_type === 'MANUAL_REPLY' ? 'Owner'
                : 'User';
        let content = h.description;
        if (content.includes('Sent:')) content = content.split('Sent:')[1];
        if (content.includes('Sent (Manual):')) content = content.split('Sent (Manual):')[1];
        if (content.includes('Received:')) content = content.split('Received:')[1];
        // Clean up quoted content
        content = content.replace(/"/g, '').trim();
        // Remove sender name prefix for user messages (e.g., "John: hello" -> "hello")
        if (role === 'User' && content.includes(':')) {
            content = content.substring(content.indexOf(':') + 1).trim();
        }
        return `${role}: ${content}`;
    };

    // 4. Determine what to return based on message count
    if (fullHistory.length > SUMMARY_THRESHOLD && conversation?.context_summary) {
        // Use summary + only the most recent messages
        const recentMessages = fullHistory
            .slice(-RECENT_MESSAGES_TO_KEEP)
            .map(formatEntry)
            .join('\n');

        return {
            contextSummary: conversation.context_summary,
            recentHistory: recentMessages,
            fullHistory,
            conversationRecord: conversation,
        };
    }

    // No summary needed yet — return all history
    const allFormatted = fullHistory.map(formatEntry).join('\n');

    return {
        contextSummary: conversation?.context_summary || null,
        recentHistory: allFormatted,
        fullHistory,
        conversationRecord: conversation,
    };
}

/**
 * Background task: Summarizes a conversation when it exceeds
 * the threshold. Generates a bullet-point summary of the older
 * messages and saves it to the conversations table.
 *
 * This runs AFTER the reply is already sent, so it doesn't
 * block the user-facing response.
 */
export async function summarizeConversationIfNeeded(
    supabase: any,
    ownerId: string,
    externalChatId: string,
    fullHistory: HistoryEntry[]
): Promise<void> {
    if (fullHistory.length <= SUMMARY_THRESHOLD) {
        return; // Not enough messages to warrant summarization
    }

    console.log(`📝 Rolling Summary: ${fullHistory.length} messages — triggering summarization`);

    try {
        // Take all messages EXCEPT the most recent ones
        const olderMessages = fullHistory.slice(0, -RECENT_MESSAGES_TO_KEEP);
        const olderText = olderMessages.map(h => {
            const role = h.event_type === 'AI_REPLY' ? 'AI'
                : h.event_type === 'MANUAL_REPLY' ? 'Owner'
                    : 'User';
            let content = h.description;
            if (content.includes('Sent:')) content = content.split('Sent:')[1];
            if (content.includes('Sent (Manual):')) content = content.split('Sent (Manual):')[1];
            if (content.includes('Received:')) content = content.split('Received:')[1];
            return `${role}: ${content.replace(/"/g, '').trim()}`;
        }).join('\n');

        // Fetch existing summary to build upon
        const { data: existing } = await supabase
            .from('conversations')
            .select('context_summary')
            .eq('owner_id', ownerId)
            .eq('external_chat_id', externalChatId)
            .maybeSingle();

        const previousSummary = existing?.context_summary || '';

        // Generate summary with LLM
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

        const summaryPrompt = previousSummary
            ? `You have a previous summary of this conversation and new messages since then. 
Merge them into an updated, comprehensive bullet-point summary.

PREVIOUS SUMMARY:
${previousSummary}

NEW MESSAGES TO INCORPORATE:
${olderText}`
            : `Summarize the following customer service conversation into concise bullet points. 
Focus on: what the customer wants, what was discussed, any decisions made, and current status.

CONVERSATION:
${olderText}`;

        const result = await generateText({
            model: groq('llama-3.1-8b-instant'),
            system: `You are a conversation summarizer. Output ONLY bullet points (using "-" prefix). 
Be concise but capture all important details: customer requests, products discussed, 
prices mentioned, delivery details, and any commitments made. Max 10 bullet points.`,
            messages: [{ role: 'user', content: summaryPrompt }],
        });

        const summary = result.text;

        // Upsert the conversation record
        await supabase
            .from('conversations')
            .upsert({
                owner_id: ownerId,
                external_chat_id: externalChatId,
                platform: 'instagram',
                context_summary: summary,
                message_count: fullHistory.length,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'owner_id,external_chat_id',
            });

        console.log(`✅ Rolling Summary saved (${summary.split('\n').length} bullet points)`);

    } catch (error) {
        console.error('❌ Rolling Summary Error:', error);
        // Non-fatal — the conversation continues without updated summary
    }
}

/**
 * Increments the message count for a conversation.
 * Creates the record if it doesn't exist yet.
 */
export async function trackConversationMessage(
    supabase: any,
    ownerId: string,
    externalChatId: string
): Promise<void> {
    try {
        // Try to increment existing
        const { data: existing } = await supabase
            .from('conversations')
            .select('id, message_count')
            .eq('owner_id', ownerId)
            .eq('external_chat_id', externalChatId)
            .maybeSingle();

        if (existing) {
            await supabase
                .from('conversations')
                .update({
                    message_count: (existing.message_count || 0) + 1,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
        } else {
            await supabase
                .from('conversations')
                .insert({
                    owner_id: ownerId,
                    external_chat_id: externalChatId,
                    platform: 'instagram',
                    message_count: 1,
                });
        }
    } catch (error) {
        console.error('❌ Track conversation error:', error);
    }
}
