import { SupabaseClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import { v2log } from '../logger';

const MODEL = 'llama-3.3-70b-versatile';

function getGroq() {
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    return createGroq({ apiKey: key });
}

export interface RecentMessage {
    id: string;
    text: string;
    createdAt: string;
}

/**
 * Retrieves recent incoming messages from the activity_log for a given chat.
 */
export async function getRecentConversationMessages(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string,
    limit: number = 10
): Promise<RecentMessage[]> {
    try {
        const { data, error } = await supabase
            .from('activity_log')
            .select('id, description, created_at, metadata')
            .eq('workspace_id', workspaceId)
            .in('event_type', ['INCOMING_MESSAGE', 'customer_message'])
            .order('created_at', { ascending: false })
            .limit(limit * 2); // fetch extra in case we need to filter

        if (error) throw error;
        if (!data || data.length === 0) return [];

        // activity_log usually has description: `Incoming DM: "user message..."`
        // or metadata.message. We'll prefer metadata.message if it exists.
        const messages: RecentMessage[] = [];
        
        for (const row of data) {
            // Must belong to this chat
            const rowChatId = row.metadata?.chat_id || row.metadata?.chatId;
            if (rowChatId && String(rowChatId) !== String(chatId)) continue;
            
            let text = row.metadata?.message || row.metadata?.text || '';
            if (!text && row.description) {
                // fallback to parsing description "Incoming DM: "foo""
                const match = row.description.match(/"(.*)"/);
                if (match) text = match[1];
                else text = row.description;
            }

            if (text) {
                messages.push({
                    id: row.id,
                    text: text.trim(),
                    createdAt: row.created_at,
                });
            }
        }

        // Reverse to get chronological order
        return messages.slice(0, limit).reverse();
    } catch (err) {
        v2log.error('RECENT_MESSAGES', 'Failed to fetch recent messages', { error: err });
        return [];
    }
}

/**
 * Zod schema for extracted customer info
 */
const ExtractedInfoSchema = z.object({
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    address: z.string().optional(),
});

export type ExtractedCustomerInfo = z.infer<typeof ExtractedInfoSchema>;

/**
 * Extracts missed details from recent chronological messages.
 * This is invoked when a user says "I sent it above" or "same as before".
 */
export async function extractCustomerDetailsFromRecentMessages(
    messages: RecentMessage[]
): Promise<ExtractedCustomerInfo> {
    if (messages.length === 0) return {};

    const groq = getGroq();
    if (!groq) return {};

    const messageLog = messages.map(m => `- ${m.text}`).join('\n');

    const prompt = `You are extracting missing customer details from recent chat history.
The user just told us "I already sent my info" or "use the info above".
Extract any visible name, phone number, or delivery address from these recent messages.
Only return valid JSON. Do not invent info. If it's not present, leave it blank.

Schema:
{
  "customerName": "string or null",
  "customerPhone": "string or null",
  "address": "string or null"
}

Recent Chat History:
${messageLog}
`;

    try {
        const { text } = await generateText({
            model: groq(MODEL),
            prompt,
            temperature: 0.1,
            maxOutputTokens: 200,
        });

        const raw = JSON.parse(text.replace(/^```json|```$/gi, '').trim());
        const parsed = ExtractedInfoSchema.safeParse(raw);

        if (parsed.success) {
            v2log.info('RECENT_MESSAGES', 'Extracted details', { data: parsed.data });
            return parsed.data;
        }

        return {};
    } catch (err) {
        v2log.warn('RECENT_MESSAGES', 'Extraction failed', { error: err });
        return {};
    }
}
