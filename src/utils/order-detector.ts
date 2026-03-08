// ═══════════════════════════════════════════════════════════════
// 🛒 GHOST AGENT — Order Intent Detector
// Runs after the AI reply is generated for ecommerce workspaces.
// Uses a lightweight Groq call to detect purchase intent and
// extract the requested item, then saves a lead to the orders table.
// ═══════════════════════════════════════════════════════════════

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export interface OrderDetectionResult {
    wantsToBuy: boolean;
    item: string | null;
}

/**
 * Ask Groq to analyse a customer message and determine if there's purchase intent.
 * Returns a structured result with the extracted item name.
 */
export async function detectOrderIntent(
    customerMessage: string,
    aiReply: string
): Promise<OrderDetectionResult> {
    try {
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
        const { text } = await generateText({
            model: groq('llama-3.3-70b-versatile'),
            system: `You are an order intent classifier for an Instagram boutique.
Analyse the customer message and determine:
1. Does the customer want to BUY, ORDER, or PURCHASE something? (not just asking for info)
2. If yes, what EXACT item(s) are they requesting? (include size/color if mentioned)

Respond ONLY with valid JSON — no markdown, no explanation:
{"wants_to_buy": true|false, "item": "extracted item name" | null}

Examples:
- "I want to buy the black hoodie size M" → {"wants_to_buy": true, "item": "Black Hoodie — Size M"}
- "How much is the necklace?" → {"wants_to_buy": false, "item": null}
- "I'll take 2 of the earrings" → {"wants_to_buy": true, "item": "Earrings (x2)"}
- "Do you have this in blue?" → {"wants_to_buy": false, "item": null}
- "I want to order the silver ring" → {"wants_to_buy": true, "item": "Silver Ring"}`,
            messages: [{ role: 'user', content: `Customer message: "${customerMessage}"\nAI reply: "${aiReply}"` }],
        });

        const parsed = JSON.parse(text.trim());
        return {
            wantsToBuy: Boolean(parsed.wants_to_buy),
            item: parsed.item || null,
        };
    } catch (err) {
        console.warn('⚠️ [OrderDetector] Failed to parse intent:', err);
        return { wantsToBuy: false, item: null };
    }
}

/**
 * Saves an order lead to the orders table.
 * Uses supabaseAdmin (service role) so it bypasses RLS.
 */
export async function saveOrderLead(
    supabaseAdmin: any,
    opts: {
        userId: string;
        workspaceId: string | null;
        instagramHandle: string;
        instagramUserId: string;
        item: string;
        rawMessage: string;
    }
): Promise<void> {
    const { userId, workspaceId, instagramHandle, instagramUserId, item, rawMessage } = opts;

    const { error } = await supabaseAdmin.from('orders').insert({
        user_id: userId,
        workspace_id: workspaceId || null,
        instagram_handle: instagramHandle,
        instagram_user_id: instagramUserId,
        item_requested: item,
        raw_message: rawMessage,
        status: 'Pending',
        created_at: new Date().toISOString(),
    });

    if (error) {
        console.error('❌ [OrderDetector] Failed to save order lead:', error.message);
    } else {
        console.log(`🛒 [OrderDetector] Order lead saved: "${item}" from @${instagramHandle}`);
    }
}
