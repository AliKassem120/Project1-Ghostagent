import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { BusinessProfile } from '../types';
import { GHOST_AGENT_MASTER_KNOWLEDGE } from '../master-knowledge';
import { getConversationMemory, summarizeConversationIfNeeded, trackConversationMessage } from '../../rolling-memory';
import { classifyEcommerceIntent, EcommerceIntent } from './intent';
import { buildEnterpriseFinalReplyPrompt, buildFinalReplyUserPrompt, cleanResponseText } from './prompt';
import {
    finalizeEcommerceOrder,
    findRecentCustomerOrder,
    getMissingCheckoutFields,
    searchInventory,
} from './tools';

function cleanMessageText(message: string): string {
    return message.replace(/\[ATTACHMENT:.*?\]/g, '').trim() || 'Hello';
}

function truncate(value: string | null | undefined, max = 2500): string | null {
    if (!value) return null;
    return value.length > max ? `${value.slice(0, max)}...` : value;
}

function extractPhoneFallback(text: string): string | null {
    const match = text.match(/(?:\+?\d[\d\s().-]{6,}\d)/);
    return match ? match[0].replace(/\s+/g, ' ').trim() : null;
}

function chooseFinalModel(intent: EcommerceIntent): string {
    const highAccuracyIntents = new Set([
        'purchase_intent',
        'checkout_info',
        'order_status',
        'complaint',
        'cancel_order',
        'return_exchange_question',
    ]);
    return highAccuracyIntents.has(intent.intent) ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';
}

async function safeTrackMemory(args: {
    supabase: any;
    userId: string;
    chatId?: string;
    workspaceId?: string;
    fullHistory: any[];
}) {
    const { supabase, userId, chatId, workspaceId, fullHistory } = args;
    if (!chatId || !fullHistory?.length) return;
    trackConversationMessage(supabase, userId, chatId, workspaceId).catch(console.error);
    summarizeConversationIfNeeded(supabase, userId, chatId, fullHistory, workspaceId).catch(console.error);
}

async function logAutomationEvent(args: {
    supabase: any;
    userId: string;
    workspaceId?: string;
    chatId?: string;
    intent: EcommerceIntent;
    truth: unknown;
    reply: string | null;
}) {
    const { supabase, userId, workspaceId, chatId, intent, truth, reply } = args;
    try {
        await supabase.from('automation_events').insert({
            user_id: userId,
            workspace_id: workspaceId || null,
            chat_id: chatId || null,
            workspace_type: 'ecommerce',
            intent: intent.intent,
            confidence: intent.confidence,
            payload: { intent, truth, reply },
            created_at: new Date().toISOString(),
        });
    } catch {
        // Optional table. Do not break live replies if the migration is not installed yet.
    }
}

async function loadBusinessProfile(args: { supabase: any; userId: string; workspaceId?: string }): Promise<BusinessProfile> {
    const { supabase, userId, workspaceId } = args;

    let settingsQuery = supabase
        .from('ai_settings')
        .select('business_name, business_type, tone, system_instructions, urgency_mode, handoff_keywords, language, store_location, contact_info, use_emojis, use_local_slang, shipping_rules, is_autopilot_enabled');

    if (workspaceId) {
        settingsQuery = settingsQuery.eq('id', workspaceId);
    } else {
        settingsQuery = settingsQuery.eq('user_id', userId).is('id', null);
    }

    const { data: settings } = await settingsQuery.limit(1).maybeSingle();

    return {
        business_name: settings?.business_name || 'our store',
        business_type: 'ecommerce',
        tone: settings?.tone || 'Professional',
        system_instructions: settings?.system_instructions || null,
        language: settings?.language || 'Auto-Detect',
        store_location: settings?.store_location || null,
        contact_info: settings?.contact_info || null,
        use_emojis: settings?.use_emojis ?? true,
        use_local_slang: settings?.use_local_slang ?? false,
        urgency_mode: settings?.urgency_mode ?? false,
        handoff_keywords: settings?.handoff_keywords || [],
        shipping_rules: settings?.shipping_rules || null,
    };
}

async function loadCatalogContext(args: { supabase: any; userId: string; workspaceId?: string }) {
    const { supabase, userId, workspaceId } = args;
    let catalogContext = '';

    let knowledgeQuery = supabase.from('business_knowledge').select('content, file_name');
    if (workspaceId) knowledgeQuery = knowledgeQuery.eq('workspace_id', workspaceId);
    else knowledgeQuery = knowledgeQuery.eq('user_id', userId).is('workspace_id', null);

    const { data: knowledgeData } = await knowledgeQuery.maybeSingle();
    if (knowledgeData?.content) {
        try {
            catalogContext = `PRODUCT CATALOG:\n${JSON.stringify(JSON.parse(knowledgeData.content), null, 2)}`;
        } catch {
            catalogContext = `PRODUCT KNOWLEDGE:\n${knowledgeData.content}`;
        }
    }

    const { data: ownerUser } = await supabase.from('users').select('email').eq('id', userId).maybeSingle();
    if (ownerUser?.email?.toLowerCase() === 'alisalemkassem@gmail.com') {
        catalogContext += `\n\n--- GHOSTAGENT SAAS MASTER KNOWLEDGE ---\n${GHOST_AGENT_MASTER_KNOWLEDGE}`;
    }

    return catalogContext;
}

