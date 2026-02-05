import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { z } from "zod";

export async function generateGhostReply(
    userId: string,
    userMessage: string,
    supabase: any
) {
    console.log('👻 Ghost Brain: Generating reply for', userId);

    // 1. FETCH CONTEXT
    let inventoryContext = "No inventory items listed currently.";
    let catalogContext = "";
    let businessName = "Ghost Agent Store";

    try {
        // Fetch Settings with Ghost Protocol fields
        const { data: settings } = await supabase
            .from('bot_settings')
            .select('business_name, tone, system_instructions, urgency_mode, handoff_keywords')
            .eq('user_id', userId)
            .single();

        if (settings?.business_name) businessName = settings.business_name;

        // --- GHOST PROTOCOL: Hand-off Check ---
        const handoffKeywords = settings?.handoff_keywords || [];
        if (Array.isArray(handoffKeywords) && handoffKeywords.some((kw: string) => userMessage.toLowerCase().includes(kw.toLowerCase()))) {
            console.log('🛑 Ghost Protocol: Handoff Keyword Detected. Pausing AI.');
            return null; // Signals the webhook to NOT send a reply
        }

        // --- GHOST PROTOCOL: Urgency Mode ---
        let urgencyPrompt = "";
        if (settings?.urgency_mode) {
            urgencyPrompt = `\n🔥 URGENCY MODE AGENT: Subtly emphasize scarcity (e.g., "only a few left", "high demand") in your response to encourage a faster decision. Be professional but create a sense of FOMO (Fear Of Missing Out).`;
        }

        // Fetch Inventory
        const { data: inventory } = await supabase
            .from('inventory')
            .select('item_name, stock_level, price')
            .eq('user_id', userId);

        if (inventory?.length) {
            inventoryContext = inventory
                .map((i: any) => `- ${i.item_name}: ${i.stock_level} in stock ($${i.price})`)
                .join('\n');
        }

        // Fetch Knowledge
        const { data: knowledgeData } = await supabase
            .from('business_knowledge')
            .select('content, file_name')
            .eq('user_id', userId)
            .single();

        if (knowledgeData?.content) {
            try {
                const catalogItems = JSON.parse(knowledgeData.content);
                catalogContext = `PRODUCT CATALOG:\n${JSON.stringify(catalogItems, null, 2)}`;
            } catch (e) { }
        }

        // 2. CONSTRUCT PROMPT
        const systemPrompt = `You are the AI Store Manager for ${businessName}.
        
CURRENT LIVE INVENTORY:
---
${inventoryContext}
---
${catalogContext}

USER INSTRUCTIONS (Tone: ${settings?.tone || 'Professional'}):
${settings?.system_instructions || 'Be helpful and concise.'}

${urgencyPrompt}

GOAL: cancel orders, answer questions about stock, price, and availability.
Refuse to sell items that are out of stock.
If you sell an item, act as if you are processing it (activity log will be updated).
Keep responses short (under 500 chars) as this is Instagram DM.
`;

        // 3. GENERATE
        const result = await generateText({
            model: google("gemini-2.5-flash"),
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
            // Note: Tools excluded in V1 for safety/speed, can be added later
        });

        return result.text;

    } catch (error) {
        console.error('Ghost Brain Error:', error);
        return "I'm currently undergoing maintenance and can't check the stock right now. Please try again later.";
    }
}
