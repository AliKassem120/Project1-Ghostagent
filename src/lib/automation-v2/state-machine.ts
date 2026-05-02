/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — V6 State Machine: Deterministic Flow Control
 * ═══════════════════════════════════════════════════════════════
 *
 * The LLM extracts data. TypeScript controls the flow.
 * The AI CANNOT skip steps, hallucinate confirmations, or
 * invent phone numbers. Every reply is either hardcoded or
 * tightly constrained by what data is missing.
 */

import { z } from 'zod';
import { classifyWithLLM } from './model';
import type { AutomationInput, WorkspaceConfig, DetectedLanguage } from './types';
import { getConversationStateV2, updateConversationStateV2, clearConversationStateV2 } from './state';
import { loadActiveServices, findBestServiceMatch } from './appointments/services';
import { loadBusinessHours } from './appointments/hours';
import { checkAvailability } from './appointments/availability';
import { resolveDateTime } from './appointments/date-time';
import { createAppointmentV2 } from './appointments/create-appointment';
import { searchProducts, findBestProductMatch } from './ecommerce/products';
import { createOrderV2 } from './ecommerce/orders';
import { getKnownCustomerDetails } from './customer-history';
import { formatTime12, minutesToTime } from './time';
import { v2log } from './logger';
import { detectYesNo } from './language';

function wantsArabiziReply(language: DetectedLanguage, config: WorkspaceConfig): boolean {
    return language === 'arabizi'
        || language === 'mixed'
        || String(config.language || '').toLowerCase() === 'arabizi';
}

function isConfirming(message: string, extractedConfirm: boolean): boolean {
    if (extractedConfirm) return true;
    return detectYesNo(message) === 'yes';
}

function fmtPrice(price?: number | null): string {
    return `$${Number(price || 0)}`;
}

function serviceTimeLabel(date?: string, time?: string): string {
    if (!date || !time) return '';
    return `${date} at ${formatTime12(time)}`;
}

const BookingExtractionSchema = z.object({
    service_name: z.string().optional().nullable().default(null),
    date_text: z.string().optional().nullable().default(null),
    customer_name: z.string().optional().nullable().default(null),
    customer_phone: z.string().optional().nullable().default(null),
    wants_to_confirm: z.boolean().optional().default(false),
});

function bookingReply(args: {
    key: 'ask_service' | 'ask_time' | 'ask_details' | 'confirm' | 'created' | 'closed' | 'outside_hours' | 'taken' | 'error' | 'unknown_service';
    language: DetectedLanguage;
    config: WorkspaceConfig;
    serviceName?: string;
    servicePrice?: number;
    date?: string;
    time?: string;
    name?: string;
    suggestions?: string;
}): string {
    const ar = wantsArabiziReply(args.language, args.config);

    switch (args.key) {
        case 'ask_service':
            return ar ? 'Akid, aya service baddak?' : 'Sure! What service are you looking for?';
        case 'ask_time':
            return ar
                ? `${args.serviceName} — ${fmtPrice(args.servicePrice)}. Aya nhar w se3a?`
                : `${args.serviceName} — ${fmtPrice(args.servicePrice)}! When works for you?`;
        case 'ask_details':
            return ar
                ? `Tamem, ${args.serviceName} ${serviceTimeLabel(args.date, args.time)}. B3at esmak w ra2mak.`
                : `Perfect, ${args.serviceName} on ${serviceTimeLabel(args.date, args.time)}. Just need your name and phone number!`;
        case 'confirm':
            return ar
                ? `${args.serviceName} ${serviceTimeLabel(args.date, args.time)} la ${args.name}. N2akdo?`
                : `Got it! ${args.serviceName} on ${serviceTimeLabel(args.date, args.time)} for ${args.name}. Should I confirm this?`;
        case 'created':
            return ar
                ? `Tmm, t2akad el maw3ed ✅ ${args.serviceName} ${serviceTimeLabel(args.date, args.time)}.`
                : `You're all set! ${args.serviceName} on ${serviceTimeLabel(args.date, args.time)} ✅ See you then!`;
        case 'closed':
            return ar ? "Msakrin bhal nhar. Aya nhar tene byemshe?" : "We're closed that day unfortunately. Any other day work?";
        case 'outside_hours':
            return ar ? 'Hal wa2et barra dawemna. Jarreb wa2et tene?' : 'That time is outside our hours. Can you try a different one?';
        case 'taken':
            return ar ? 'Hal maw3ed ma7jouz. Fi wa2et tene?' : 'That slot is already taken. Would another time work?';
        case 'unknown_service':
            return ar
                ? (args.suggestions ? `Ma 3anna hayda. 3anna: ${args.suggestions}.` : 'Ma 3anna services set up halla2.')
                : (args.suggestions ? `We don't have that one! Maybe you're looking for: ${args.suggestions}?` : "We don't have any services set up yet, sorry!");
        case 'error':
        default:
            return ar ? 'Fi 8alat bel 7ajez. Jarreb kamen shway.' : 'Something went wrong with the booking. Can you try again?';
    }
}

