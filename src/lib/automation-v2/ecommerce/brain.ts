/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: E-Commerce Brain
 * ═══════════════════════════════════════════════════════════════
 * Main state machine for e-commerce businesses.
 * Follows the "State Before Classifier" rule.
 */

import { z } from 'zod';
import type { 
    AutomationInput, 
    AutomationResult, 
    WorkspaceConfig, 
    ConversationStateV2,
    DetectedLanguage
} from '../types';
import { getConversationStateV2, updateConversationStateV2, clearConversationStateV2 } from '../state';
import { searchProducts, findBestProductMatch } from './products';
import { checkProductStock } from './inventory';
import { createOrderV2 } from './orders';
import { detectLanguage, detectYesNo, extractNameAndPhone, extractAddress } from '../language';
import { ECOMMERCE_TEMPLATES, applyTemplate } from '../templates';
import { validateReply } from '../validator';
import { classifyWithLLM, translateReply } from '../model';
import { getKnownCustomerDetails } from '../customer-history';
import { v2log } from '../logger';

// ── Intent Schema ────────────────────────────────────────────

const EcommerceIntentSchema = z.object({
    intent: z.enum([
        'greeting',
        'purchase_intent',
        'product_availability',
        'price_question',
        'shipping_question',
        'location_question',
        'human_handoff',
        'gratitude',
        'unclear'
    ]),
    productName: z.string().nullable().optional(),
    variant: z.string().nullable().optional(),
    quantity: z.number().nullable().optional(),
});

type EcommerceIntent = z.infer<typeof EcommerceIntentSchema>;

// ── Main Handler ─────────────────────────────────────────────

export async function handleEcommerceMessage(
    input: AutomationInput,
    config: WorkspaceConfig
): Promise<AutomationResult> {
    const { supabase, userId, workspaceId, chatId, message } = input;
    const startTime = Date.now();

    const language = detectLanguage(message);
    const state = await getConversationStateV2(supabase, userId, workspaceId, chatId, 'ecommerce', input.platform);
    const stateBefore = state.stage;

    // Fetch permanent customer memory
    let knownCustomer: any = null;
    if (state.stage === 'idle') {
        knownCustomer = await getKnownCustomerDetails(supabase, workspaceId, chatId);
        if (knownCustomer) {
            v2log.info('V2_ECOMMERCE_BRAIN', 'Found historical customer details', { name: knownCustomer.name });
        }
    }

    v2log.ecommerce.context({ stateBefore, language, messagePreview: message.slice(0, 50) });

    let result: Partial<AutomationResult> = {
        shouldReply: true,
        actions: [],
        stateBefore,
    };

    // 1. STATE BEFORE CLASSIFIER RULE
    if (state.stage !== 'idle') {
        const processed = await processEcommerceState(input, config, state);
        if (processed) {
            result = { ...result, ...processed };
        }
    }

    // 2. IF STILL IDLE → CLASSIFY
    if (!result.replyText) {
        const intent = await classifyEcommerceIntent(message, config);
        const processed = await processEcommerceIntent(input, config, state, intent, knownCustomer);
        result = { ...result, ...processed };
    }

    // 3. POST-PROCESSING
    const isActuallyConfirmed = result.stateAfter === 'idle' && (result.actions || []).includes('order_created');
    const finalReply = await finalizeReply(result.replyText!, config, language, input.message, isActuallyConfirmed);

    return {
        shouldReply: result.shouldReply ?? true,
        replyText: finalReply,
        actions: result.actions || [],
        stateBefore,
        stateAfter: result.stateAfter || state.stage,
        debug: {
            requestId: '',
            engineVersion: 'v2',
            workspaceId,
            workspaceType: 'ecommerce',
            chatId,
            language,
            intent: result.debug?.intent,
            dbWriteAttempted: result.debug?.dbWriteAttempted ?? false,
            dbWriteSuccess: result.debug?.dbWriteSuccess ?? false,
            durationMs: Date.now() - startTime,
        },
    };
}

// ── State Processor ──────────────────────────────────────────

