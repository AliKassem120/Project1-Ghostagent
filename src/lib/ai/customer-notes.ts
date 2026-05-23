/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Customer Notes (Memory Notes)
 * ═══════════════════════════════════════════════════════════════
 * Extracts, stores, and retrieves personal facts about customers
 * so the agent remembers preferences, complaints, and details
 * across conversations — like a real human employee would.
 */

import { generateText } from 'ai';
import { SupabaseClient } from '@supabase/supabase-js';
import { v2log } from './logger';

// ── Types ───────────────────────────────────────────────────

export interface CustomerNote {
    noteType: 'preference' | 'fact' | 'issue' | 'feedback';
    content: string;
}

// ── Extraction ──────────────────────────────────────────────

/**
 * Use a cheap LLM to extract noteworthy personal facts from a
 * conversation. Returns an empty array if nothing interesting
 * was mentioned.
 *
 * We avoid duplicating facts the bot already knows by passing
 * in `existingNotes` so the LLM can skip them.
 */
export async function extractNoteworthyFacts(
    openrouterInstance: any,
    messages: { role: string; content: string }[],
    existingNotes: string[] = []
): Promise<CustomerNote[]> {
    if (!messages || messages.length < 2) return [];

    const transcript = messages
        .slice(-10) // Only look at the recent conversation window
        .map(m => `${m.role === 'user' ? 'Customer' : 'Agent'}: ${m.content}`)
        .join('\n');

    const existingBlock = existingNotes.length > 0
        ? `\nAlready known facts (DO NOT repeat these):\n${existingNotes.map(n => `- ${n}`).join('\n')}\n`
        : '';

    try {
        const result = await generateText({
            model: openrouterInstance('openrouter/free'),
            system: `Extract personal facts about the CUSTOMER from this conversation.
Only extract facts that would be useful for a human employee to remember for next time.

Good examples:
- "prefers short hair" (preference)
- "has a daughter named Lara" (fact)
- "complained about long wait last time" (issue)
- "said the haircut was perfect" (feedback)
- "allergic to ammonia-based products" (preference)
- "usually orders size M" (preference)
- "lives in Hamra area" (fact)

Bad examples (DO NOT extract these):
- "wants to book an appointment" (too generic, that's just the conversation topic)
- "said hello" (trivial)
- "asked about prices" (transactional, not personal)
${existingBlock}
If there are NO noteworthy personal facts, reply with exactly: NONE

Otherwise, reply with one fact per line in the format:
TYPE: fact text

Where TYPE is one of: preference, fact, issue, feedback`,
            prompt: transcript,
            temperature: 0,
        });

        const text = result.text?.trim() || '';
        if (!text || text.toUpperCase() === 'NONE') return [];

        const notes: CustomerNote[] = [];
        for (const line of text.split('\n')) {
            const match = line.match(/^(preference|fact|issue|feedback):\s*(.+)/i);
            if (match) {
                const noteType = match[1].toLowerCase() as CustomerNote['noteType'];
                const content = match[2].trim();
                // Skip if it's too short or already exists
                if (content.length > 3 && !existingNotes.some(en => en.toLowerCase() === content.toLowerCase())) {
                    notes.push({ noteType, content });
                }
            }
        }

        if (notes.length > 0) {
            v2log.info('CUSTOMER_NOTES', `Extracted ${notes.length} noteworthy facts`, {
                count: notes.length,
                types: notes.map(n => n.noteType),
            });
        }

        return notes;
    } catch (err) {
        v2log.error('CUSTOMER_NOTES', 'Failed to extract noteworthy facts', { error: err });
        return [];
    }
}

// ── Persistence ─────────────────────────────────────────────

/**
 * Save extracted customer notes to the database.
 */
export async function saveCustomerNotes(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string,
    platform: string,
    notes: CustomerNote[]
): Promise<void> {
    if (!notes || notes.length === 0) return;

    try {
        const rows = notes.map(n => ({
            workspace_id: workspaceId,
            chat_id: chatId,
            platform,
            note_type: n.noteType,
            content: n.content,
            source: 'auto',
        }));

        const { error } = await supabase.from('customer_notes').insert(rows);
        if (error) {
            v2log.error('CUSTOMER_NOTES', 'Failed to save customer notes', { error });
            return;
        }

        v2log.info('CUSTOMER_NOTES', `Saved ${notes.length} customer notes`, {
            workspaceId,
            chatId,
            count: notes.length,
        });
    } catch (err) {
        v2log.error('CUSTOMER_NOTES', 'Exception saving customer notes', { error: err });
    }
}

// ── Retrieval ───────────────────────────────────────────────

/**
 * Load the most recent customer notes for a chat.
 * Returns them in chronological order (oldest first).
 */
export async function loadCustomerNotes(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string,
    limit: number = 10
): Promise<string[]> {
    try {
        const { data, error } = await supabase
            .from('customer_notes')
            .select('content')
            .eq('workspace_id', workspaceId)
            .eq('chat_id', chatId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            v2log.warn('CUSTOMER_NOTES', 'Failed to load customer notes', { error });
            return [];
        }

        if (!data || data.length === 0) return [];

        const notes = data.map(row => row.content as string).reverse();

        v2log.info('CUSTOMER_NOTES', `Loaded ${notes.length} notes for chat`, {
            chatId,
            count: notes.length,
        });

        return notes;
    } catch (err) {
        v2log.warn('CUSTOMER_NOTES', 'Exception loading customer notes', { error: err });
        return [];
    }
}
