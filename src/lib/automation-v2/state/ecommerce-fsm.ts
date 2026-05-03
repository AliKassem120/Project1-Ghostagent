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
import { createOrderV2 } from '../ecommerce/orders';
import { detectYesNo, extractPhone, extractNameAndPhone, extractAddress } from '../language';
import { getKnownCustomerDetails } from '../customer-history';
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
    const products = await searchProducts({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, query: ctx.message });
    const match = findBestProductMatch(products, ctx.message);

    if (!match) {
        if (products.length > 0) {
            const names = products.slice(0, 5).map(p => p.itemName).join(', ');
            return {
                replyText: t(`We have: ${names}. Which one?`, `3anna: ${names}. Aya wahad?`, ctx.language),
                nextStage: 'awaiting_product',
                nextData: state,
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

    if (customerName && customerPhone && customerAddress) {
        // All details known — go straight to confirmation
        const updatedState: EcommerceStateData = {
            ...state,
            stage: 'awaiting_checkout_confirmation',
            order: {
                ...state.order,
                productId: match.id,
                productName: match.itemName,
                unitPrice: match.price,
                quantity: state.order.quantity || 1,
            },
            customer: { ...state.customer, name: customerName, phone: customerPhone, address: customerAddress },
            missingFields: [],
        };
        return {
            replyText: t(
                `${match.itemName} — $${match.price}. Confirm order?`,
                `${match.itemName} — $${match.price}. T2akked el order?`,
                ctx.language
            ),
            nextStage: 'awaiting_checkout_confirmation',
            nextData: updatedState,
            actions: ['product_resolved', 'memory_used', 'asked_confirmation'],
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
            quantity: state.order.quantity || 1,
        },
        missingFields: [
            ...(!customerName ? ['customerName'] : []),
            ...(!customerPhone ? ['customerPhone'] : []),
            ...(!customerAddress ? ['deliveryAddress'] : []),
        ],
    };

    return {
        replyText: t(
            `${match.itemName} — $${match.price}, in stock. Send your name, phone, and delivery address.`,
            `${match.itemName} — $${match.price}, mawjoud. B3atle ismak, ra2mak w el 3nwen.`,
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

    const extractedName = name || state.customer.name;
    const extractedPhone = phone || state.customer.phone;
    const extractedAddress = address || state.customer.address;

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
        .eq('instagram_user_id', ctx.chatId)
        .eq('status', 'Pending')
        .order('created_at', { ascending: false })
        .limit(1);

    if (recentOrders && recentOrders.length > 0) {
        const lastCreated = new Date(recentOrders[0].created_at).getTime();
        if (Date.now() - lastCreated < 60_000) {
            return {
                replyText: t('Your order was already placed! ✅', 'Order-ak sar ma7jouz! ✅', ctx.language),
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
    const orderId = await createOrderV2({
        supabase: ctx.supabase,
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        chatId: ctx.chatId,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerAddress: customer.address,
        itemRequested: order.productName,
        variantLabel: order.variantLabel,
        unitPrice: order.unitPrice || 0,
        quantity: order.quantity || 1,
        instagramHandle: customer.instagramHandle || 'Customer',
    });

    if (orderId) {
        // Build post-action context for follow-up messages
        const now = new Date();
        const editableUntil = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
        const postContext: PostActionContext = {
            type: 'order',
            lastOrderId: orderId,
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
            replyText: t('Something went wrong with the order. Try again?', 'Fi 8alat bel order. Jarreb kamen?', ctx.language),
            nextStage: 'idle',
            nextData: null,
            actions: ['order_failed'],
            dbWriteAttempted: true,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }
}
