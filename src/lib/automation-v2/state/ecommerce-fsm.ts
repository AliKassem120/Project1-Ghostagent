/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — E-Commerce State Machine
 * ═══════════════════════════════════════════════════════════════
 * Deterministic FSM for the e-commerce order flow.
 * 
 * Flow: idle → awaiting_product → awaiting_variant (if needed) →
 *       awaiting_order_details → awaiting_checkout_confirmation →
 *       place_order → confirmed (only if DB succeeds) → idle
 *
 * Features:
 * - Duplicate action protection (60s dedup)
 * - Inventory re-verification at confirmation
 * - Post-action context for follow-up messages
 * - The LLM does NOT decide state transitions. This code does.
 */

import type { EcommerceStateData, FSMResult, PostActionContext } from './types';
import type { WorkspaceConfig } from '../types';
import { searchProducts, findBestProductMatch } from '../ecommerce/products';
import { extractProductCandidate } from '../ecommerce/extract-product';
import { getRecentConversationMessages, extractCustomerDetailsFromRecentMessages } from '../history/recent-messages';
import { llmExtractProduct } from '../llm-entity-extractor';
import { createOrderV2 } from '../ecommerce/orders';
import { detectYesNo, extractNameAndPhone, extractAddress } from '../language';
import { getKnownCustomerDetails } from '../customer-history';
import { upsertCustomer } from '../customer-store';
import { v2log } from '../logger';
import { SupabaseClient } from '@supabase/supabase-js';

interface FSMContext {
    supabase: SupabaseClient;
    userId: string;
    workspaceId: string;
    chatId: string;
    config: WorkspaceConfig;
    message: string;
    language: string;
    platform: 'instagram' | 'whatsapp';
}

function t(en: string, arabizi: string, lang: string): string {
    const isArabizi = lang === 'arabizi' || lang === 'lebanese franco' || lang === 'arabic' || lang === 'mixed';
    return isArabizi ? arabizi : en;
}

/**
 * Process a message through the e-commerce state machine.
 * Only called when there is an active (non-idle) state.
 */
