import Groq from "groq-sdk";
import { createClient } from "@/utils/supabase/server";

export async function generateGhostReply(
    userId: string,
    userMessage: string,
    supabase: any,
    chatId?: string
) {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    console.log('👻 Ghost Brain: Generating reply for', userId);

    // 1. FETCH CONTEXT
    let inventoryContext = "No inventory items listed currently.";
    let catalogContext = "";
    let businessName = "Ghost Agent Store";
    let historyContext = "";

    try {
        // Fetch Settings (Including Ghost Protocol)
        const { data: settings } = await supabase
            .from('bot_settings')
            .select('business_name, tone, system_instructions, urgency_mode, handoff_keywords')
            .eq('user_id', userId)
            .single();

        if (settings?.business_name) businessName = settings.business_name;

        // --- GHOST PROTOCOL: Handoff Check ---
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

        // History Fetch (Goldfish Fix)
        if (chatId) {
            const { data: history } = await supabase
                .from('activity_log')
                .select('description, event_type, metadata')
                .eq('user_id', userId)
                .order('timestamp', { ascending: false })
                .limit(10);

            // Filter in memory for simplicity or use specific metadata check if indexed
            // Since activity_log mixes all chats, we must filter. 
            // Note: In production, adding an index on metadata->>chat_id is recommended.
            const relevantHistory = history?.filter((h: any) => h.metadata?.chat_id === chatId).reverse() || [];

            historyContext = relevantHistory.map((h: any) => {
                const role = h.event_type === 'AI_REPLY' ? 'AI' : (h.event_type === 'MANUAL_REPLY' ? 'OWNER' : 'CUSTOMER');
                // Clean description
                let content = h.description;
                if (content.includes('Sent:')) content = content.split('Sent:')[1];
                if (content.includes('Sent (Manual):')) content = content.split('Sent (Manual):')[1];
                if (content.includes('Received:')) content = content.split('Received:')[1];
                return `${role}: ${content.replace(/"/g, '').trim()}`;
            }).join('\n');
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

PREVIOUS CONVERSATION HISTORY (Use this context to reply relevantly):
${historyContext}

USER INSTRUCTIONS (Tone: ${settings?.tone || 'Professional'}):
${settings?.system_instructions || 'Be helpful and concise.'}

${urgencyPrompt}

GOAL: cancel orders, answer questions about stock, price, and availability.
Refuse to sell items that are out of stock.
If you sell an item, act as if you are processing it (activity log will be updated).
Keep responses short (under 500 chars) as this is Instagram DM.
`;

        // 3. GENERATE WITH GROQ
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 1024,
        });

        return completion.choices[0]?.message?.content || "I'm having trouble connecting right now.";

    } catch (error) {
        console.error('Ghost Brain Error:', error);
        return "I'm currently undergoing maintenance and can't check the stock right now. Please try again later.";
    }
}