export async function generateEcommerceGhostReply(
    userId: string,
    userMessage: string,
    supabase: any,
    chatId?: string,
    workspaceId?: string,
    checkoutContext?: string
) {
    console.log('[E-COMMERCE BRAIN] Generating enterprise reply for', userId, workspaceId ? `(workspace: ${workspaceId})` : '');

    try {
        const business = await loadBusinessProfile({ supabase, userId, workspaceId });
        const cleanMessage = cleanMessageText(userMessage);

        if (Array.isArray(business.handoff_keywords) && business.handoff_keywords.some(
            (kw: string) => cleanMessage.toLowerCase().includes(kw.toLowerCase())
        )) {
            console.log('[E-COMMERCE] Handoff keyword detected. Pausing AI.');
            return null;
        }

        let historyContext = '';
        let contextSummary: string | null = null;
        let fullHistory: any[] = [];

        if (chatId) {
            const memory = await getConversationMemory(supabase, userId, chatId, workspaceId);
            contextSummary = memory.contextSummary;
            historyContext = memory.recentHistory;
            fullHistory = memory.fullHistory;
        }

        if (checkoutContext) {
            historyContext += `\n[SYSTEM NOTE: The customer submitted checkout/order form content: ${checkoutContext}]`;
        }

        if (chatId && fullHistory && fullHistory.length > 0) {
            const lastMsg = fullHistory[fullHistory.length - 1];
            if (lastMsg?.timestamp) {
                const hoursDiff = (Date.now() - new Date(lastMsg.timestamp).getTime()) / (1000 * 60 * 60);
                if (hoursDiff > 12) {
                    historyContext += `\n[SYSTEM EVENT: ${Math.floor(hoursDiff)} hours passed since the previous message. Treat this as a fresh session unless the customer clearly continues the old order.]`;
                }
            }
        }

        const catalogContext = await loadCatalogContext({ supabase, userId, workspaceId });
        const classifierMessage = checkoutContext
            ? `${cleanMessage}\n\nCheckout/order form content:\n${checkoutContext}`
            : cleanMessage;

        const intent = await classifyEcommerceIntent({
            message: classifierMessage,
            historyContext,
            contextSummary,
            businessLanguage: business.language,
        });

        if (!intent.customer_phone) {
            intent.customer_phone = extractPhoneFallback(classifierMessage);
        }

        console.log('[E-COMMERCE] Classified intent:', intent);

        if (intent.intent === 'human_handoff') {
            console.log('[E-COMMERCE] Human handoff requested. Pausing AI.');
            return null;
        }

        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

        const finishWithTruth = async (truth: unknown, constraints: string[] = []) => {
            const selectedModel = chooseFinalModel(intent);
            const final = await generateText({
                model: groq(selectedModel),
                system: buildEnterpriseFinalReplyPrompt({ business, intent, constraints }),
                prompt: buildFinalReplyUserPrompt({
                    customerMessage: cleanMessage,
                    intent,
                    truth,
                    contextSummary,
                    historyContext,
                }),
                temperature: 0.1,
            });

            const reply = cleanResponseText(final.text);
            if (final.usage) {
                const { promptTokens, completionTokens, totalTokens } = final.usage as any;
                console.log(`[E-COMMERCE Usage] ${selectedModel}: ${promptTokens}in / ${completionTokens}out / ${totalTokens}total`);
            }

            await safeTrackMemory({ supabase, userId, chatId, workspaceId, fullHistory });
            await logAutomationEvent({ supabase, userId, workspaceId, chatId, intent, truth, reply });
            return reply || null;
        };

        if (intent.intent === 'gratitude_goodbye') {
            return finishWithTruth(
                { outcome: 'customer_thanked_or_closed_conversation', should_restart_checkout: false },
                ['Do not offer products or restart checkout. Just acknowledge briefly.']
            );
        }

        if (intent.intent === 'greeting') {
            return finishWithTruth(
                { outcome: 'greeting_only', available_context: { business_name: business.business_name } },
                ['Greet briefly and invite the customer to ask about products or orders. Do not invent product facts.']
            );
        }

        if (intent.intent === 'location_question') {
            return finishWithTruth(
                { location: business.store_location, contact: business.contact_info },
                ['Answer only with provided location/contact. If location is missing, ask one short clarifying/handoff question.']
            );
        }

        if (intent.intent === 'shipping_question') {
            return finishWithTruth(
                { shipping_rules: business.shipping_rules, custom_instructions: business.system_instructions },
                ['Answer only from shipping_rules or custom_instructions. If delivery cost depends on area, ask for area.']
            );
        }

        if (intent.intent === 'payment_question') {
            return finishWithTruth(
                { custom_instructions: business.system_instructions, contact: business.contact_info },
                ['Answer only if payment methods are provided in business context. Otherwise say you can confirm with the team.']
            );
        }

        if (intent.intent === 'return_exchange_question' || intent.intent === 'complaint') {
            return finishWithTruth(
                {
                    issue_type: intent.intent,
                    custom_instructions: business.system_instructions,
                    contact: business.contact_info,
                },
                ['Be helpful and calm. Ask for order name/phone or a photo/details if needed. Do not promise a replacement unless policy says so.']
            );
        }

        if (intent.intent === 'order_status') {
            const lookup = await findRecentCustomerOrder({
                supabase,
                userId,
                workspaceId,
                chatId,
                phone: intent.order_lookup_phone || intent.customer_phone,
                name: intent.order_lookup_name || intent.customer_name,
            });

            return finishWithTruth(
                {
                    order_found: Boolean(lookup.order),
                    order: lookup.order,
                    lookup_error: lookup.error,
                    needs_identifier: !lookup.order && !chatId && !intent.order_lookup_phone && !intent.customer_phone && !intent.order_lookup_name && !intent.customer_name,
                },
                ['If no order is found, ask for the name or phone used for the order. Do not invent delivery status.']
            );
        }

        if (intent.intent === 'cancel_order') {
            const lookup = await findRecentCustomerOrder({
                supabase,
                userId,
                workspaceId,
                chatId,
                phone: intent.order_lookup_phone || intent.customer_phone,
                name: intent.order_lookup_name || intent.customer_name,
            });

            return finishWithTruth(
                { cancel_requested: true, order_found: Boolean(lookup.order), order: lookup.order },
                ['Do not cancel automatically in the reply. If order is found, say you will help cancel/confirm. If not found, ask for name or phone.']
            );
        }

        if (
            intent.intent === 'product_availability' ||
            intent.intent === 'product_price' ||
            intent.intent === 'product_variants' ||
            intent.intent === 'product_details'
        ) {
            const inventory = await searchInventory({
                supabase,
                userId,
                workspaceId,
                productName: intent.product_name,
                limit: intent.product_name ? 10 : 5,
            });

            return finishWithTruth(
                {
                    requested_product: intent.product_name,
                    requested_variant: intent.variant,
                    products: inventory.items,
                    inventory_error: inventory.error,
                    catalog_excerpt: truncate(catalogContext),
                },
                [
                    'For stock/price/variants, answer only from products in TRUTH.',
                    'If no exact product is clear and multiple products are listed, ask which item they mean.',
                    'Do not ask for name/address/phone unless the customer explicitly says they want to order.',
                ]
            );
        }

        if (intent.intent === 'purchase_intent' || intent.intent === 'checkout_info') {
            const item = [intent.product_name, intent.variant].filter(Boolean).join(' - ') || intent.product_name;
            const missingFields = getMissingCheckoutFields({
                item,
                name: intent.customer_name,
                phone: intent.customer_phone,
                address: intent.customer_address,
            });

            if (missingFields.length > 0) {
                return finishWithTruth(
                    {
                        checkout_status: 'missing_fields',
                        missing_fields: missingFields,
                        product: item,
                        extracted_customer: {
                            name: intent.customer_name,
                            phone: intent.customer_phone,
                            address: intent.customer_address,
                        },
                    },
                    ['Ask only for the missing fields. Do not confirm the order was saved. Keep it one short message.']
                );
            }

            const orderResult = await finalizeEcommerceOrder({
                supabase,
                userId,
                workspaceId,
                chatId,
                name: intent.customer_name,
                phone: intent.customer_phone,
                address: intent.customer_address,
                item,
                variant: intent.variant,
                payment_method: 'Cash on Delivery',
            });

            return finishWithTruth(
                { checkout_status: orderResult.ok ? 'processed' : 'blocked', order_result: orderResult },
                [
                    'If order_result.ok is true, confirm the order naturally.',
                    'If blocked because missing/product_not_found/out_of_stock/database_error, explain briefly and ask for the next needed info.',
                ]
            );
        }

        return finishWithTruth(
            {
                outcome: 'unknown_or_general_question',
                custom_instructions: business.system_instructions,
                catalog_excerpt: truncate(catalogContext),
                location: business.store_location,
                contact: business.contact_info,
                shipping_rules: business.shipping_rules,
            },
            ['Answer only if the business context clearly contains the answer. Otherwise ask one short clarifying question.']
        );
    } catch (error: any) {
        if (error?.statusCode === 429) {
            console.warn('[E-COMMERCE] Rate limited. Staying silent.');
            return null;
        }
        console.error('[E-COMMERCE] Fatal error:', error);
        return null;
    }
}
