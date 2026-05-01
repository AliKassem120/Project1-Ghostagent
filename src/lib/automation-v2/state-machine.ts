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
import type { AutomationInput, WorkspaceConfig, DetectedLanguage, ConversationStateV2 } from './types';
import { getConversationStateV2, updateConversationStateV2, clearConversationStateV2 } from './state';
import { loadActiveServices, findBestServiceMatch } from './appointments/services';
import { loadBusinessHours, getHoursForDay } from './appointments/hours';
import { checkAvailability } from './appointments/availability';
import { resolveDateTime } from './appointments/date-time';
import { createAppointmentV2 } from './appointments/create-appointment';
import { searchProducts, findBestProductMatch } from './ecommerce/products';
import { createOrderV2 } from './ecommerce/orders';
import { getKnownCustomerDetails } from './customer-history';
import { formatTime12, minutesToTime } from './time';
import { v2log } from './logger';

const AGENT_MODEL = 'llama-3.3-70b-versatile';

// ═══════════════════════════════════════════════════════════════
// BOOKING STATE MACHINE
// ═══════════════════════════════════════════════════════════════

const BookingExtractionSchema = z.object({
    service_name: z.string().optional().nullable().default(null),
    date_text: z.string().optional().nullable().default(null),
    customer_name: z.string().optional().nullable().default(null),
    customer_phone: z.string().optional().nullable().default(null),
    wants_to_confirm: z.boolean().optional().default(false),
});

