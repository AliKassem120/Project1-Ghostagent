// ═══════════════════════════════════════════════════════════════
// 🧠 GHOST AGENT — Core AI Brain (v2 — Production)
// Integrates: Dynamic System Prompt, Rolling Memory,
// and tenant-aware business logic.
// ═══════════════════════════════════════════════════════════════

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { buildSystemPrompt, type BusinessProfile, type PromptContext } from './system-prompt-builder';
import { getConversationMemory, summarizeConversationIfNeeded, trackConversationMessage } from './rolling-memory';

export async function generateGhostReply(
    userId: string,
    userMessage: string,
    supabase: any,
    chatId?: string,
    workspaceId?: string
) {
    console.log('👻 Ghost Brain v2: Generating reply for', userId, workspaceId ? `(workspace: ${workspaceId})` : '');

    try {
        // ═══════════════════════════════════════
        // 1. FETCH BUSINESS SETTINGS (workspace-aware)
        // ═══════════════════════════════════════
        let settingsQuery = supabase
            .from('bot_settings')
            .select('business_name, business_type, tone, system_instructions, urgency_mode, handoff_keywords, language, store_location, contact_info, use_emojis, use_local_slang, shipping_rules');

        if (workspaceId) {
            settingsQuery = settingsQuery.eq('id', workspaceId);
        } else {
            settingsQuery = settingsQuery.eq('user_id', userId);
        }

        const { data: settings } = await settingsQuery.single();

        const business: BusinessProfile = {
            business_name: settings?.business_name || 'our store',
            business_type: settings?.business_type || 'ecommerce',
            tone: settings?.tone || 'Professional',
            system_instructions: settings?.system_instructions || null,
            language: settings?.language || 'Auto',
            store_location: settings?.store_location || null,
            contact_info: settings?.contact_info || null,
            use_emojis: settings?.use_emojis ?? true,
            use_local_slang: settings?.use_local_slang ?? false,
            urgency_mode: settings?.urgency_mode ?? false,
            handoff_keywords: settings?.handoff_keywords || [],
            shipping_rules: settings?.shipping_rules || null,
        };

        // ═══════════════════════════════════════
        // 2. GHOST PROTOCOL: Handoff Check
        // ═══════════════════════════════════════
        if (Array.isArray(business.handoff_keywords) && business.handoff_keywords.some(
            (kw: string) => userMessage.toLowerCase().includes(kw.toLowerCase())
        )) {
            console.log('🛑 Ghost Protocol: Handoff Keyword Detected. Pausing AI.');
            return null;
        }

        // ═══════════════════════════════════════
        // 3. FETCH CONVERSATION MEMORY (Rolling)
        // ═══════════════════════════════════════
        let historyContext = '';
        let contextSummary: string | null = null;
        let fullHistory: any[] = [];
        let hasGreetedRecently = false;

        if (chatId) {
            const memory = await getConversationMemory(supabase, userId, chatId);
            contextSummary = memory.contextSummary;
            historyContext = memory.recentHistory;
            fullHistory = memory.fullHistory;

            // Check for recent greetings
            const recentBotMessages = memory.fullHistory
                .filter((h: any) => h.event_type === 'AI_REPLY')
                .slice(-3);
            hasGreetedRecently = recentBotMessages.some((h: any) =>
                h.description.toLowerCase().includes('welcome') ||
                h.description.toLowerCase().includes('how can i help') ||
                h.description.toLowerCase().includes('store manager')
            );

            // Track message for conversation counter
            await trackConversationMessage(supabase, userId, chatId);
        }

        // ═══════════════════════════════════════
        // 4. FETCH INVENTORY & CATALOG
        // ═══════════════════════════════════════
        let inventoryContext = 'No inventory items listed currently.';
        let catalogContext = '';

        const { data: inventory } = await supabase
            .from('inventory')
            .select('item_name, stock_level, price')
            .eq('user_id', userId);

        if (inventory?.length) {
            inventoryContext = inventory
                .map((i: any) => {
                    // MODULE 4 — STRICT INVENTORY MASKING:
                    // Never expose exact stock counts to the AI.
                    // Only generalized availability labels are permitted.
                    const availability = i.stock_level > 0 ? 'In Stock' : 'Out of Stock';
                    return `- ${i.item_name}: ${availability} ($${i.price})`;
                })
                .join('\n');
        }

        const { data: knowledgeData } = await supabase
            .from('business_knowledge')
            .select('content, file_name')
            .eq('user_id', userId)
            .single();

        if (knowledgeData?.content) {
            try {
                const catalogItems = JSON.parse(knowledgeData.content);
                catalogContext = `PRODUCT CATALOG:\n${JSON.stringify(catalogItems, null, 2)}`;
            } catch { /* ignore parse errors */ }
        }

        // ═══════════════════════════════════════
        // 5. BUILD THE DYNAMIC SYSTEM PROMPT
        // ═══════════════════════════════════════
        const promptContext: PromptContext = {
            business,
            inventoryContext,
            catalogContext,
            historyContext,
            contextSummary,
            hasGreetedRecently,
        };

        const systemPrompt = buildSystemPrompt(promptContext);

        // ═══════════════════════════════════════
        // 6. GENERATE AI RESPONSE
        // ═══════════════════════════════════════
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
        const result = await generateText({
            model: groq('llama-3.3-70b-versatile'),
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
        });

        // ═══════════════════════════════════════
        // 7. BACKGROUND: Rolling Summarization
        // ═══════════════════════════════════════
        // Fire and forget — don't block the response
        if (chatId && fullHistory.length > 0) {
            summarizeConversationIfNeeded(supabase, userId, chatId, fullHistory)
                .catch(err => console.error('⚠️ Background summarization failed:', err));
        }

        return result.text;

    } catch (error) {
        console.error('Ghost Brain Error:', error);
        return "I'm currently undergoing maintenance and can't check the stock right now. Please try again later.";
    }
}
