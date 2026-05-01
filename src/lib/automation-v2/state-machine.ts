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
    service_name: z.string().nullable().describe('Exact service name the customer wants, or null if not mentioned'),
    date_text: z.string().nullable().describe('Date/time text like "tomorrow 3pm", "monday 11am", or null'),
    customer_name: z.string().nullable().describe('Customer full name, or null if not provided'),
    customer_phone: z.string().nullable().describe('Customer phone number, or null if not provided'),
    wants_to_confirm: z.boolean().describe('True if customer said yes/confirm/book it/go ahead'),
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
            systemPrompt: `Extract booking info from this customer message. Our services: ${serviceList || 'none configured'}.
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
            reply = services.length > 0
                ? `We don't offer that. We have: ${serviceList}.`
                : "No services set up yet.";
        } else {
            reply = services.length > 0
                ? `What service? We have: ${serviceList}.`
                : "No services available right now.";
        }
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform,
            { stage: 'awaiting_service', appointment: appt, customer: cust });

    } else if (!appt.date || !appt.startTime) {
        reply = `${appt.serviceName} is $${appt.servicePrice}. When would you like to come?`;
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform,
            { stage: 'awaiting_date_time', appointment: appt, customer: cust });

    } else if (!cust.name || !cust.phone) {
        reply = `${appt.serviceName} on ${appt.date} at ${formatTime12(appt.startTime!)}. Can I get your name and phone?`;
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform,
            { stage: 'awaiting_customer_details', appointment: appt, customer: cust });

    } else if (!extracted.wants_to_confirm && state.stage !== 'awaiting_booking_confirmation') {
        // All data collected, ask for confirmation
        reply = `Book ${appt.serviceName} on ${appt.date} at ${formatTime12(appt.startTime!)} for ${cust.name}? (Yes/No)`;
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
            reply = slotCheck.reason === 'closed' ? "We're closed that day. Pick another?"
                : slotCheck.reason === 'outside_hours' ? "That's outside our hours. Try a different time?"
                : "That slot is taken. Try another time?";
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
                reply = `Booked! ${appt.serviceName} on ${appt.date} at ${formatTime12(appt.startTime!)}. See you then!`;
                actions = ['appointment_created'];
                await clearConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform);
            } else {
                reply = "Booking failed. Please try again.";
            }
        }
    }

    return { reply, actions, dbWriteAttempted, dbWriteSuccess };
}

// ═══════════════════════════════════════════════════════════════
// ORDER STATE MACHINE
// ═══════════════════════════════════════════════════════════════

const OrderExtractionSchema = z.object({
    product_name: z.string().nullable().describe('Product name the customer wants, or null'),
    customer_name: z.string().nullable().describe('Customer full name, or null'),
    customer_phone: z.string().nullable().describe('Customer phone number, or null'),
    customer_address: z.string().nullable().describe('Delivery address, or null'),
    wants_to_confirm: z.boolean().describe('True if customer said yes/confirm/go ahead'),
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
            systemPrompt: `Extract order info from this customer message. Our products: ${catalog || 'none'}.
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
                reply = `${match.itemName} is out of stock.`;
            } else {
                reply = products.length > 0
                    ? `We don't have that. We carry: ${catalog}.`
                    : "No products available right now.";
            }
        } else {
            reply = products.length > 0
                ? `What would you like? We have: ${catalog}.`
                : "No products available.";
        }
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'ecommerce', input.platform,
            { stage: 'awaiting_product', order, customer: cust });

    } else if (!cust.name || !cust.phone || !cust.address) {
        const need: string[] = [];
        if (!cust.name) need.push('name');
        if (!cust.phone) need.push('phone');
        if (!cust.address) need.push('delivery address');
        reply = `${order.productName} — $${order.unitPrice}. Send your ${need.join(', ')}.`;
        await updateConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'ecommerce', input.platform,
            { stage: 'awaiting_order_details', order, customer: cust });

    } else if (!extracted.wants_to_confirm && state.stage !== 'awaiting_checkout_confirmation') {
        reply = `Order: ${order.productName} ($${order.unitPrice}) to ${cust.address}. Confirm? (Yes/No)`;
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
            reply = "Order confirmed!";
            actions = ['order_created'];
            await clearConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'ecommerce', input.platform);
        } else {
            reply = "Order failed. Try again.";
        }
    }

    return { reply, actions, dbWriteAttempted, dbWriteSuccess };
}