export async function runBookingStateMachine(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage,
): Promise<{ reply: string; actions: string[]; dbWriteAttempted: boolean; dbWriteSuccess: boolean }> {

    // ── 1. Load all context with pure code ───────────────────
    const services = await loadActiveServices(input.supabase, input.workspaceId);
    const serviceList = services.map(s => `${s.name} ($${s.price}, ${s.durationMinutes}min)`).join(', ');
    const hours = await loadBusinessHours(input.supabase, input.workspaceId);
    const known = await getKnownCustomerDetails(input.supabase, input.workspaceId, input.chatId);

    const state = await getConversationStateV2(
        input.supabase, input.userId, input.workspaceId,
        input.chatId, 'appointments', input.platform
    );

    // ── 2. Use LLM ONLY to extract data (classifyWithLLM) ────
    let extracted;
    try {
        const result = await classifyWithLLM({
            schema: BookingExtractionSchema,
            systemPrompt: `Extract booking info from this customer message.
Our known services are: ${serviceList || 'none configured'}.
If they mention a service (even with typos or variations), extract it exactly as they wrote it into "service_name".
If they don't mention any service, leave it null.
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

    // ── 3. Merge extracted data into state ────────────────────
    const appt = state.appointment || { workspaceId: input.workspaceId };
    const cust = state.customer || {};

    // Service
    if (extracted.service_name && !appt.serviceName) {
        const match = findBestServiceMatch(services, extracted.service_name);
        if (match) {
            appt.serviceId = match.id;
            appt.serviceName = match.name;
            appt.servicePrice = match.price;
            appt.serviceDuration = match.durationMinutes;
        }
    }

    // Date/Time
    if (extracted.date_text && !appt.date) {
        const resolved = resolveDateTime(extracted.date_text, config.timezone);
        if (resolved.date) appt.date = resolved.date;
        if (resolved.time) appt.startTime = resolved.time;
    }

    // Customer details
    if (extracted.customer_name) cust.name = extracted.customer_name;
    if (extracted.customer_phone) cust.phone = extracted.customer_phone;
    if (known?.name && !cust.name) cust.name = known.name;
    if (known?.phone && !cust.phone) cust.phone = known.phone;

    // ── 4. State machine: what's missing? ────────────────────
    const missing: string[] = [];
    if (!appt.serviceName) missing.push('service');
    if (!appt.date || !appt.startTime) missing.push('datetime');
    if (!cust.name) missing.push('name');
    if (!cust.phone) missing.push('phone');

    // ── 5. Generate deterministic reply ──────────────────────
    let reply = '';
    let actions: string[] = [];
    let dbWriteAttempted = false;
    let dbWriteSuccess = false;

    if (!appt.serviceName) {
        // Service not found
        if (extracted.service_name) {
            // Customer asked for something specific we don't have — show top 3 closest
            const suggestions = services.slice(0, 3).map(s => s.name).join(', ');
            reply = services.length > 0
                ? `We don't have that one! Maybe you're looking for: ${suggestions}?`
                : "We don't have any services set up yet, sorry!";
        } else {
            // Customer was vague ("I want to book") — just ask, don't list everything
            reply = "Sure! What service are you looking for?";
        }
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform,
            { stage: 'awaiting_service', appointment: appt, customer: cust });

    } else if (!appt.date || !appt.startTime) {
        reply = `${appt.serviceName} — $${appt.servicePrice}! When works for you?`;
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform,
            { stage: 'awaiting_date_time', appointment: appt, customer: cust });

    } else if (!cust.name || !cust.phone) {
        reply = `Perfect, ${appt.serviceName} on ${appt.date} at ${formatTime12(appt.startTime!)}. Just need your name and phone number!`;
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform,
            { stage: 'awaiting_customer_details', appointment: appt, customer: cust });

    } else if (!extracted.wants_to_confirm && state.stage !== 'awaiting_booking_confirmation') {
        // All data collected, ask for confirmation
        reply = `Got it! ${appt.serviceName} on ${appt.date} at ${formatTime12(appt.startTime!)} for ${cust.name}. Should I confirm this?`;
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform,
            { stage: 'awaiting_booking_confirmation', appointment: appt, customer: cust });

    } else {
        // All data + confirmation → EXECUTE
        dbWriteAttempted = true;

        // Check slot first
        const slotCheck = await checkAvailability({
            supabase: input.supabase, workspaceId: input.workspaceId,
            date: appt.date!, startTime: appt.startTime!,
            durationMinutes: appt.serviceDuration || 30, businessHours: hours,
        });

        if (!slotCheck.available) {
            reply = slotCheck.reason === 'closed' ? "We're closed that day unfortunately. Any other day work?"
                : slotCheck.reason === 'outside_hours' ? "That time is outside our hours. Can you try a different one?"
                : "That slot is already taken. Would another time work?";
            // Keep state but reset to date selection
            await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform,
                { stage: 'awaiting_date_time', appointment: { ...appt, date: undefined, startTime: undefined }, customer: cust });
        } else {
            const [h, m] = appt.startTime!.split(':').map(Number);
            const endTime = minutesToTime(h * 60 + m + (appt.serviceDuration || 30));

            let handle = 'Customer';
            try {
                const { data } = await input.supabase.from('activity_log').select('metadata')
                    .eq('user_id', input.userId).filter('metadata->>chat_id', 'eq', input.chatId)
                    .order('timestamp', { ascending: false }).limit(1).maybeSingle();
                if (data?.metadata?.username) handle = data.metadata.username;
            } catch (_) { /* */ }

            const success = await createAppointmentV2({
                supabase: input.supabase, userId: input.userId, workspaceId: input.workspaceId,
                chatId: input.chatId, customerName: cust.name!, customerPhone: cust.phone!,
                serviceName: appt.serviceName!, date: appt.date!, startTime: appt.startTime!,
                endTime, durationMinutes: appt.serviceDuration || 30, instagramHandle: handle,
            });

            if (success) {
                dbWriteSuccess = true;
                reply = `You're all set! ${appt.serviceName} on ${appt.date} at ${formatTime12(appt.startTime!)} ✅ See you then!`;
                actions = ['appointment_created'];
                await clearConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform);
            } else {
                reply = "Something went wrong with the booking. Can you try again?";
            }
        }
    }

    return { reply, actions, dbWriteAttempted, dbWriteSuccess };
}

// ═══════════════════════════════════════════════════════════════
// ORDER STATE MACHINE
// ═══════════════════════════════════════════════════════════════

const OrderExtractionSchema = z.object({
    product_name: z.string().optional().nullable().default(null),
    customer_name: z.string().optional().nullable().default(null),
    customer_phone: z.string().optional().nullable().default(null),
    customer_address: z.string().optional().nullable().default(null),
    wants_to_confirm: z.boolean().optional().default(false),
});