async function processEcommerceState(
    input: AutomationInput,
    config: WorkspaceConfig,
    state: ConversationStateV2
): Promise<Partial<AutomationResult> | null> {
    const { message, supabase, userId, workspaceId, chatId } = input;

    // Global cancel
    if (detectYesNo(message) === 'no' || message.toLowerCase().includes('cancel')) {
        await clearConversationStateV2(supabase, userId, workspaceId, chatId, 'ecommerce', input.platform);
        return { replyText: ECOMMERCE_TEMPLATES.REJECTION_ACK, stateAfter: 'idle', actions: ['flow_cancelled'] };
    }

    switch (state.stage) {
        case 'awaiting_product': {
            const products = await searchProducts({ supabase, workspaceId, query: message });
            const match = findBestProductMatch(products, message);
            if (match) {
                const stock = checkProductStock(match);
                const newState: ConversationStateV2 = {
                    ...state,
                    stage: match.variants?.length ? 'awaiting_variant' : 'awaiting_order_details',
                    order: {
                        workspaceId,
                        productId: match.id,
                        productName: match.itemName,
                        unitPrice: match.price,
                        quantity: 1
                    }
                };
                await updateConversationStateV2(supabase, userId, workspaceId, chatId, 'ecommerce', input.platform, newState);
                return {
                    replyText: match.variants?.length ? ECOMMERCE_TEMPLATES.ASK_VARIANT : ECOMMERCE_TEMPLATES.NEED_ORDER_DETAILS,
                    stateAfter: newState.stage,
                    actions: ['product_resolved']
                };
            }
            return { replyText: ECOMMERCE_TEMPLATES.ASK_PRODUCT, stateAfter: 'awaiting_product' };
        }

        case 'awaiting_variant': {
            const products = await searchProducts({ supabase, workspaceId, query: state.order?.productName });
            const product = products[0];
            if (product) {
                const stock = checkProductStock(product, message);
                if (stock.inStock) {
                    const newState: ConversationStateV2 = {
                        ...state,
                        stage: 'awaiting_order_details',
                        order: {
                            ...state.order,
                            workspaceId,
                            variantId: stock.variantMatch?.id || null,
                            variantLabel: stock.variantMatch?.label || stock.variantMatch?.name || message
                        }
                    };
                    await updateConversationStateV2(supabase, userId, workspaceId, chatId, 'ecommerce', input.platform, newState);
                    return {
                        replyText: ECOMMERCE_TEMPLATES.NEED_ORDER_DETAILS,
                        stateAfter: 'awaiting_order_details',
                        actions: ['variant_resolved']
                    };
                } else {
                    return {
                        replyText: applyTemplate(ECOMMERCE_TEMPLATES.PRODUCT_UNAVAILABLE, { variantLabel: message, alternatives: "We have other sizes/colors available." }),
                        stateAfter: 'awaiting_variant'
                    };
                }
            }
            return { replyText: ECOMMERCE_TEMPLATES.ASK_PRODUCT, stateAfter: 'awaiting_product' };
        }

        case 'awaiting_order_details': {
            const { name, phone } = extractNameAndPhone(message);
            const address = extractAddress(message);
            
            const customerName = name || state.customer?.name;
            const customerPhone = phone || state.customer?.phone;
            const customerAddress = address || state.customer?.address;

            if (customerName && customerPhone && customerAddress) {
                const newState: ConversationStateV2 = {
                    ...state,
                    stage: 'awaiting_checkout_confirmation',
                    customer: { name: customerName, phone: customerPhone, address: customerAddress }
                };
                await updateConversationStateV2(supabase, userId, workspaceId, chatId, 'ecommerce', input.platform, newState);
                return {
                    replyText: `Got it: ${customerName}, ${customerPhone}, ${customerAddress}. Confirm order for ${state.order?.productName}${state.order?.variantLabel ? ` (${state.order.variantLabel})` : ''}?`,
                    stateAfter: 'awaiting_checkout_confirmation',
                    actions: ['details_resolved']
                };
            }
            return { replyText: ECOMMERCE_TEMPLATES.NEED_ORDER_DETAILS, stateAfter: 'awaiting_order_details' };
        }

        case 'awaiting_checkout_confirmation': {
            if (detectYesNo(message) === 'yes') {
                // 1. Determine instagram_handle
                let handle = 'Customer';
                try {
                    const { data: lastMsg } = await supabase
                        .from('activity_log')
                        .select('metadata')
                        .eq('user_id', userId)
                        .filter('metadata->>chat_id', 'eq', chatId)
                        .order('timestamp', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    if (lastMsg?.metadata?.username) handle = lastMsg.metadata.username;
                } catch (e) {
                    v2log.warn('V2_ECOM_BRAIN', 'Failed to fetch handle for insert', { error: e });
                }

                // 2. Insert into DB
                const success = await createOrderV2({
                    supabase,
                    userId,
                    workspaceId,
                    chatId,
                    customerName: state.customer?.name!,
                    customerPhone: state.customer?.phone!,
                    customerAddress: state.customer?.address!,
                    itemRequested: state.order?.productName!,
                    variantLabel: state.order?.variantLabel,
                    unitPrice: state.order?.unitPrice || 0,
                    quantity: state.order?.quantity || 1,
                    instagramHandle: handle,
                    rawMessage: message
                });

                if (success) {
                    await clearConversationStateV2(supabase, userId, workspaceId, chatId, 'ecommerce', input.platform);
                    return {
                        replyText: ECOMMERCE_TEMPLATES.ORDER_CONFIRMED,
                        stateAfter: 'idle',
                        actions: ['order_created'],
                        debug: { dbWriteAttempted: true, dbWriteSuccess: true } as any
                    };
                } else {
                    return {
                        replyText: ECOMMERCE_TEMPLATES.ORDER_ERROR,
                        stateAfter: 'idle',
                        actions: ['order_failed'],
                        debug: { dbWriteAttempted: true, dbWriteSuccess: false } as any
                    };
                }
            }
            return { replyText: "Should I go ahead and place this order for you?", stateAfter: 'awaiting_checkout_confirmation' };
        }
    }

    return null;
}

// ── Intent Processor ─────────────────────────────────────────

async function processEcommerceIntent(
    input: AutomationInput,
    config: WorkspaceConfig,
    state: ConversationStateV2,
    intent: EcommerceIntent,
    knownCustomer?: any
): Promise<Partial<AutomationResult>> {
    const { supabase, userId, workspaceId, chatId, message } = input;

    switch (intent.intent) {
        case 'greeting':
            return { replyText: ECOMMERCE_TEMPLATES.GREETING, stateAfter: 'idle', debug: { intent: 'greeting' } as any };

        case 'purchase_intent':
        case 'product_availability': {
            const products = await searchProducts({ supabase, workspaceId, query: intent.productName });
            const match = intent.productName ? findBestProductMatch(products, intent.productName) : null;

            if (!match) {
                await updateConversationStateV2(supabase, userId, workspaceId, chatId, 'ecommerce', input.platform, { stage: 'awaiting_product' });
                return { replyText: ECOMMERCE_TEMPLATES.ASK_PRODUCT, stateAfter: 'awaiting_product', actions: ['flow_started'], debug: { intent: intent.intent } as any };
            }

            const stock = checkProductStock(match, intent.variant);
            const newState: ConversationStateV2 = {
                stage: match.variants?.length && !intent.variant ? 'awaiting_variant' : 'awaiting_order_details',
                order: {
                    workspaceId,
                    productId: match.id,
                    productName: match.itemName,
                    unitPrice: match.price,
                    quantity: intent.quantity || 1,
                    variantLabel: intent.variant || null
                }
            };

            if (stock.inStock) {
                if (intent.intent === 'product_availability' && !intent.variant && match.variants?.length) {
                    await updateConversationStateV2(supabase, userId, workspaceId, chatId, 'ecommerce', input.platform, newState);
                    return { replyText: applyTemplate(ECOMMERCE_TEMPLATES.PRODUCT_AVAILABLE, { variantLabel: match.itemName, priceInfo: `$${match.price}` }) + " " + ECOMMERCE_TEMPLATES.ASK_VARIANT, stateAfter: 'awaiting_variant', debug: { intent: 'product_availability' } as any };
                }
                
                // SMART MEMORY: If we already know the customer, pre-fill and skip to confirmation
                if (knownCustomer?.name && knownCustomer?.phone && knownCustomer?.address && newState.stage === 'awaiting_order_details') {
                    newState.stage = 'awaiting_checkout_confirmation';
                    newState.customer = {
                        name: knownCustomer.name,
                        phone: knownCustomer.phone,
                        address: knownCustomer.address
                    };
                    await updateConversationStateV2(supabase, userId, workspaceId, chatId, 'ecommerce', input.platform, newState);
                    return {
                        replyText: `Tmm — I have your details: ${knownCustomer.name}, ${knownCustomer.phone}, ${knownCustomer.address}. Confirm order for ${match.itemName}${intent.variant ? ` (${intent.variant})` : ''}?`,
                        stateAfter: 'awaiting_checkout_confirmation',
                        actions: ['flow_started', 'memory_used'],
                        debug: { intent: intent.intent } as any
                    };
                }

                await updateConversationStateV2(supabase, userId, workspaceId, chatId, 'ecommerce', input.platform, newState);
                return { 
                    replyText: applyTemplate(ECOMMERCE_TEMPLATES.PRODUCT_AVAILABLE, { variantLabel: intent.variant || match.itemName, priceInfo: `$${match.price}` }) + " " + (newState.stage === 'awaiting_variant' ? ECOMMERCE_TEMPLATES.ASK_VARIANT : ECOMMERCE_TEMPLATES.NEED_ORDER_DETAILS),
                    stateAfter: newState.stage,
                    debug: { intent: intent.intent } as any
                };
            } else {
                return { 
                    replyText: applyTemplate(ECOMMERCE_TEMPLATES.PRODUCT_UNAVAILABLE, { variantLabel: intent.variant || match.itemName, alternatives: "Check back later!" }),
                    stateAfter: 'idle',
                    debug: { intent: intent.intent } as any
                };
            }
        }

        case 'price_question': {
            const products = await searchProducts({ supabase, workspaceId, query: intent.productName });
            const match = intent.productName ? findBestProductMatch(products, intent.productName) : null;
            if (match) {
                return { replyText: applyTemplate(ECOMMERCE_TEMPLATES.PRODUCT_PRICE, { productName: match.itemName, price: `$${match.price}` }), stateAfter: 'idle', debug: { intent: 'price_question' } as any };
            }
            return { replyText: "Which product are you asking about?", stateAfter: 'idle' };
        }

        case 'shipping_question':
            return { replyText: applyTemplate(ECOMMERCE_TEMPLATES.SHIPPING_INFO, { shippingRules: config.shippingRules || "We ship nationwide!" }), stateAfter: 'idle', debug: { intent: 'shipping_question' } as any };

        case 'location_question':
            return { replyText: applyTemplate(ECOMMERCE_TEMPLATES.LOCATION, { location: config.storeLocation || 'our store' }), stateAfter: 'idle', debug: { intent: 'location_question' } as any };

        case 'human_handoff':
            return { shouldReply: false, stateAfter: 'handoff', actions: ['handoff'], debug: { intent: 'human_handoff' } as any };

        case 'gratitude':
            return { replyText: ECOMMERCE_TEMPLATES.GRATITUDE, stateAfter: 'idle', debug: { intent: 'gratitude' } as any };

        default:
            return { replyText: ECOMMERCE_TEMPLATES.UNCLEAR, stateAfter: 'idle', debug: { intent: 'unclear' } as any };
    }
}

// ── Classifier ───────────────────────────────────────────────

async function classifyEcommerceIntent(
    message: string,
    config: WorkspaceConfig
): Promise<EcommerceIntent> {
    const systemPrompt = `You are an AI assistant for "${config.businessName}", an e-commerce store.
Classify the user's intent and extract fields.

Intents:
- greeting
- purchase_intent: User wants to buy/order
- product_availability: User asking if item is in stock
- price_question
- shipping_question
- location_question
- human_handoff
- gratitude
- unclear

Extract:
- productName
- variant (size, color)
- quantity`;

    const userPrompt = `Message: "${message}"`;

    const result = await classifyWithLLM({
        systemPrompt,
        userPrompt,
        schema: EcommerceIntentSchema,
    });

    return result || { intent: 'unclear' };
}

// ── Finalizer ────────────────────────────────────────────────

async function finalizeReply(
    reply: string,
    config: WorkspaceConfig,
    detectedLang: DetectedLanguage,
    customerMsg: string,
    isConfirmed: boolean
): Promise<string> {
    const targetLang = config.language === 'Auto-Detect' ? detectedLang : config.language;
    let final = await translateReply({ reply, targetLanguage: targetLang, tone: config.tone });

    const validation = validateReply(final, { isConfirmed, customerMessage: customerMsg });
    if (!validation.isValid) {
        v2log.warn('V2_ECOM_BRAIN', `Validation failed: ${validation.reason}.`, { reply: final });
        return reply; // Fallback to template
    }

    return final;
}