export async function runBookingStateMachine(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage,
): Promise<{ reply: string; actions: string[]; dbWriteAttempted: boolean; dbWriteSuccess: boolean }> {
    const services = await loadActiveServices(input.supabase, input.workspaceId);
    const serviceList = services.map(s => `${s.name} ($${s.price}, ${s.durationMinutes}min)`).join(', ');
    const hours = await loadBusinessHours(input.supabase, input.workspaceId);
    const known = await getKnownCustomerDetails(input.supabase, input.workspaceId, input.chatId);

    const state = await getConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform);

    let extracted;
    try {
        const result = await classifyWithLLM({
            schema: BookingExtractionSchema,
            systemPrompt: `Extract booking info from this customer message.
Our known services are: ${serviceList || 'none configured'}.
Rules:
1. If they mention a service (even with typos), extract it into "service_name".
2. If they mention a date, day, or time (e.g. "Monday at 11am", "tomorrow", "bukra se3a 4", "tnen 11am"), extract it exactly into "date_text".
3. If they provide a name or phone number, extract those into "customer_name" and "customer_phone".
4. If they say "yes", "eh", "ee", "akid", "tamem", or "confirm" to confirm a booking, set "wants_to_confirm" to true.
If a piece of information is missing, leave its field as null.
Known customer: ${known ? `name=${known.name}, phone=${known.phone}` : 'new customer'}.`,
            userPrompt: `Customer said: "${input.message}"`,
            temperature: 0.1,
        });
        extracted = result || { service_name: null, date_text: null, customer_name: null, customer_phone: null, wants_to_confirm: false };
    } catch (e: any) {
        v2log.error('V6_BOOKING', 'Extraction failed', { error: e?.message });
        extracted = { service_name: null, date_text: null, customer_name: null, customer_phone: null, wants_to_confirm: false };
    }

    v2log.info('V6_BOOKING', 'Extracted', { extracted });

    const appt = state.appointment || { workspaceId: input.workspaceId };
    const cust = state.customer || {};

    if (extracted.service_name && !appt.serviceName) {
        const match = findBestServiceMatch(services, extracted.service_name);
        if (match) {
            appt.serviceId = match.id;
            appt.serviceName = match.name;
            appt.servicePrice = match.price;
            appt.serviceDuration = match.durationMinutes;
        }
    }

    const dateSource = extracted.date_text || input.message;
    const resolved = resolveDateTime(dateSource, config.timezone, appt.date, appt.startTime);
    if (!appt.date && resolved.date) appt.date = resolved.date;
    if (!appt.startTime && resolved.time) appt.startTime = resolved.time;

    if (extracted.customer_name) cust.name = extracted.customer_name;
    if (extracted.customer_phone) cust.phone = extracted.customer_phone;
    if (known?.name && !cust.name) cust.name = known.name;
    if (known?.phone && !cust.phone) cust.phone = known.phone;

    let reply = '';
    let actions: string[] = [];
    let dbWriteAttempted = false;
    let dbWriteSuccess = false;
    const confirmed = isConfirming(input.message, extracted.wants_to_confirm);

    if (!appt.serviceName) {
        if (extracted.service_name) {
            const suggestions = services.slice(0, 3).map(s => s.name).join(', ');
            reply = bookingReply({ key: 'unknown_service', language, config, suggestions });
        } else {
            reply = bookingReply({ key: 'ask_service', language, config });
        }
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform, { stage: 'awaiting_service', appointment: appt, customer: cust });
    } else if (!appt.date || !appt.startTime) {
        reply = bookingReply({ key: 'ask_time', language, config, serviceName: appt.serviceName, servicePrice: appt.servicePrice });
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform, { stage: 'awaiting_date_time', appointment: appt, customer: cust });
    } else if (!cust.name || !cust.phone) {
        reply = bookingReply({ key: 'ask_details', language, config, serviceName: appt.serviceName, date: appt.date, time: appt.startTime });
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform, { stage: 'awaiting_customer_details', appointment: appt, customer: cust });
    } else if (!confirmed && state.stage !== 'awaiting_booking_confirmation') {
        reply = bookingReply({ key: 'confirm', language, config, serviceName: appt.serviceName, date: appt.date, time: appt.startTime, name: cust.name || undefined });
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform, { stage: 'awaiting_booking_confirmation', appointment: appt, customer: cust });
    } else {
        dbWriteAttempted = true;

        const slotCheck = await checkAvailability({ supabase: input.supabase, workspaceId: input.workspaceId, date: appt.date!, startTime: appt.startTime!, durationMinutes: appt.serviceDuration || 30, businessHours: hours });

        if (!slotCheck.available) {
            reply = slotCheck.reason === 'closed'
                ? bookingReply({ key: 'closed', language, config })
                : slotCheck.reason === 'outside_hours'
                    ? bookingReply({ key: 'outside_hours', language, config })
                    : bookingReply({ key: 'taken', language, config });
            await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform, { stage: 'awaiting_date_time', appointment: { ...appt, date: undefined, startTime: undefined }, customer: cust });
        } else {
            const [h, m] = appt.startTime!.split(':').map(Number);
            const endTime = minutesToTime(h * 60 + m + (appt.serviceDuration || 30));
            let handle = 'Customer';
            try {
                const { data } = await input.supabase.from('activity_log').select('metadata').eq('user_id', input.userId).filter('metadata->>chat_id', 'eq', input.chatId).order('timestamp', { ascending: false }).limit(1).maybeSingle();
                if (data?.metadata?.username) handle = data.metadata.username;
            } catch (_) { /* ignore */ }

            const success = await createAppointmentV2({ supabase: input.supabase, userId: input.userId, workspaceId: input.workspaceId, chatId: input.chatId, customerName: cust.name!, customerPhone: cust.phone!, serviceName: appt.serviceName!, date: appt.date!, startTime: appt.startTime!, endTime, durationMinutes: appt.serviceDuration || 30, instagramHandle: handle });

            if (success) {
                dbWriteSuccess = true;
                reply = bookingReply({ key: 'created', language, config, serviceName: appt.serviceName, date: appt.date, time: appt.startTime });
                actions = ['appointment_created'];
                await clearConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform);
            } else {
                reply = bookingReply({ key: 'error', language, config });
            }
        }
    }

    return { reply, actions, dbWriteAttempted, dbWriteSuccess };
}