export async function runOrderStateMachine(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage,
): Promise<{ reply: string; actions: string[]; dbWriteAttempted: boolean; dbWriteSuccess: boolean }> {

    const products = await searchProducts({ supabase: input.supabase, workspaceId: input.workspaceId });
    const catalog = products.map(p => `${p.itemName} ($${p.price}, ${p.stockLevel > 0 ? 'in stock' : 'OUT'})`).join(', ');
    const known = await getKnownCustomerDetails(input.supabase, input.workspaceId, input.chatId);

    const state = await getConversationStateV2(
        input.supabase, input.userId, input.workspaceId,
        input.chatId, 'ecommerce', input.platform
    );

    let extracted;
    try {
        const result = await classifyWithLLM({
            schema: OrderExtractionSchema,
            systemPrompt: `Extract order info from this customer message.
Our known products are: ${catalog || 'none'}.
If they mention a product (even with typos or variations), extract it exactly as they wrote it into "product_name".
If they don't mention any product, leave it null.
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

    // Product
    if (extracted.product_name && !order.productName) {
        const match = findBestProductMatch(products, extracted.product_name);
        if (match && match.stockLevel > 0) {
            order.productId = match.id;
            order.productName = match.itemName;
            order.unitPrice = match.price;
            order.quantity = 1;
        }
    }

    // Customer
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

    if (!order.productName) {
        if (extracted.product_name) {
            const match = findBestProductMatch(products, extracted.product_name);
            if (match && match.stockLevel <= 0) {
                reply = `${match.itemName} is out of stock right now, sorry!`;
            } else {
                const suggestions = products.slice(0, 3).map(p => p.itemName).join(', ');
                reply = products.length > 0
                    ? `We don't carry that one! Maybe you're looking for: ${suggestions}?`
                    : "We don't have any products listed at the moment.";
            }
        } else {
            reply = products.length > 0
                ? "Sure! What are you looking to order?"
                : "No products available at the moment.";
        }
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'ecommerce', input.platform,
            { stage: 'awaiting_product', order, customer: cust });

    } else if (!cust.name || !cust.phone || !cust.address) {
        const need: string[] = [];
        if (!cust.name) need.push('name');
        if (!cust.phone) need.push('phone');
        if (!cust.address) need.push('delivery address');
        reply = `Great choice! ${order.productName} — $${order.unitPrice}. Just need your ${need.join(' and ')} to proceed!`;
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'ecommerce', input.platform,
            { stage: 'awaiting_order_details', order, customer: cust });

    } else if (!extracted.wants_to_confirm && state.stage !== 'awaiting_checkout_confirmation') {
        reply = `Here's your order: ${order.productName} ($${order.unitPrice}) delivering to ${cust.address}. Should I confirm?`;
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'ecommerce', input.platform,
            { stage: 'awaiting_checkout_confirmation', order, customer: cust });

    } else {
        dbWriteAttempted = true;
        let handle = 'Customer';
        try {
            const { data } = await input.supabase.from('activity_log').select('metadata')
                .eq('user_id', input.userId).filter('metadata->>chat_id', 'eq', input.chatId)
                .order('timestamp', { ascending: false }).limit(1).maybeSingle();
            if (data?.metadata?.username) handle = data.metadata.username;
        } catch (_) { /* */ }

        const success = await createOrderV2({
            supabase: input.supabase, userId: input.userId, workspaceId: input.workspaceId,
            chatId: input.chatId, customerName: cust.name!, customerPhone: cust.phone!,
            customerAddress: cust.address!, itemRequested: order.productName!,
            variantLabel: order.variantLabel, unitPrice: order.unitPrice || 0,
            quantity: order.quantity || 1, instagramHandle: handle,
        });

        if (success) {
            dbWriteSuccess = true;
            reply = "Order placed! ✅ We'll get it to you soon!";
            actions = ['order_created'];
            await clearConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'ecommerce', input.platform);
        } else {
            reply = "Something went wrong placing the order. Can you try again?";
        }
    }

    return { reply, actions, dbWriteAttempted, dbWriteSuccess };
}
