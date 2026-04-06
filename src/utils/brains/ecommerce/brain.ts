import { createGroq } from '@ai-sdk/groq';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { BusinessProfile } from '../types';
import { buildEcommerceSystemPrompt } from './prompt';
import { getConversationMemory, summarizeConversationIfNeeded, trackConversationMessage } from '../../rolling-memory';
import { checkEcommerceInventoryTool } from './tools';

export async function generateEcommerceGhostReply(
    userId: string,
    userMessage: string,
    supabase: any,
    chatId?: string,
    workspaceId?: string,
    checkoutContext?: string
) {
    console.log('🛒 [E-COMMERCE BRAIN] Generating reply for', userId, workspaceId ? `(workspace: ${workspaceId})` : '');

    try {
        let settingsQuery = supabase
            .from('ai_settings')
            .select('business_name, business_type, tone, system_instructions, urgency_mode, handoff_keywords, language, store_location, contact_info, use_emojis, use_local_slang, shipping_rules, is_autopilot_enabled');

        if (workspaceId) {
            settingsQuery = settingsQuery.eq('id', workspaceId);
        } else {
            settingsQuery = settingsQuery.eq('user_id', userId).is('id', null);
        }

        const { data: settings } = await settingsQuery.limit(1).maybeSingle();
        const { data: userRecord } = await supabase.from('users').select('plan_tier').eq('id', userId).single();
        const planTier = userRecord?.plan_tier?.toLowerCase() || 'free_trial';

        const business: BusinessProfile = {
            business_name: settings?.business_name || 'our store',
            business_type: 'ecommerce',
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

        if (Array.isArray(business.handoff_keywords) && business.handoff_keywords.some(
            (kw: string) => userMessage.toLowerCase().includes(kw.toLowerCase())
        )) {
            console.log('🛑 [E-COMMERCE] Handoff Keyword Detected. Pausing AI.');
            return null;
        }

        let historyContext = '';
        let contextSummary: string | null = null;
        let fullHistory: any[] = [];
        let hasGreetedRecently = false;

        if (chatId) {
            const { contextSummary: fetchedContextSummary, recentHistory, fullHistory: fetchedFullHistory } =
                await getConversationMemory(supabase, userId, chatId, workspaceId);
            contextSummary = fetchedContextSummary;
            historyContext = recentHistory;
            fullHistory = fetchedFullHistory;
        }

        let inventoryContext = 'No inventory items listed currently.';
        let catalogContext = '';

        let inventoryQuery = supabase.from('inventory').select('item_name, stock_level, price');
        if (workspaceId) inventoryQuery = inventoryQuery.eq('workspace_id', workspaceId);
        else inventoryQuery = inventoryQuery.eq('user_id', userId).is('workspace_id', null);

        const { data: inventory } = await inventoryQuery.limit(50);
        if (inventory?.length) {
            inventoryContext = inventory.map((i: any) => `- ${i.item_name}: ${i.stock_level > 0 ? 'In Stock' : 'Out of Stock'} ($${i.price})`).join('\n');
        }

        let knowledgeQuery = supabase.from('business_knowledge').select('content, file_name');
        if (workspaceId) knowledgeQuery = knowledgeQuery.eq('workspace_id', workspaceId);
        else knowledgeQuery = knowledgeQuery.eq('user_id', userId).is('workspace_id', null);

        const { data: knowledgeData } = await knowledgeQuery.single();
        if (knowledgeData?.content) {
            try {
                catalogContext = `PRODUCT CATALOG:\n${JSON.stringify(JSON.parse(knowledgeData.content), null, 2)}`;
            } catch (e) {
                catalogContext = `PRODUCT KNOWLEDGE:\n${knowledgeData.content.substring(0, 1000)}`;
            }
        }

        if (checkoutContext) {
            historyContext += `\n[SYSTEM NOTE: The customer just attempted to order. Form content: ${checkoutContext}]`;
        }

        const systemPrompt = buildEcommerceSystemPrompt({
            business,
            inventoryContext,
            catalogContext,
            historyContext,
            contextSummary,
            hasGreetedRecently
        });

        // 🛍️ ECOMMERCE TRANSACTION TOOL
        const finalizeTransactionTool = {
            description: 'Save the confirmed order immediately into the database before replying.',
            parameters: z.object({
                customer_name: z.string().optional().describe('Full name. IF MISSING, politely ask for it in chat. Do not guess.'),
                customer_phone: z.string().optional().describe('Phone number. IF MISSING, politely ask for it. Do not guess.'),
                customer_email: z.string().email().optional().describe('Optional email address.'),
                delivery_address: z.string().describe('The delivery address.'),
                payment_method: z.string().optional().describe('Cash on delivery, card, etc.'),
                item_requested: z.string().describe('What they ordered.'),
                item_variant: z.string().optional().describe('Color, size, or specific model variant.')
            }),
            execute: async (a: any) => {
                console.log('🛍️ [E-COMMERCE] Executing finalize_transaction:', a);
                try {
                    let handle = 'Customer';
                    const itemRequested = a?.item_requested || 'Unknown item';
                    const now = new Date();
                    const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

                    const queryArgs = [userId, itemRequested, fiveMinsAgo];
                    let recentOrdersQuery = supabase
                        .from('orders')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('item_requested', itemRequested)
                        .gte('created_at', fiveMinsAgo);

                    if (chatId) recentOrdersQuery = recentOrdersQuery.eq('instagram_user_id', chatId);
                    if (workspaceId) recentOrdersQuery = recentOrdersQuery.eq('workspace_id', workspaceId);

                    const { data: recentOrders } = await recentOrdersQuery;

                    if (recentOrders && recentOrders.length > 0) {
                        return "DUPLICATE PREVENTED: You already saved this exact order a few minutes ago. DO NOT try to save it again. Just reply to the user naturally (e.g., 'Takram hbb!').";
                    }

                    const { data: lastMsg } = await supabase
                        .from('activity_log')
                        .select('metadata')
                        .eq('user_id', userId)
                        .filter('metadata->>chat_id', 'eq', chatId)
                        .order('timestamp', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (lastMsg?.metadata?.username) handle = lastMsg.metadata.username;

                    const orderPayload: Record<string, any> = {
                        user_id: userId,
                        workspace_id: workspaceId || null,
                        instagram_user_id: chatId || null,
                        instagram_handle: handle,
                        status: 'Pending',
                        created_at: new Date().toISOString(),
                        customer_name: a?.customer_name || null,
                        customer_phone: a?.customer_phone || null,
                        customer_email: a?.customer_email || null,
                        item_requested: itemRequested,
                        customer_address: a?.delivery_address || null,
                        payment_method: a?.payment_method || 'Cash on Delivery',
                        raw_message: JSON.stringify({ item_variant: a?.item_variant || undefined }),
                    };

                    const { error } = await supabase.from('orders').insert(orderPayload);
                    if (error) throw error;

                    return "Order saved successfully! Tell the customer it's confirmed in 1 short sentence.";
                } catch (err: any) {
                    console.error('❌ [E-COMMERCE] Failed to save transaction:', err);
                    return "Failed to save to database. Apologize to the user.";
                }
            }
        };

        const toolsMapping: Record<string, any> = {};
        
        if (planTier !== 'starter' && planTier !== 'free_trial') {
            toolsMapping['finalize_transaction'] = finalizeTransactionTool;
            if (workspaceId) toolsMapping['check_ecommerce_inventory'] = checkEcommerceInventoryTool(workspaceId);
        }

        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
        const purchaseKeywords = ['buy', 'order', 'checkout', 'pay', 'purchase', 'book', 'schedule', 'viewing', 'ticket', 'delivery', 'bde otlob', 'bade'];
        const isPurchaseIntent = purchaseKeywords.some(kw => userMessage.toLowerCase().includes(kw));
        const hasActiveToolContext = historyContext.toLowerCase().includes('transaction') || historyContext.toLowerCase().includes('order');

        const cleanMessage = userMessage.replace(/\\[ATTACHMENT:.*?\\]/g, '').trim() || 'What is this?';
        const selectedModel = (isPurchaseIntent || hasActiveToolContext) ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';

        console.log(`🚀 [E-COMMERCE] Selected Model: ${selectedModel}`);

        const messages: any[] = (fullHistory || [])
            .filter((h: any) => h.event_type === 'INCOMING_MESSAGE' || h.event_type === 'AI_REPLY')
            .map((h: any) => ({
                role: h.event_type === 'INCOMING_MESSAGE' ? 'user' : 'assistant',
                content: h.description.includes('"') ? h.description.split('"')[1] : h.description
            })).slice(-10);

        messages.push({ role: 'user', content: cleanMessage });

        let finalResult = await generateText({
            model: groq(selectedModel),
            system: systemPrompt,
            messages: messages,
            tools: toolsMapping,
            toolChoice: 'auto',
            temperature: 0.1,
        });

        if (finalResult.usage) {
            const { promptTokens, completionTokens, totalTokens } = finalResult.usage as any;
            console.log(`📊 [Usage] Tokens: ${promptTokens || 0} (In) / ${completionTokens || 0} (Out) — Total: ${totalTokens || 0}`);
        }

        if (finalResult.toolCalls && finalResult.toolCalls.length > 0 && !finalResult.text) {
            const executedResults = (finalResult as any).toolResults || [];
            if (executedResults.length > 0) {
                console.log(`[E-COMMERCE] Tool used. Powering up for final answer...`);
                const toolResultsMessages: any[] = [...messages];
                toolResultsMessages.push({
                    role: 'assistant',
                    content: finalResult.toolCalls.map((tc: any) => ({
                        type: 'tool-call', toolCallId: tc.toolCallId, toolName: tc.toolName, input: tc.input || tc.args
                    }))
                });
                toolResultsMessages.push({
                    role: 'tool',
                    content: executedResults.map((tr: any) => ({
                        type: 'tool-result', toolCallId: tr.toolCallId, toolName: tr.toolName, output: { type: 'json', value: tr.output || tr.result }
                    }))
                });

                finalResult = await generateText({
                    model: groq('llama-3.3-70b-versatile'),
                    system: systemPrompt,
                    messages: toolResultsMessages,
                    tools: toolsMapping,
                    toolChoice: 'auto',
                    temperature: 0.1,
                });

                if (finalResult.usage) {
                    const { promptTokens, completionTokens, totalTokens } = finalResult.usage as any;
                    console.log(`📊 [Usage - Pass 2] Tokens: ${promptTokens || 0} (In) / ${completionTokens || 0} (Out) — Total: ${totalTokens || 0}`);
                }
            }
        }

        if (chatId && fullHistory.length > 0) {
            trackConversationMessage(supabase, userId, chatId, workspaceId).catch(console.error);
            summarizeConversationIfNeeded(supabase, userId, chatId, fullHistory, workspaceId).catch(console.error);
        }

        return finalResult.text;

    } catch (error: any) {
        if (error?.statusCode === 429) return null;
        console.error('E-COMMERCE Error:', error);
        return null;
    }
}