const OrderExtractionSchema = z.object({
    product_name: z.string().optional().nullable().default(null),
    customer_name: z.string().optional().nullable().default(null),
    customer_phone: z.string().optional().nullable().default(null),
    customer_address: z.string().optional().nullable().default(null),
    wants_to_confirm: z.boolean().optional().default(false),
});

function orderReply(args: {
    key: 'ask_product' | 'unknown_product' | 'out_of_stock' | 'ask_details' | 'confirm' | 'created' | 'error';
    language: DetectedLanguage;
    config: WorkspaceConfig;
    productName?: string;
    unitPrice?: number;
    address?: string;
    suggestions?: string;
}): string {
    const ar = wantsArabiziReply(args.language, args.config);

    switch (args.key) {
        case 'ask_product':
            return ar ? 'Akid, aya product baddak?' : 'Sure! What are you looking to order?';
        case 'unknown_product':
            return ar
                ? (args.suggestions ? `Ma 3anna hayda. 3anna: ${args.suggestions}.` : 'Ma 3anna products listed halla2.')
                : (args.suggestions ? `We don't carry that one! Maybe you're looking for: ${args.suggestions}?` : "We don't have any products listed at the moment.");
        case 'out_of_stock':
            return ar ? `${args.productName} ma fi halla2.` : `${args.productName} is out of stock right now, sorry!`;
        case 'ask_details':
            return ar
                ? `Tamem, ${args.productName} — ${fmtPrice(args.unitPrice)}. B3at esmak, ra2mak w 3nwenak.`
                : `Great choice! ${args.productName} — ${fmtPrice(args.unitPrice)}. Just need your name, phone, and delivery address to proceed!`;
        case 'confirm':
            return ar
                ? `Order: ${args.productName} ${fmtPrice(args.unitPrice)}, delivery 3a ${args.address}. N2akdo?`
                : `Here's your order: ${args.productName} (${fmtPrice(args.unitPrice)}) delivering to ${args.address}. Should I confirm?`;
        case 'created':
            return ar ? 'Tmm, t2akad el order ✅' : "Order placed! ✅ We'll get it to you soon!";
        case 'error':
        default:
            return ar ? 'Fi 8alat bel order. Jarreb kamen shway.' : 'Something went wrong placing the order. Can you try again?';
    }
}