export async function processEcommerceState(
    ctx: FSMContext,
    state: EcommerceStateData
): Promise<FSMResult> {
    const { message, language } = ctx;

    // ── Handle cancellation/rejection at any stage ─────────────
    const yesNo = detectYesNo(message);
    const msgLower = message.toLowerCase().trim();
    const isCancelWord = /\b(cancel|stop|la2|la|mish|bas|khalas|خلص|لا|الغ)\b/i.test(msgLower);

    if (isCancelWord && state.stage !== 'awaiting_checkout_confirmation') {
        return {
            replyText: t('No problem. Let me know if you need anything.', 'Wala yhemak. Khaberne eza bdk shi.', language),
            nextStage: 'idle',
            nextData: null,
            actions: ['cancelled_flow'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    switch (state.stage) {
        case 'awaiting_product':
            return await handleAwaitingProduct(ctx, state);

        case 'awaiting_variant':
            return await handleAwaitingVariant(ctx, state);

        case 'awaiting_order_details':
            return await handleAwaitingOrderDetails(ctx, state);

        case 'awaiting_checkout_confirmation':
            return await handleCheckoutConfirmation(ctx, state, yesNo);

        default:
            return {
                replyText: t('What can I help you with?', 'Kif fiyi se3dak?', language),
                nextStage: 'idle',
                nextData: null,
                actions: ['unknown_stage_reset'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
    }
}

// ── Stage Handlers ───────────────────────────────────────────

async function handleAwaitingProduct(
    ctx: FSMContext,
    state: EcommerceStateData
): Promise<FSMResult> {
    // ── Extract product candidate from natural language ──────
    const { productCandidate, quantity: extractedQty } = extractProductCandidate(ctx.message);
    const searchQuery = productCandidate || ctx.message;

    // Search with extracted candidate first, fallback to all products
    let products = await searchProducts({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, query: searchQuery });
    let match = findBestProductMatch(products, searchQuery);

    // If no match with candidate, try loading all products and matching against candidate
    if (!match && productCandidate) {
        const allProducts = await searchProducts({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, limit: 20 });
        match = findBestProductMatch(allProducts, searchQuery);
        if (!match && allProducts.length > 0) products = allProducts;
    }

    if (!match) {
        // ── LLM Fallback: extract product entity when fuzzy matching fails ──
        if (products.length > 0) {
            const productNames = products.map(p => p.itemName);
            const llmResult = await llmExtractProduct(ctx.message, productNames);

            if (llmResult && llmResult.confidence >= 0.5 && llmResult.product_candidate) {
                // Verify LLM candidate against DB (source of truth)
                const llmMatch = findBestProductMatch(products, llmResult.product_candidate);
                if (llmMatch) {
                    v2log.info('ECOM_FSM', 'LLM fallback matched product', {
                        candidate: llmResult.product_candidate,
                        matched: llmMatch.itemName,
                        confidence: llmResult.confidence,
                    });
                    match = llmMatch;
                    // Use LLM-extracted quantity if higher
                    if (llmResult.quantity > 1) {
                        state = { ...state, order: { ...state.order, quantity: llmResult.quantity } };
                    }
                    // Use LLM-extracted variant if provided
                    if (llmResult.variant) {
                        state = { ...state, order: { ...state.order, variantLabel: llmResult.variant } };
                    }
                }
            }
        }
    }

    // Update quantity from extraction
    const qty = extractedQty > 1 ? extractedQty : (state.order.quantity || 1);

    if (!match) {
        if (products.length > 0) {
            // Products exist but no match — ask clarification, STAY in awaiting_product
            const names = products.filter(p => p.stockLevel > 0).slice(0, 5).map(p => p.itemName).join(', ');
            return {
                replyText: t(`We have: ${names}. Which one?`, `3anna: ${names}. Aya wahad?`, ctx.language),
                nextStage: 'awaiting_product',
                nextData: { ...state, order: { ...state.order, quantity: qty } },
                actions: ['no_match_listed_products'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }
        return {
            replyText: t('That product is not available.', 'Ma fi hal product.', ctx.language),
            nextStage: 'idle',
            nextData: null,
            actions: ['product_not_found'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    if (match.stockLevel <= 0) {
        return {
            replyText: t(`${match.itemName} is out of stock.`, `${match.itemName} — ma fi halla2.`, ctx.language),
            nextStage: 'idle',
            nextData: null,
            actions: ['product_out_of_stock'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    // Product found and in stock — check if we have customer details already
    const known = await getKnownCustomerDetails(ctx.supabase, ctx.workspaceId, ctx.chatId);
    const customerName = known?.name || state.customer.name;
    const customerPhone = known?.phone || state.customer.phone;
    const customerAddress = known?.address || state.customer.address;

    // ── BUFFERED DETAILS: extract name/phone/address from same message ──
    // Handles: "Yeah i want it\nAli Kassem\n78820707\nBeirut"
    const { name: msgName, phone: msgPhone } = extractNameAndPhone(ctx.message);
    const msgAddress = extractAddress(ctx.message);

    const finalName = customerName || msgName;
    const finalPhone = customerPhone || msgPhone;
    const finalAddress = customerAddress || msgAddress;

    if (finalName && finalPhone && finalAddress) {
        // All details known — go straight to confirmation
        const updatedState: EcommerceStateData = {
            ...state,
            stage: 'awaiting_checkout_confirmation',
            order: {
                ...state.order,
                productId: match.id,
                productName: match.itemName,
                unitPrice: match.price,
                quantity: qty,
            },
            customer: { ...state.customer, name: finalName, phone: finalPhone, address: finalAddress },
            missingFields: [],
        };

        const actions = ['product_resolved', 'asked_confirmation'];
        if (msgName || msgPhone || msgAddress) actions.push('buffered_details_extracted');
        if (customerName || customerPhone || customerAddress) actions.push('memory_used');

        return {
            replyText: t(
                `${match.itemName} — $${match.price}. Confirm order?`,
                `${match.itemName} — $${match.price}. T2akked el order?`,
                ctx.language
            ),
            nextStage: 'awaiting_checkout_confirmation',
            nextData: updatedState,
            actions,
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    // Need customer details
    const updatedState: EcommerceStateData = {
        ...state,
        stage: 'awaiting_order_details',
        order: {
            ...state.order,
            productId: match.id,
            productName: match.itemName,
            unitPrice: match.price,
            quantity: qty,
        },
        customer: {
            ...state.customer,
            name: finalName,
            phone: finalPhone,
            address: finalAddress,
        },
        missingFields: [
            ...(!finalName ? ['customerName'] : []),
            ...(!finalPhone ? ['customerPhone'] : []),
            ...(!finalAddress ? ['deliveryAddress'] : []),
        ],
    };

    // Ask only for missing fields
    const missing = [];
    if (!finalName) missing.push(ctx.language === 'arabizi' ? 'ismak' : 'name');
    if (!finalPhone) missing.push(ctx.language === 'arabizi' ? 'ra2mak' : 'phone');
    if (!finalAddress) missing.push(ctx.language === 'arabizi' ? 'el 3nwen' : 'delivery address');

    return {
        replyText: t(
            `${match.itemName} — $${match.price}, in stock. Send your ${missing.join(', ')}.`,
            `${match.itemName} — $${match.price}, mawjoud. B3atle ${missing.join(' w ')}.`,
            ctx.language
        ),
        nextStage: 'awaiting_order_details',
        nextData: updatedState,
        actions: ['product_resolved', 'asked_order_details'],
        dbWriteAttempted: false,
        dbWriteSuccess: false,
        shouldReply: true,
    };
}

async function handleAwaitingVariant(
    ctx: FSMContext,
    state: EcommerceStateData
): Promise<FSMResult> {
    const updatedState: EcommerceStateData = {
        ...state,
        stage: 'awaiting_order_details',
        order: {
            ...state.order,
            variantLabel: ctx.message.trim(),
        },
    };

    return {
        replyText: t(
            'Got it. Send your name, phone, and delivery address.',
            'Tmm. B3atle ismak, ra2mak w el 3nwen.',
            ctx.language
        ),
        nextStage: 'awaiting_order_details',
        nextData: updatedState,
        actions: ['variant_selected'],
        dbWriteAttempted: false,
        dbWriteSuccess: false,
        shouldReply: true,
    };
}

async function handleAwaitingOrderDetails(
    ctx: FSMContext,
    state: EcommerceStateData
): Promise<FSMResult> {
    const { name, phone } = extractNameAndPhone(ctx.message);
    const address = extractAddress(ctx.message);

    let extractedName = name || state.customer.name;
    let extractedPhone = phone || state.customer.phone;
    let extractedAddress = address || state.customer.address;

    // ── "Already sent it" recovery ──────────────────────────
    // If user says "already sent it" / "sent above" / "check above" 
    // and we have no new data but DO have state data, use it
    const alreadySentPattern = /\b(already\s*sent|sent\s*(it|above)|check\s*above|I\s*sent\s*it|b3atton|b3attak|b3ata|same\s*info|use\s*my\s*info)\b/i;
    if (alreadySentPattern.test(ctx.message) && !name && !phone && !address) {
        
        let currentStateCustomer = { ...state.customer };

        // Attempt recent message recovery if data is completely missing
        if (!currentStateCustomer.name || !currentStateCustomer.phone || !currentStateCustomer.address) {
            const recentMsgs = await getRecentConversationMessages(ctx.supabase, ctx.workspaceId, ctx.chatId);
            const extracted = await extractCustomerDetailsFromRecentMessages(recentMsgs);
            if (extracted.customerName) currentStateCustomer.name = extracted.customerName;
            if (extracted.customerPhone) currentStateCustomer.phone = extracted.customerPhone;
            if (extracted.address) currentStateCustomer.address = extracted.address;
            
            // Sync the local variables so the rest of the function sees the recovered data
            state.customer = currentStateCustomer;
        }

        // Check if state now has partial data we can use
        if (state.customer.name || state.customer.phone || state.customer.address) {
            // We have partial data from previous messages — use it
            const stillMissing = [];
            if (!state.customer.name) stillMissing.push(ctx.language === 'arabizi' ? 'ismak' : 'name');
            if (!state.customer.phone) stillMissing.push(ctx.language === 'arabizi' ? 'ra2mak' : 'phone');
            if (!state.customer.address) stillMissing.push(ctx.language === 'arabizi' ? 'el 3nwen' : 'delivery address');

            if (stillMissing.length > 0) {
                return {
                    replyText: t(
                        `I have some of your info. I still need your ${stillMissing.join(', ')}.`,
                        `3ande ba3do. Bado ${stillMissing.join(' w ')}.`,
                        ctx.language
                    ),
                    nextStage: 'awaiting_order_details',
                    nextData: state,
                    actions: ['already_sent_partial_recovery'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                };
            }
            // All present — we fall through to the final confirmation below!
            // Update the extracted local constants so the final stage logic uses them
            extractedName = state.customer.name || extractedName;
            extractedPhone = state.customer.phone || extractedPhone;
            extractedAddress = state.customer.address || extractedAddress;
        } else {
            return {
                replyText: t(
                    'I couldn\'t find your info above. I need your name, phone, and delivery address to place the order.',
                    'Ma l2iton abel. B3atle ismak, ra2mak w el 3nwen la n2akked el order.',
                    ctx.language
                ),
                nextStage: 'awaiting_order_details',
                nextData: state,
                actions: ['already_sent_no_data'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }
    }

    // If user just says "yes"/"ok" without providing info, repeat the ask
    const yesNo = detectYesNo(ctx.message);
    if (yesNo === 'yes' && !name && !phone && !address) {
        return {
            replyText: t(
                'I need your name, phone, and delivery address to place the order.',
                'B3atle ismak, ra2mak w el 3nwen la n2akked el order.',
                ctx.language
            ),
            nextStage: 'awaiting_order_details',
            nextData: state,
            actions: ['repeated_ask_details'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    if (!extractedName || !extractedPhone || !extractedAddress) {
        const missing = [];
        if (!extractedName) missing.push(ctx.language === 'arabizi' ? 'ismak' : 'name');
        if (!extractedPhone) missing.push(ctx.language === 'arabizi' ? 'ra2mak' : 'phone');
        if (!extractedAddress) missing.push(ctx.language === 'arabizi' ? 'el 3nwen' : 'delivery address');

        // Save whatever we learned so far
        await upsertCustomer(ctx.supabase, ctx.workspaceId, ctx.chatId, ctx.platform, {
            name: extractedName || undefined,
            phone: extractedPhone || undefined,
            address: extractedAddress || undefined,
        });

        return {
            replyText: t(`I still need your ${missing.join(', ')}.`, `Bado ${missing.join(', ')}.`, ctx.language),
            nextStage: 'awaiting_order_details',
            nextData: {
                ...state,
                customer: {
                    ...state.customer,
                    name: extractedName,
                    phone: extractedPhone,
                    address: extractedAddress,
                },
            },
            actions: ['partial_details'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    // All details collected — ask for confirmation
    const updatedState: EcommerceStateData = {
        ...state,
        stage: 'awaiting_checkout_confirmation',
        customer: {
            ...state.customer,
            name: extractedName,
            phone: extractedPhone,
            address: extractedAddress,
        },
        missingFields: [],
    };

    // Save complete customer details immediately
    await upsertCustomer(ctx.supabase, ctx.workspaceId, ctx.chatId, ctx.platform, {
        name: extractedName,
        phone: extractedPhone,
        address: extractedAddress,
    });

    return {
        replyText: t(
            `${state.order.productName} x${state.order.quantity} — $${(state.order.unitPrice || 0) * (state.order.quantity || 1)}. Confirm?`,
            `${state.order.productName} x${state.order.quantity} — $${(state.order.unitPrice || 0) * (state.order.quantity || 1)}. T2akked?`,
            ctx.language
        ),
        nextStage: 'awaiting_checkout_confirmation',
        nextData: updatedState,
        actions: ['details_collected', 'asked_confirmation'],
        dbWriteAttempted: false,
        dbWriteSuccess: false,
        shouldReply: true,
    };
}

async function handleCheckoutConfirmation(
    ctx: FSMContext,
    state: EcommerceStateData,
    yesNo: 'yes' | 'no' | null
): Promise<FSMResult> {
    if (yesNo === 'no' || /\b(cancel|la2|la|mish|no)\b/i.test(ctx.message.toLowerCase())) {
        return {
            replyText: t('No problem. Let me know if you need anything.', 'Wala yhemak. Khaberne eza bdk shi.', ctx.language),
            nextStage: 'idle',
            nextData: null,
            actions: ['order_rejected'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    if (yesNo !== 'yes') {
        return {
            replyText: t('Would you like to confirm the order?', 'Badek t2akked el order?', ctx.language),
            nextStage: 'awaiting_checkout_confirmation',
            nextData: state,
            actions: ['asked_confirmation_again'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    // YES — pre-checks before order
    const { order, customer } = state;
    if (!order.productName || !customer.name || !customer.phone || !customer.address) {
        v2log.error('ECOM_FSM', 'Missing fields at confirmation stage', { state });
        return {
            replyText: t('Something went wrong. Let\'s start over.', 'Fi 8alat. Yalla mn el awal.', ctx.language),
            nextStage: 'idle',
            nextData: null,
            actions: ['missing_fields_at_confirm'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    // ── DUPLICATE PROTECTION ─────────────────────────────────
    // Check if same product was ordered by same customer in last 60s
    const { data: recentOrders } = await ctx.supabase
        .from('orders')
        .select('id, created_at')
        .eq('workspace_id', ctx.workspaceId)
        .or(`chat_id.eq.${ctx.chatId},instagram_user_id.eq.${ctx.chatId}`)
        .eq('status', 'Pending')
        .order('created_at', { ascending: false })
        .limit(1);

    if (recentOrders && recentOrders.length > 0) {
        const lastCreated = new Date(recentOrders[0].created_at).getTime();
        if (Date.now() - lastCreated < 60_000) {
            return {
                replyText: t('I already have this order.', 'Hal order mawjoud already.', ctx.language),
                nextStage: 'idle',
                nextData: null,
                actions: ['duplicate_prevented'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }
    }

    // ── INVENTORY RE-VERIFICATION ────────────────────────────
    if (order.productId) {
        const { data: currentStock } = await ctx.supabase
            .from('inventory')
            .select('stock_level')
            .eq('id', order.productId)
            .maybeSingle();

        if (currentStock && currentStock.stock_level <= 0) {
            return {
                replyText: t(
                    `Sorry, ${order.productName} just sold out! 😔`,
                    `Sorry, ${order.productName} kheles halla2! 😔`,
                    ctx.language
                ),
                nextStage: 'idle',
                nextData: null,
                actions: ['stock_depleted_at_confirm'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }
    }

    // ── CREATE ORDER ─────────────────────────────────────────
    const orderResult = await createOrderV2({
        supabase: ctx.supabase,
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        chatId: ctx.chatId,
        platform: ctx.platform,
        productId: order.productId,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerAddress: customer.address,
        itemRequested: order.productName,
        variantLabel: order.variantLabel,
        unitPrice: order.unitPrice || 0,
        quantity: order.quantity || 1,
        instagramHandle: customer.instagramHandle || 'Customer',
        rawMessage: ctx.message,
    });

    if (orderResult.success && orderResult.orderId) {
        // Build post-action context for follow-up messages
        const now = new Date();
        const editableUntil = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
        const totalPrice = (order.unitPrice || 0) * (order.quantity || 1);
        const postContext: PostActionContext = {
            type: 'order',
            lastOrderId: orderResult.orderId,
            productName: order.productName,
            variantLabel: order.variantLabel,
            quantity: order.quantity || 1,
            unitPrice: order.unitPrice || 0,
            orderStatus: 'Pending',
            customer: {
                name: customer.name!,
                phone: customer.phone!,
                address: customer.address,
            },
            createdAt: now.toISOString(),
            editableUntil,
        };

        // Log SALE event for revenue tracking on the dashboard
        try {
            await ctx.supabase.from('activity_log').insert({
                user_id: ctx.userId,
                workspace_id: ctx.workspaceId,
                event_type: 'SALE',
                description: `Order: ${order.productName} x${order.quantity || 1} — $${totalPrice}`,
                metadata: {
                    order_id: orderResult.orderId,
                    product_name: order.productName,
                    quantity: order.quantity || 1,
                    unit_price: order.unitPrice || 0,
                    total_price: totalPrice,
                    platform: ctx.platform,
                    chat_id: ctx.chatId,
                },
            });
        } catch (e) {
            v2log.warn('ECOM_FSM', 'Failed to log SALE event', { error: e });
        }

        return {
            replyText: t('Order confirmed! ✅', 'Tmm order-ak t2akkad! ✅', ctx.language),
            nextStage: 'idle',
            nextData: null,
            actions: ['order_created'],
            dbWriteAttempted: true,
            dbWriteSuccess: true,
            shouldReply: true,
            postContext,
        };
    } else {
        return {
            replyText: t('Something went wrong. Please try again.', 'Fi 8alat. Jarreb kamen.', ctx.language),
            nextStage: 'idle',
            nextData: null,
            actions: ['order_failed'],
            dbWriteAttempted: true,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }
}
