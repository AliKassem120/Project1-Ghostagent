import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { z } from 'zod';
import { BusinessProfile } from '../types';
import { buildEcommerceSystemPrompt } from './prompt';
import { getConversationMemory, summarizeConversationIfNeeded, trackConversationMessage } from '../../rolling-memory';
import { checkEcommerceInventoryTool } from './tools';

// ─────────────────────────────────────────────────────────────────────────────
// Detects if the current conversation is in an active checkout collection phase
// i.e. the bot already asked for name/address/phone and is waiting for them.
// ─────────────────────────────────────────────────────────────────────────────
function isInCheckoutFlow(historyMessages: any[]): boolean {
    const last5 = historyMessages.slice(-5);
    return last5.some((m: any) => {
        const text = (m?.content || '').toLowerCase();
        return (
            text.includes('esm') ||
            text.includes('adress') ||
            text.includes('ra2m') ||
            text.includes('name') ||
            text.includes('address') ||
            text.includes('phone') ||
            text.includes('delivery address') ||
            text.includes('3nwen')
        );
    });
}

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
        // ── 1. Load workspace settings ──────────────────────────────────────
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

        // ── 2. Handoff keyword check ─────────────────────────────────────────
        if (Array.isArray(business.handoff_keywords) && business.handoff_keywords.some(
            (kw: string) => userMessage.toLowerCase().includes(kw.toLowerCase())
        )) {
            console.log('🛑 [E-COMMERCE] Handoff Keyword Detected. Pausing AI.');
            return null;
        }

        // ── 3. Load conversation memory ──────────────────────────────────────
        let historyContext = '';
        let contextSummary: string | null = null;
        let fullHistory: any[] = [];

        if (chatId) {
            const { contextSummary: fetchedContextSummary, recentHistory, fullHistory: fetchedFullHistory } =
                await getConversationMemory(supabase, userId, chatId, workspaceId);
            contextSummary = fetchedContextSummary;
            historyContext = recentHistory;
            fullHistory = fetchedFullHistory;
        }

        if (checkoutContext) {
            historyContext += `\n[SYSTEM NOTE: The customer just attempted to order. Form content: ${checkoutContext}]`;
        }

        // ── 4. Load inventory & knowledge ───────────────────────────────────
        let inventoryContext = 'No inventory items listed currently.';
        let catalogContext = '';

        let inventoryQuery = supabase.from('inventory').select('item_name, stock_level, price');
        if (workspaceId) inventoryQuery = inventoryQuery.eq('workspace_id', workspaceId);
        else inventoryQuery = inventoryQuery.eq('user_id', userId).is('workspace_id', null);

        const { data: inventory } = await inventoryQuery.limit(50);
        if (inventory?.length) {
            inventoryContext = inventory.map((i: any) =>
                `- ${i.item_name}: ${i.stock_level > 0 ? 'In Stock' : 'Out of Stock'} ($${i.price})`
            ).join('\n');
        }

        let knowledgeQuery = supabase.from('business_knowledge').select('content, file_name');
        if (workspaceId) knowledgeQuery = knowledgeQuery.eq('workspace_id', workspaceId);
        else knowledgeQuery = knowledgeQuery.eq('user_id', userId).is('workspace_id', null);

        const { data: knowledgeData } = await knowledgeQuery.maybeSingle();
        if (knowledgeData?.content) {
            try {
                catalogContext = `PRODUCT CATALOG:\n${JSON.stringify(JSON.parse(knowledgeData.content), null, 2)}`;
            } catch {
                catalogContext = `PRODUCT KNOWLEDGE:\n${knowledgeData.content.substring(0, 1000)}`;
            }
        }

        // ── 5. Build system prompt ───────────────────────────────────────────
        const systemPrompt = buildEcommerceSystemPrompt({
            business,
            inventoryContext,
            catalogContext,
            historyContext,
            contextSummary,
            hasGreetedRecently: false,
        });

        // ── 6. Build conversation messages ───────────────────────────────────
        const messages: any[] = (fullHistory || [])
            .filter((h: any) => h.event_type === 'INCOMING_MESSAGE' || h.event_type === 'AI_REPLY')
            .map((h: any) => ({
                role: h.event_type === 'INCOMING_MESSAGE' ? 'user' : 'assistant',
                content: h.description.includes('"') ? h.description.split('"')[1] : h.description
            })).slice(-12);

        const cleanMessage = userMessage.replace(/\[ATTACHMENT:.*?\]/g, '').trim() || 'Hello';
        messages.push({ role: 'user', content: cleanMessage });

        // ── 7. Smart model selection ─────────────────────────────────────────
        // Use the powerful model if: purchase intent in message, bot was recently
        // collecting checkout info, or explicit purchase keywords are present.
        const purchaseKeywords = ['buy', 'bde', 'bade', 'badi', 'order', 'checkout', 'pay', 'purchase', 'delivery', 'bde otlob', 'wehde', 'tlete', 'arba3'];
        const isPurchaseIntent = purchaseKeywords.some(kw => userMessage.toLowerCase().includes(kw));
        const botWasCollectingCheckout = isInCheckoutFlow(messages.slice(0, -1)); // check history before current msg
        const useSmartModel = isPurchaseIntent || botWasCollectingCheckout;
        const selectedModel = useSmartModel ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';

        console.log(`🚀 [E-COMMERCE] Model: ${selectedModel} | Purchase: ${isPurchaseIntent} | Checkout: ${botWasCollectingCheckout}`);

        // ── 8. Tool definitions ──────────────────────────────────────────────
        const toolsMapping: Record<string, any> = {};

        // finalize_transaction is available on all plans so users can test order saving during their trial
        toolsMapping['finalize_transaction'] = {
                description: 'Call this tool IMMEDIATELY after the customer provides their name, address, and phone. Save the order to the database.',
                parameters: z.object({
                    name: z.string().optional().describe('Full name of the customer.'),
                    phone: z.string().optional().describe('Phone number of the customer.'),
                    email: z.string().email().optional().describe('Optional email address.'),
                    address: z.string().optional().describe('Delivery address.'),
                    payment_method: z.string().optional().describe('Cash on delivery by default.'),
                    item: z.string().describe('The item(s) they ordered.'),
                    variant: z.string().optional().describe('Color, size, or model variant if specified.'),
                }),
                execute: async (a: any) => {
                    const name = a?.name || null;
                    const phone = a?.phone || null;
                    const address = a?.address || null;
                    const item = a?.item || 'Unknown item';

                    console.log('🛍️ [E-COMMERCE] Executing finalize_transaction:', { name, phone, address, item });
                    try {
                        // Duplicate guard: prevent re-saving the same order within 5 minutes
                        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
                        let recentOrdersQuery = supabase
                            .from('orders').select('id')
                            .eq('user_id', userId)
                            .eq('item_requested', item)
                            .gte('created_at', fiveMinsAgo);

                        if (chatId) recentOrdersQuery = recentOrdersQuery.eq('instagram_user_id', chatId);
                        if (workspaceId) recentOrdersQuery = recentOrdersQuery.eq('workspace_id', workspaceId);

                        const { data: recentOrders } = await recentOrdersQuery;
                        if (recentOrders && recentOrders.length > 0) {
                            return 'DUPLICATE PREVENTED. Do not save again. Confirm the order warmly.';
                        }

                        // Try to get the instagram handle from activity log
                        let handle = 'Customer';
                        if (chatId) {
                            const { data: lastMsg } = await supabase
                                .from('activity_log').select('metadata')
                                .eq('user_id', userId)
                                .filter('metadata->>chat_id', 'eq', chatId)
                                .order('timestamp', { ascending: false })
                                .limit(1).maybeSingle();
                            if (lastMsg?.metadata?.username) handle = lastMsg.metadata.username;
                        }

                        const { error } = await supabase.from('orders').insert({
                            user_id: userId,
                            workspace_id: workspaceId || null,
                            instagram_user_id: chatId || null,
                            instagram_handle: handle,
                            status: 'Pending',
                            created_at: new Date().toISOString(),
                            customer_name: name,
                            customer_phone: phone,
                            customer_email: a?.email || null,
                            item_requested: item,
                            customer_address: address,
                            raw_message: JSON.stringify({ item_variant: a?.variant || null, payment_method: a?.payment_method || 'Cash on Delivery' }),
                        });

                        if (error) {
                            console.error('❌ [E-COMMERCE] Supabase Insert Error:', JSON.stringify(error));
                            throw error;
                        }

                        console.log('✅ [E-COMMERCE] Order saved successfully!');
                        return `Order saved for "${item}". Now reply to the customer in their language confirming the order is registered and will be delivered soon.`;
                    } catch (err: any) {
                        console.error('❌ [E-COMMERCE] Failed to save transaction:', err);
                        return 'Database error. Apologize briefly and tell the customer to message again.';
                    }
                }
            };

            if (workspaceId) {
                toolsMapping['check_ecommerce_inventory'] = checkEcommerceInventoryTool(workspaceId);
            }

        // ── 9. First AI pass ─────────────────────────────────────────────────
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

        let result = await generateText({
            model: groq(selectedModel),
            system: systemPrompt,
            messages,
            tools: toolsMapping,
            toolChoice: 'auto',
            temperature: 0.15,
        });

        if (result.usage) {
            const { promptTokens, completionTokens, totalTokens } = result.usage as any;
            console.log(`📊 [Usage P1] Tokens: ${promptTokens}in / ${completionTokens}out — Total: ${totalTokens}`);
        }

        // ── 10. Second pass: convert tool result into a conversational reply ─
        const toolCalls = result.toolCalls || [];
        const toolResults = (result as any).toolResults || [];

        if (toolCalls.length > 0 && toolResults.length > 0) {
            console.log('[E-COMMERCE] Tool executed. Running second pass for conversational reply...');

            // Only include tool calls that have a matching result (prevents Zod crash when a tool fails)
            const matchedToolCalls = toolCalls.filter((tc: any) =>
                toolResults.some((tr: any) => tr.toolCallId === tc.toolCallId)
            );
            const matchedToolResults = toolResults.filter((tr: any) =>
                toolCalls.some((tc: any) => tc.toolCallId === tr.toolCallId)
            );

            const secondPassMessages: any[] = [
                ...messages,
                {
                    role: 'assistant',
                    content: matchedToolCalls.map((tc: any) => ({
                        type: 'tool-call',
                        toolCallId: tc.toolCallId,
                        toolName: tc.toolName,
                        args: tc.args,
                    })),
                },
                {
                    role: 'tool',
                    content: matchedToolResults.map((tr: any) => ({
                        type: 'tool-result',
                        toolCallId: tr.toolCallId,
                        toolName: tr.toolName,
                        result: typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result),
                    })),
                },
            ];

            const secondPass = await generateText({
                model: groq('llama-3.3-70b-versatile'),
                system: systemPrompt,
                messages: secondPassMessages,
                temperature: 0.15,
            });

            if (secondPass.usage) {
                const { promptTokens, completionTokens, totalTokens } = secondPass.usage as any;
                console.log(`📊 [Usage P2] Tokens: ${promptTokens}in / ${completionTokens}out — Total: ${totalTokens}`);
            }

            // Fire-and-forget memory tracking
            if (chatId && fullHistory.length > 0) {
                trackConversationMessage(supabase, userId, chatId, workspaceId).catch(console.error);
                summarizeConversationIfNeeded(supabase, userId, chatId, fullHistory, workspaceId).catch(console.error);
            }

            return secondPass.text?.replace(/finalize_transaction/g, '').trim() || null;
        }

        // ── 11. Return direct text reply ─────────────────────────────────────
        if (chatId && fullHistory.length > 0) {
            trackConversationMessage(supabase, userId, chatId, workspaceId).catch(console.error);
            summarizeConversationIfNeeded(supabase, userId, chatId, fullHistory, workspaceId).catch(console.error);
        }

        return (result.text || '').replace(/finalize_transaction/g, '').trim() || null;

    } catch (error: any) {
        if (error?.statusCode === 429) {
            console.warn('⚠️ [E-COMMERCE] Rate limited. Staying silent.');
            return null;
        }
        console.error('❌ [E-COMMERCE] Fatal error:', error);
        return null;
    }
}
