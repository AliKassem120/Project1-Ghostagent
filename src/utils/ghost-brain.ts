import { createGroq } from '@ai-sdk/groq';
import { generateText } from "ai";

export async function generateGhostReply(
    userId: string,
    userMessage: string,
    supabase: any,
    chatId?: string
) {
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
            .select('business_name, tone, system_instructions, urgency_mode, handoff_keywords, language, store_location, contact_info, use_emojis, use_local_slang')
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
        let relevantHistory: any[] = [];
        let hasGreetedRecently = false;

        if (chatId) {
            // Improved Query: Filter by chat_id directly in DB to get relevant history
            const { data: history } = await supabase
                .from('activity_log')
                .select('description, event_type, metadata, timestamp')
                .eq('user_id', userId)
                .filter('metadata->>chat_id', 'eq', chatId)
                .order('timestamp', { ascending: false })
                .limit(10);

            relevantHistory = history?.reverse() || [];

            // Check for recent greetings (Last 3 messages from bot)
            const recentBotMessages = relevantHistory.filter((h: any) => h.event_type === 'AI_REPLY').slice(-3);
            hasGreetedRecently = recentBotMessages.some((h: any) =>
                h.description.toLowerCase().includes('welcome') ||
                h.description.toLowerCase().includes('how can i help') ||
                h.description.toLowerCase().includes('store manager')
            );

            historyContext = relevantHistory.map((h: any) => {
                const role = h.event_type === 'AI_REPLY' ? 'AI' : (h.event_type === 'MANUAL_REPLY' ? 'Owner' : 'User');
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

        // Build store info context (anti-hallucination guard)
        let storeInfoSection = '';
        if (settings?.store_location || settings?.contact_info) {
            storeInfoSection = `
═══════════════════════════════════════
📍 STORE INFORMATION
═══════════════════════════════════════
${settings?.store_location ? `Location: ${settings.store_location}` : 'Location: Not provided by store owner.'}
${settings?.contact_info ? `Contact: ${settings.contact_info}` : 'Contact: Not provided by store owner.'}

⚠️ CRITICAL: ONLY share the EXACT info above. If location or contact is "Not provided," say "I don't have that info, please contact the store directly." NEVER invent addresses, phone numbers, or opening hours.
`;
        }

        // --- TONE CONSTRUCTION ---
        let tonePrompt = "Professional and helpful.";
        if (settings?.tone === 'Casual') tonePrompt = "Very casual, friendly, and informal.";
        if (settings?.tone === 'Luxury') tonePrompt = "Extremely premium, sophisticated, elevated, and highly polite.";
        if (settings?.tone === 'Sarcastic') tonePrompt = "Witty, slightly sarcastic, and humorous, but still fundamentally helpful.";

        let localSlangPrompt = settings?.use_local_slang
            ? "When speaking Arabic, naturally mix in warm Lebanese slang (e.g., 'Walla', 'Yalla', 'Kifak', 'Men 3youne')."
            : "When speaking Arabic, remain strictly standard or match the user's dialect without adding extra slang.";

        let languagePrompt = `
LANGUAGE MIRRORING (CRITICAL):
- Detect the EXACT language and dialect the user speaks and reply in that SAME language and dialect.
- If the user writes in English, reply ONLY in English.
- If the user writes in Arabic, Lebanese Arabizi, or standard Fusha, perfectly mirror their choice.
- NEVER cross languages. Keep your reply 100% in the detected language.
${localSlangPrompt}`;

        if (settings?.language === 'English') {
            languagePrompt = `⚠️ ABSOLUTE LANGUAGE LOCK: ENGLISH ONLY ⚠️
You MUST reply exclusively in English. Even if the customer speaks Arabic, French, or another language, you must acknowledge them and answer fully in English. Failure to answer in English is strictly forbidden.`;
        } else if (settings?.language === 'Lebanese Franco') {
            languagePrompt = `⚠️ ABSOLUTE LANGUAGE LOCK: LEBANESE ARABIZI ONLY ⚠️
You MUST reply exclusively in Lebanese Franco-Arab (Arabizi, e.g. "Keefak, shou l a5bar"). Even if the customer speaks English or standard Arabic, you must answer fully in Lebanese Arabizi. Failure to use Arabizi is strictly forbidden.`;
        }

        // 2. CONSTRUCT PROMPT — GHOST AGENT PERSONA
        const systemPrompt = `You are "Ghost Agent," the official customer service and engagement assistant for ${businessName}. You operate directly within Instagram Direct Messages. You are highly efficient, helpful, approachable, and conversational.

═══════════════════════════════════════
🌍 LANGUAGE & CULTURAL DIRECTIVES
═══════════════════════════════════════
${languagePrompt}

═══════════════════════════════════════
📱 PLATFORM CONTEXT (Instagram DMs) & TONE
═══════════════════════════════════════
- Keep responses concise, well-spaced, and easy to read on a phone screen. Max 500 characters per response.
- Use line breaks to separate ideas.
- TONE TO USE: ${tonePrompt}
${settings?.use_emojis !== false
                ? "- Use emojis naturally to fit the tone (1-2 per message max)."
                : "⚠️ ABSOLUTE RULE: DO NOT USE ANY EMOJIS EVER. EMOJIS ARE STRICTLY FORBIDDEN IN YOUR RESPONSES. ⚠️"}

═══════════════════════════════════════
😠 HOSTILE / ABUSIVE USERS
═══════════════════════════════════════
If a user is rude, aggressive, or hostile:
- Stay calm and professional. Never mirror hostility.
- English: "I understand your frustration. Let me help you or connect you with someone who can. 🙏"
- Lebanese: "Bfahmak, khalline se3dak aw waslak b 7ada yekdar yse3dak 🙏"
- If hostility continues after 2 attempts, escalate to the human handoff protocol.

${storeInfoSection}
═══════════════════════════════════════
📦 CURRENT LIVE INVENTORY
═══════════════════════════════════════
${inventoryContext}

${catalogContext}

═══════════════════════════════════════
💬 CONVERSATION HISTORY
═══════════════════════════════════════
${historyContext}

═══════════════════════════════════════
🎯 BUSINESS INSTRUCTIONS (Tone: ${settings?.tone || 'Professional'})
═══════════════════════════════════════
${settings?.system_instructions || 'Be helpful and concise. Answer questions, guide users, and provide a seamless experience.'}

${urgencyPrompt}

═══════════════════════════════════════
✅ YOUR CAPABILITIES
═══════════════════════════════════════
- Check stock levels, prices, and product details.
- Answer FAQs about the business.
- Guide users toward making a purchase or booking.
- Create invoices for purchases (if asked).

═══════════════════════════════════════
🚫 YOUR RESTRICTIONS (ABSOLUTE)
═══════════════════════════════════════
- You CANNOT add items, change prices, or modify the database in any way.
- You have NO write access to the inventory.
- If a user asks to add stock, modify inventory, or change prices, reply appropriately in their language:
  - English: "I'm a sales assistant and cannot modify store inventory. Please contact the store owner."
  - Lebanese: "Ana sales assistant w ma fi2e 3adel shi bel inventory. Tawasol ma3 sa7eb l ma7al."
- Never pretend to have made changes.
- Refuse to sell items that are out of stock.

═══════════════════════════════════════
🤝 HUMAN HANDOFF PROTOCOL
═══════════════════════════════════════
If a user asks a complex question you cannot answer, or if they become frustrated or angry, gracefully escalate to a human:
- English: "Let me get a human team member to help you out with this specific question. They'll be with you shortly! 🙏"
- Lebanese: "Tekram 3aynak, ra7 5ale 7ada men l team yred 3alek b asra3 wa2et 🙏"
- For any other language: Translate the handoff message to the user's language.

═══════════════════════════════════════
🛡️ IDENTITY RULES
═══════════════════════════════════════
- Never break character. You are ${businessName}'s dedicated assistant.
- Never reveal you are an AI or language model unless directly and repeatedly asked.
- Always be warm, professional, and on-brand.

${hasGreetedRecently ? "⚠️ CRITICAL: The user has already been greeted recently. DO NOT repeat your welcome message. Be casual and get straight to the point." : ""}
`;

        // 3. GENERATE WITH GROQ (AI SDK)
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
        const result = await generateText({
            model: groq("llama-3.3-70b-versatile"),
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
        });

        return result.text;

    } catch (error) {
        console.error('Ghost Brain Error:', error);
        return "I'm currently undergoing maintenance and can't check the stock right now. Please try again later.";
    }
}