export async function runOrderStateMachine(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage,
): Promise<{ reply: string; actions: string[]; dbWriteAttempted: boolean; dbWriteSuccess: boolean }> {
    const products = await searchProducts({ supabase: input.supabase, workspaceId: input.workspaceId });
    const catalog = products.map(p => `${p.itemName} ($${p.price}, ${p.stockLevel > 0 ? 'in stock' : 'OUT'})`).join(', ');
    const known = await getKnownCustomerDetails(input.supabase, input.workspaceId, input.chatId);
    const state = await getConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'ecommerce', input.platform);

    let extracted;
    try {
        const result = await classifyWithLLM({
            schema: OrderExtractionSchema,
            systemPrompt: `Extract order info from this customer message.
Our known products are: ${catalog || 'none'}.
Rules:
1. If they mention a product (even with typos), extract it into "product_name".
2. Lebanese Arabizi examples: "bde we7de ps5" means product_name="ps5". "we7de/wehde" means quantity one, not the product.
3. If they provide a name, phone number, or delivery address, extract those into "customer_name", "customer_phone", and "customer_address".
4. If they say "yes", "eh", "ee", "akid", "tamem", or "confirm" to confirm an order, set "wants_to_confirm" to true.
If a piece of information is missing, leave its field as null.
Known customer: ${known ? `name=${known.name}, phone=${known.phone}, address=${known.address}` : 'new'}.`,
            userPrompt: `Customer said: "${input.message}"`,
            temperature: 0.1,
        });
        extracted = result || { product_name: null, customer_name: null, customer_phone: null, customer_address: null, wants_to_confirm: false };
    } catch (e: any) {
        v2log.error('V6_ORDER', 'Extraction failed', { error: e?.message });
        extracted = { product_name: null, customer_name: null, customer_phone: null, customer_address: null, wants_to_confirm: false };
    }

    v2log.info('V6_ORDER', 'Extracted', { extracted });

    const order = state.order || { workspaceId: input.workspaceId };
    const cust = state.customer || {};

    if (extracted.product_name && !order.productName) {
        const match = findBestProductMatch(products, extracted.product_name);
        if (match && match.stockLevel > 0) {
            order.productId = match.id;
            order.productName = match.itemName;
            order.unitPrice = match.price;
            order.quantity = 1;
        }
    }

    if (extracted.customer_name) cust.name = extracted.customer_name;
    if (extracted.customer_phone) cust.phone = extracted.customer_phone;
    if (extracted.customer_address) cust.address = extracted.customer_address;
    if (known?.name && !cust.name) cust.name = known.name;
    if (known?.phone && !cust.phone) cust.phone = known.phone;
    if (known?.address && !cust.address) cust.address = known.address;

    let reply = '';
    let actions: string[] = [];
    let dbWriteAttempted = false;
    let dbWriteSuccess = false;
    const confirmed = isConfirming(input.message, extracted.wants_to_confirm);

    if (!order.productName) {
        if (extracted.product_name) {
            const match = findBestProductMatch(products, extracted.product_name);
            if (match && match.stockLevel <= 0) {
                reply = orderReply({ key: 'out_of_stock', language, config, productName: match.itemName });
            } else {
                const suggestions = products.slice(0, 3).map(p => p.itemName).join(', ');
                reply = orderReply({ key: 'unknown_product', language, config, suggestions });
            }
        } else {
            reply = products.length > 0 ? orderReply({ key: 'ask_product', language, config }) : orderReply({ key: 'unknown_product', language, config });
        }
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'ecommerce', input.platform, { stage: 'awaiting_product', order, customer: cust });
    } else if (!cust.name || !cust.phone || !cust.address) {
        reply = orderReply({ key: 'ask_details', language, config, productName: order.productName, unitPrice: order.unitPrice });
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'ecommerce', input.platform, { stage: 'awaiting_order_details', order, customer: cust });
    } else if (!confirmed && state.stage !== 'awaiting_checkout_confirmation') {
        reply = orderReply({ key: 'confirm', language, config, productName: order.productName, unitPrice: order.unitPrice, address: cust.address || undefined });
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'ecommerce', input.platform, { stage: 'awaiting_checkout_confirmation', order, customer: cust });
    } else {
        dbWriteAttempted = true;
        let handle = 'Customer';
        try {
            const { data } = await input.supabase.from('activity_log').select('metadata').eq('user_id', input.userId).filter('metadata->>chat_id', 'eq', input.chatId).order('timestamp', { ascending: false }).limit(1).maybeSingle();
            if (data?.metadata?.username) handle = data.metadata.username;
        } catch (_) { /* ignore */ }

        const success = await createOrderV2({ supabase: input.supabase, userId: input.userId, workspaceId: input.workspaceId, chatId: input.chatId, customerName: cust.name!, customerPhone: cust.phone!, customerAddress: cust.address!, itemRequested: order.productName!, variantLabel: order.variantLabel, unitPrice: order.unitPrice || 0, quantity: order.quantity || 1, instagramHandle: handle, rawMessage: input.message });

        if (success) {
            dbWriteSuccess = true;
            reply = orderReply({ key: 'created', language, config });
            actions = ['order_created'];
            await clearConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'ecommerce', input.platform);
        } else {
            reply = orderReply({ key: 'error', language, config });
        }
    }

    return { reply, actions, dbWriteAttempted, dbWriteSuccess };
}
