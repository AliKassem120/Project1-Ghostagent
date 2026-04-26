import { BusinessProfile } from '../types';
import { GHOST_AGENT_MASTER_KNOWLEDGE } from '../master-knowledge';
import { getConversationMemory, summarizeConversationIfNeeded, trackConversationMessage } from '../../rolling-memory';
import { classifyEcommerceIntent, EcommerceIntent } from './intent';
import {
    finalizeEcommerceOrder,
    findRecentCustomerOrder,
    searchInventory,
} from './tools';
import { 
    getConversationState, 
    updateConversationState, 
    clearConversationState, 
    ConversationState 
} from '@/lib/conversation-state';
import { ECOM_TEMPLATES, applyTemplate } from '../templates';
import { validateReply } from '@/lib/automation/reply-validator';

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
        // Optional table
    }
}

async function loadBusinessProfile(args: { supabase: any; userId: string; workspaceId?: string }): Promise<BusinessProfile> {
    const { supabase, userId, workspaceId } = args;

    let settingsQuery = supabase
        .from('ai_settings')
        .select('business_name, business_type, tone, system_instructions, urgency_mode, handoff_keywords, language, store_location, contact_info, use_emojis, use_local_slang, shipping_rules, max_discount, min_order_for_discount, timezone');

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
        max_discount: settings?.max_discount || null,
        min_order_for_discount: settings?.min_order_for_discount || null,
        timezone: settings?.timezone || null,
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
        console.log(`[ECOMMERCE_CONNECTION_CONTEXT] Using ai_settings for workspace: ${workspaceId || 'personal'}`);
        const cleanMessage = cleanMessageText(userMessage);

        if (Array.isArray(business.handoff_keywords) && business.handoff_keywords.some(
            (kw: string) => cleanMessage.toLowerCase().includes(kw.toLowerCase())
        )) {
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

        // Load state
        let state: ConversationState = { stage: 'idle', data: {} };
        if (chatId && workspaceId) {
            state = await getConversationState(supabase, userId, workspaceId, chatId, 'ecommerce');
        }

        const intent = await classifyEcommerceIntent({
            message: cleanMessage,
            historyContext,
            contextSummary,
            businessLanguage: business.language,
        });

        if (!intent.customer_phone) {
            intent.customer_phone = extractPhoneFallback(cleanMessage);
        }

        if (intent.intent === 'human_handoff') return null;

        const replyWithTruth = async (truth: any, constraints: string[] = [], templateKey?: keyof typeof ECOM_TEMPLATES, templateData: Record<string, any> = {}) => {
            const isActuallyConfirmed = !!(truth.checkout_status === 'processed');
            
            let truthWithTemplate = { ...truth };
            if (templateKey) {
                const template = ECOM_TEMPLATES[templateKey];
                truthWithTemplate.templated_reply = applyTemplate(template, templateData);
            }
            const baseResponse = truthWithTemplate.templated_reply || ECOM_TEMPLATES.GREETING;
            const validation = validateReply({
                userMessage: cleanMessage,
                reply: baseResponse,
                templateReply: baseResponse,
                orderInsertSuccess: isActuallyConfirmed,
            });
            const response = validation.safeReply;

            await safeTrackMemory({ supabase, userId, chatId, workspaceId, fullHistory });
            await logAutomationEvent({ supabase, userId, workspaceId, chatId, intent, truth, reply: response });
            return response;
        };

        const performOrder = async (data: any) => {
            console.log("[ORDER_CREATE_ATTEMPT]", data);
            const orderResult = await finalizeEcommerceOrder({
                supabase,
                userId,
                workspaceId,
                chatId,
                name: data.customerName,
                phone: data.customerPhone,
                address: data.deliveryAddress,
                item: data.productName,
                variant: data.variantLabel,
                payment_method: 'Cash on Delivery',
            });
            console.log(`[ECOMMERCE_CONNECTION_CONTEXT] Order creation result: ${orderResult.ok ? 'SUCCESS' : 'FAILED'} (workspace: ${workspaceId})`);

            if (orderResult.ok) {
                console.log("[ORDER_CREATE_SUCCESS]", { orderId: orderResult.order?.id, workspaceId, productId: data.productId });
                await clearConversationState(supabase, userId, workspaceId!, chatId!, 'ecommerce');
                return replyWithTruth({ checkout_status: 'processed', order_result: orderResult }, [], 'ORDER_CONFIRMED', { orderId: orderResult.order?.id });
            } else {
                console.error("[ORDER_CREATE_ERROR]", { input: data, error: orderResult.error });
                return replyWithTruth({ checkout_status: 'blocked', order_result: orderResult }, [], 'ORDER_ERROR', { error: orderResult.message });
            }
        };

        switch (intent.intent) {
            case 'greeting':
                return replyWithTruth({ outcome: 'greeting_only' }, [], 'GREETING');


            case 'gratitude_goodbye':
                return replyWithTruth({ outcome: 'customer_thanked_or_closed_conversation' });

            case 'location_question':
                return replyWithTruth({ location: business.store_location, contact: business.contact_info });

            case 'product_availability':
            case 'product_price':
            case 'product_variants':
            case 'product_details': {
                const inventory = await searchInventory({
                    supabase,
                    userId,
                    workspaceId,
                    productName: intent.product_name,
                    limit: intent.product_name ? 10 : 5,
                });

                console.log("[ECOM_BOT_CONTEXT]", { workspaceId, chatId, intent, productQuery: intent.product_name, products: inventory.items });

                return replyWithTruth({
                    requested_product: intent.product_name,
                    requested_variant: intent.variant,
                    products: inventory.items,
                    catalog_excerpt: truncate(await loadCatalogContext({ supabase, userId, workspaceId })),
                });
            }

            case 'purchase_intent':
            case 'checkout_info': {
                const productName = intent.product_name || state.data.productName;
                const variantLabel = intent.variant || state.data.variantLabel;
                
                if (!productName) {
                    return replyWithTruth({ needs_product: true }, [], 'GREETING');
                }

                // Search to confirm existence and variants
                const inventory = await searchInventory({ supabase, userId, workspaceId, productName, limit: 1 });
                const product = inventory.items[0];

                console.log("[PRODUCT_RESOLUTION]", {
                    rawUserText: cleanMessage,
                    requestedProduct: productName,
                    matchedProduct: product ? { id: product.id, name: product.item_name } : null,
                    confidence: product ? 'high' : 'none',
                });

                if (!product) {
                    console.error("[ORDER_SAVE_BLOCKED_UNKNOWN_PRODUCT]", { rawUserText: cleanMessage, productName, state });
                    return replyWithTruth({ product_not_found: true, productName }, [], 'HUMAN_HANDOFF');
                }

                // If variant required but missing
                if (product.variants && product.variants.length > 0 && !variantLabel) {
                    return replyWithTruth({ needs_variant: true, product }, [], 'ASK_PRODUCT_VARIANT');
                }

                const customerName = intent.customer_name || state.data.customerName;
                const customerPhone = intent.customer_phone || state.data.customerPhone;
                const deliveryAddress = intent.customer_address || state.data.deliveryAddress;

                const pendingData = {
                    workspaceId: workspaceId!,
                    productId: product.id,
                    productName: product.item_name,
                    variantLabel,
                    quantity: 1,
                    price: product.price,
                    customerName,
                    customerPhone,
                    deliveryAddress
                };

                // Determine missing fields
                const missingOrderFields: string[] = [];
                if (!customerName) missingOrderFields.push('customerName');
                if (!customerPhone) missingOrderFields.push('customerPhone');
                if (!deliveryAddress) missingOrderFields.push('deliveryAddress');

                // If we have EVERYTHING and were waiting for details, create order now.
                if (missingOrderFields.length === 0 && state.stage === 'awaiting_order_details') {
                    console.log("[ORDER_SAVE_INPUT] All details collected, proceeding.", pendingData);
                    return await performOrder(pendingData);
                }

                // If details are missing — save state and ask. NEVER fall through to create order.
                if (missingOrderFields.length > 0) {
                    console.warn("[ORDER_SAVE_BLOCKED_MISSING_FIELDS]", {
                        event: "order_create_blocked",
                        reason: "missing_required_fields",
                        missingFields: missingOrderFields,
                        pendingData,
                    });
                    await updateConversationState(supabase, userId, workspaceId!, chatId!, 'ecommerce', {
                        stage: 'awaiting_order_details',
                        data: pendingData
                    });
                    return replyWithTruth({ missing_details: true, pendingData, missingFields: missingOrderFields }, [], 'NEED_ORDER_DETAILS');
                }

                // If we have everything and stage is fresh (not awaiting_order_details), create order.
                console.log("[ORDER_SAVE_INPUT] All details present on first pass.", pendingData);
                return await performOrder(pendingData);
            }

            case 'order_status': {
                const lookup = await findRecentCustomerOrder({
                    supabase,
                    userId,
                    workspaceId,
                    chatId,
                    phone: intent.order_lookup_phone || intent.customer_phone,
                    name: intent.order_lookup_name || intent.customer_name,
                });
                return replyWithTruth({ order_found: !!lookup.order, order: lookup.order });
            }

            default:
                return replyWithTruth({ 
                    outcome: 'unknown_or_general_question',
                    custom_instructions: business.system_instructions,
                    catalog_excerpt: truncate(await loadCatalogContext({ supabase, userId, workspaceId })),
                    location: business.store_location,
                    contact: business.contact_info,
                });
        }
    } catch (error: any) {
        console.error('[E-COMMERCE] Fatal error:', error);
        return null;
    }
}
