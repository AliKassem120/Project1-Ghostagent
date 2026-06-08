/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Tool Definitions
 * ═══════════════════════════════════════════════════════════════
 * Only tools that need DB access. The LLM handles everything
 * else (date parsing, greetings, general knowledge) natively.
 */

import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceConfig } from './types';

// ── Appointment imports ──────────────────────────────────────
import { loadActiveServices, findBestServiceMatch } from './appointments/services';
import { loadBusinessHours, getHoursForDay } from './appointments/hours';
import { checkAvailability } from './appointments/availability';
import { createAppointmentV2Structured } from './appointments/create-appointment';
import { cancelLatestAppointment, rescheduleAppointment, lookupLatestAppointment } from './appointments/lookup';
import { formatTime12, minutesToTime } from './time';

// ── E-Commerce imports ───────────────────────────────────────
import { searchProducts, findBestProductMatch } from './ecommerce/products';
import { createOrderV2 } from './ecommerce/orders';
import { cancelLatestOrder } from './ecommerce/lookup';

// ── WhatsApp imports ─────────────────────────────────────────
import { sendSingleProductCard } from '../whatsapp/catalog';
import { sendBookingFlow } from '../whatsapp/flows';
import { sendButtons, sendFlow } from '../whatsapp/send';

// ── Shared imports ───────────────────────────────────────────
import { getKnownCustomerDetails } from './customer-history';
import { upsertCustomer } from './customer-store';
import { upsertCustomerProfile } from './customer-profile';

// ═══════════════════════════════════════════════════════════════

export interface ToolContext {
    supabase: SupabaseClient;
    userId: string;
    workspaceId: string;
    chatId: string;
    config: WorkspaceConfig;
    platform: 'instagram' | 'whatsapp';
}

// ═══════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════

/** Parse any time string (HH:mm, H:mm AM/PM) to 24h format "HH:mm" */
function parseTimeTo24h(time: string): string {
    let h = 0;
    let m = 0;
    const timeMatch = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (timeMatch) {
        h = parseInt(timeMatch[1], 10);
        m = parseInt(timeMatch[2], 10);
        const ampm = timeMatch[3];
        if (ampm) {
            if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
            if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
        }
    } else {
        const parts = time.split(':');
        h = parseInt(parts[0], 10) || 0;
        m = parseInt(parts[1], 10) || 0;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Convert "HH:mm" to total minutes */
function parseTimeToMinutes(time24: string): number {
    const [h, m] = time24.split(':').map(Number);
    return h * 60 + m;
}

/** Resolve Instagram handle from activity logs — shared utility */
async function resolveInstagramHandle(ctx: ToolContext): Promise<string> {
    let handle = 'Customer';
    try {
        const { data } = await ctx.supabase
            .from('activity_log')
            .select('metadata')
            .eq('user_id', ctx.userId)
            .order('timestamp', { ascending: false })
            .limit(10);

        if (data && data.length > 0) {
            const relevantLogs = data.filter((l: any) =>
                l.metadata?.chat_id === ctx.chatId ||
                l.metadata?.chatId === ctx.chatId
            );
            const bestLog = relevantLogs.find((l: any) =>
                l.metadata?.username ||
                l.metadata?.commenter_name ||
                l.metadata?.sender?.attendee_name
            );
            if (bestLog) {
                handle = bestLog.metadata.username ||
                    bestLog.metadata.commenter_name ||
                    bestLog.metadata.sender?.attendee_name ||
                    handle;
            }
        }
    } catch (_e) { /* fallback to 'Customer' */ }
    return handle;
}

/** Export shared handle resolver so it can be used elsewhere */
export { resolveInstagramHandle };

// ═══════════════════════════════════════════════════════════════
// APPOINTMENT TOOLS
// ═══════════════════════════════════════════════════════════════

export function createAppointmentTools(ctx: ToolContext) {
    return {
        check_slot: {
            description: 'Check if a date/time slot is available for a service. Call BEFORE confirming any appointment.',
            inputSchema: z.object({
                date: z.string().describe('YYYY-MM-DD'),
                time: z.string().describe('HH:mm 24h'),
                service: z.string().describe('Service name'),
            }),
            execute: async ({ date, time, service }: { date: string; time: string; service: string }) => {
                const services = await loadActiveServices(ctx.supabase, ctx.workspaceId);
                const match = findBestServiceMatch(services, service);
                if (!match) return { available: false, reason: 'service_not_found', services_available: services.map(s => s.name) };
                const hours = await loadBusinessHours(ctx.supabase, ctx.workspaceId);
                const r = await checkAvailability({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, date, startTime: time, durationMinutes: match.durationMinutes, businessHours: hours });
                if (r.available) return { available: true, service: match.name, price: match.price, duration: match.durationMinutes, date, time: formatTime12(time) };
                if (r.reason === 'closed') { const dl = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }); return { available: false, reason: 'closed', message: `Closed on ${dl}` }; }
                if (r.reason === 'outside_hours') { const dow = new Date(`${date}T12:00:00`).getDay(); const h = getHoursForDay(hours, dow); return { available: false, reason: 'outside_hours', message: `Open ${h ? formatTime12(h.openTime) : '9 AM'} - ${h ? formatTime12(h.closeTime) : '5 PM'}` }; }
                return { available: false, reason: 'overlap', message: 'Slot taken' };
            },
        },
        book_appointment: {
            description: 'Create an appointment. Call ONLY after check_slot confirmed availability and customer confirmed.',
            inputSchema: z.object({
                name: z.string().describe('Customer full name'),
                phone: z.string().describe('Customer phone number'),
                service: z.string().describe('Service name'),
                date: z.string().describe('YYYY-MM-DD'),
                time: z.string().describe('HH:mm 24h'),
                address: z.string().describe('Optional. Leave empty if unknown'),
            }),
            execute: async ({ name, phone, service, date, time, address }: { name: string; phone: string; service: string; date: string; time: string; address?: string }) => {
                const services = await loadActiveServices(ctx.supabase, ctx.workspaceId);
                const match = findBestServiceMatch(services, service);
                if (!match) return { success: false, error: 'Service not found' };

                const startTime24 = parseTimeTo24h(time);
                const endTime = minutesToTime(parseTimeToMinutes(startTime24) + match.durationMinutes);
                let handle = await resolveInstagramHandle(ctx);

                const updateCustomerAfterBooking = async () => {
                    await upsertCustomer(ctx.supabase, ctx.workspaceId, ctx.chatId, ctx.platform, { name, phone, address: address || null }).catch(() => { });
                    await upsertCustomerProfile(ctx.supabase, ctx.workspaceId, ctx.chatId, ctx.platform, { name, phone, totalAppointments: 1 }).catch(() => { });
                };

                // STRATEGY: Safe RPC first (atomic overlap check + insert)
                // Direct insert only used when explicitly disabled via env var
                const useDirectInsert = process.env.USE_DIRECT_APPOINTMENT_INSERT === 'true';

                if (useDirectInsert) {
                    const result = await createAppointmentV2Structured({
                        supabase: ctx.supabase,
                        userId: ctx.userId,
                        workspaceId: ctx.workspaceId,
                        chatId: ctx.chatId,
                        platform: ctx.platform,
                        customerName: name,
                        customerPhone: phone,
                        serviceName: match.name,
                        date,
                        startTime: startTime24,
                        endTime,
                        durationMinutes: match.durationMinutes,
                        instagramHandle: handle,
                    });
                    if (result.success) {
                        await updateCustomerAfterBooking();
                    }
                    return { ...result, service: match.name, date, time: formatTime12(startTime24), price: match.price };
                }

                // RPC path (default — atomic overlap protection)
                try {
                    const { data: rpcRes, error: rpcError } = await ctx.supabase.rpc('safe_book_appointment', {
                        p_user_id: ctx.userId,
                        p_workspace_id: ctx.workspaceId,
                        p_platform: ctx.platform,
                        p_chat_id: ctx.chatId,
                        p_instagram_handle: handle,
                        p_customer_name: name,
                        p_customer_phone: phone,
                        p_service_name: match.name,
                        p_appointment_date: date,
                        p_start_time: startTime24,
                        p_end_time: endTime,
                        p_duration_minutes: match.durationMinutes
                    });

                    if (rpcError || !rpcRes?.success) {
                        throw rpcError || new Error(rpcRes?.error || 'RPC returned failure');
                    }

                    await updateCustomerAfterBooking();
                    return { success: true, appointmentId: rpcRes.appointmentId, service: match.name, date, time: formatTime12(startTime24), price: match.price };
                } catch (rpcErr: any) {
                    // RPC failed — fallback to direct insert
                    console.warn('⚠️ [APPOINTMENT] RPC failed, falling back to direct insert:', rpcErr?.message || rpcErr);
                    const result = await createAppointmentV2Structured({
                        supabase: ctx.supabase,
                        userId: ctx.userId,
                        workspaceId: ctx.workspaceId,
                        chatId: ctx.chatId,
                        platform: ctx.platform,
                        customerName: name,
                        customerPhone: phone,
                        serviceName: match.name,
                        date,
                        startTime: startTime24,
                        endTime,
                        durationMinutes: match.durationMinutes,
                        instagramHandle: handle,
                    });
                    if (result.success) {
                        await updateCustomerAfterBooking();
                    }
                    return { ...result, service: match.name, date, time: formatTime12(startTime24), price: match.price };
                }
            },
        },
        get_services: {
            description: 'List all available services with their prices and durations. Use when the customer asks about services, prices, or what you offer.',
            inputSchema: z.object({
                service: z.string().optional().describe('Optional service name filter')
            }),
            execute: async () => {
                const services = await loadActiveServices(ctx.supabase, ctx.workspaceId);
                if (services.length === 0) return { services: [], message: 'No services configured.' };
                return {
                    services: services.map(s => ({
                        name: s.name,
                        price: s.price,
                        duration: s.durationMinutes,
                        description: s.description || null,
                    })),
                    count: services.length,
                };
            },
        },
        cancel_appointment: {
            description: 'Cancel the customer\'s most recent upcoming confirmed appointment.',
            inputSchema: z.object({}).passthrough(),
            execute: async () => {
                return await cancelLatestAppointment(ctx.supabase, ctx.workspaceId, ctx.chatId);
            },
        },
        reschedule_appointment: {
            description: "Reschedule the customer's most recent upcoming confirmed appointment to a new date and time.",
            inputSchema: z.object({
                date: z.string().describe('New YYYY-MM-DD date'),
                time: z.string().describe('New HH:mm 24h start time'),
            }),
            execute: async ({ date, time }: { date: string; time: string }) => {
                const latest = await lookupLatestAppointment(ctx.supabase, ctx.workspaceId, ctx.chatId);
                if (!latest) {
                    return { success: false, error: 'No upcoming active appointment found to reschedule.' };
                }

                const startTime24 = parseTimeTo24h(time);
                const endTime = minutesToTime(parseTimeToMinutes(startTime24) + latest.durationMinutes);

                // STRATEGY: Direct reschedule first (reliable), RPC as opt-in
                const useRpc = process.env.USE_RPC_APPOINTMENTS === 'true';

                if (!useRpc) {
                    const result = await rescheduleAppointment(
                        ctx.supabase,
                        ctx.workspaceId,
                        latest.id,
                        date,
                        startTime24,
                        latest.durationMinutes
                    );
                    return {
                        success: result.success,
                        reason: result.reason,
                        previous_date: latest.date,
                        previous_time: formatTime12(latest.startTime),
                        new_date: date,
                        new_time: formatTime12(startTime24),
                        appointmentId: latest.id
                    };
                }

                // RPC path (only when explicitly enabled)
                try {
                    const { data: rpcRes, error: rpcError } = await ctx.supabase.rpc('safe_reschedule_appointment', {
                        p_workspace_id: ctx.workspaceId,
                        p_appointment_id: latest.id,
                        p_new_date: date,
                        p_new_start_time: startTime24,
                        p_new_end_time: endTime
                    });

                    if (rpcError || !rpcRes?.success) {
                        throw rpcError || new Error(rpcRes?.error || 'RPC reschedule failed');
                    }

                    return {
                        success: true,
                        previous_date: latest.date,
                        previous_time: formatTime12(latest.startTime),
                        new_date: date,
                        new_time: formatTime12(startTime24),
                        appointmentId: latest.id
                    };
                } catch (rpcErr: any) {
                    // RPC failed — fallback to direct reschedule
                    console.warn('⚠️ [APPOINTMENT] RPC reschedule failed, falling back to direct:', rpcErr?.message || rpcErr);
                    const result = await rescheduleAppointment(
                        ctx.supabase,
                        ctx.workspaceId,
                        latest.id,
                        date,
                        startTime24,
                        latest.durationMinutes
                    );
                    return {
                        success: result.success,
                        reason: result.reason,
                        previous_date: latest.date,
                        previous_time: formatTime12(latest.startTime),
                        new_date: date,
                        new_time: formatTime12(startTime24),
                        appointmentId: latest.id
                    };
                }
            },
        },
        lookup_customer: {
            description: 'Check if this customer has booked before. Returns saved name/phone.',
            inputSchema: z.object({
                name: z.string().optional().describe('Optional customer name'),
                phone: z.string().optional().describe('Optional customer phone')
            }),
            execute: async () => {
                const known = await getKnownCustomerDetails(ctx.supabase, ctx.workspaceId, ctx.chatId);
                if (!known) return { found: false };
                return { found: true, name: known.name, phone: known.phone, address: known.address };
            },
        },
        /*
        send_booking_flow: {
            description: 'Send a native WhatsApp booking form to the customer. Call this ONLY on WhatsApp when the customer is ready to book, instead of asking for date/time manually.',
            inputSchema: z.object({
                service: z.string().describe('Service name to book'),
            }),
            execute: async ({ service }: { service: string }) => {
                if (ctx.platform !== 'whatsapp') return { success: false, error: 'Only available on WhatsApp' };
                
                const services = await loadActiveServices(ctx.supabase, ctx.workspaceId);
                const match = findBestServiceMatch(services, service);
                if (!match) return { success: false, error: 'Service not found' };

                const isSimulator = ctx.chatId.startsWith('sim_') || ctx.chatId.includes('simulator');
                if (isSimulator) {
                    return { success: true, message: `Sent booking flow for ${match.name} (Simulated)` };
                }

                const { data: ws } = await ctx.supabase.from('ai_settings').select('whatsapp_business_account_id, whatsapp_access_token, whatsapp_phone_number_id, whatsapp_booking_flow_id').eq('id', ctx.workspaceId).maybeSingle();
                if (!ws?.whatsapp_phone_number_id || !ws?.whatsapp_access_token) return { success: false, error: 'WhatsApp credentials missing' };

                const creds = { phoneNumberId: ws.whatsapp_phone_number_id, accessToken: ws.whatsapp_access_token };
                
                if (ws.whatsapp_booking_flow_id) {
                    await sendFlow(
                        creds,
                        ctx.chatId,
                        ws.whatsapp_booking_flow_id,
                        `book_${match.id}_${Date.now()}`,
                        `📅 Ready to book your *${match.name}*?\n\nTap below to open the booking form and select a time!`,
                        'Book Appointment',
                        'BOOKING_DETAILS',
                        { service_id: match.id, service_name: match.name },
                        ctx.config.businessName || 'Booking',
                        'Powered by GhostAgent'
                    );
                    return { success: true, message: `Sent native booking flow for ${match.name}` };
                } else {
                    await sendButtons(
                        creds,
                        ctx.chatId,
                        `📅 Ready to book your *${match.name}*?\n\nTap below to start choosing a date and time!`,
                        [
                            { id: `book_now_${match.id}`, title: '📅 Book Now' }
                        ],
                        ctx.config.businessName || 'Salon Booking',
                        'Powered by GhostAgent'
                    );
                    return { success: true, message: `Sent booking flow button for ${match.name}` };
                }
            },
        },
        */
    };
}

// ═══════════════════════════════════════════════════════════════
// E-COMMERCE TOOLS
// ═══════════════════════════════════════════════════════════════

export function createEcommerceTools(ctx: ToolContext) {
    return {
        search_products: {
            description: 'Searches the product database for clothing items by name, category, or keyword. Use for ALL product, price, or stock questions.',
            inputSchema: z.object({
                query: z.string().describe('Product name, category, or keyword. Leave empty string to list all.'),
            }),
            execute: async ({ query }: { query?: string }) => {
                const products = await searchProducts({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, query });
                return {
                    products: products.map(p => ({
                        name: p.itemName,
                        price: p.price,
                        inStock: p.stockLevel > 0,
                        stock: p.stockLevel,
                        colors: (p as any).colors || undefined,
                        sizes: (p as any).sizes || undefined,
                        variants: p.variants || []
                    })),
                    count: products.length
                };
            },
        },
        get_business_hours: {
            description: 'Get store hours. Use when customer asks "when are you open?", "working hours?".',
            inputSchema: z.object({}),
            execute: async () => {
                const hours = await loadBusinessHours(ctx.supabase, ctx.workspaceId);
                if (hours.length === 0) return { message: 'Hours not configured.' };
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                return { hours: hours.map(h => ({ day: dayNames[h.dayOfWeek], isOpen: h.isOpen, open: h.isOpen ? formatTime12(h.openTime) : null, close: h.isOpen ? formatTime12(h.closeTime) : null })) };
            },
        },
        place_order: {
            description: 'Create an order. Call ONLY after product is in stock and customer confirmed.',
            inputSchema: z.object({
                name: z.string().describe('Customer full name'),
                phone: z.string().describe('Customer phone number'),
                address: z.string().describe('Customer shipping address'),
                product: z.string().describe('Product name'),
                variant: z.string().describe('Optional variant (color/size). Leave empty if unknown'),
                quantity: z.number().default(1),
            }),
            execute: async ({ name, phone, address, product, variant, quantity }: { name: string; phone: string; address: string; product: string; variant?: string; quantity: number }) => {
                const products = await searchProducts({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, query: product });
                const match = findBestProductMatch(products, product);
                                if (!match) return { success: false, error: 'Product not found' };
                let handle = await resolveInstagramHandle(ctx);
                const orderResult = await createOrderV2({ supabase: ctx.supabase, userId: ctx.userId, workspaceId: ctx.workspaceId, chatId: ctx.chatId, platform: ctx.platform, productId: match.id, customerName: name, customerPhone: phone, customerAddress: address, itemRequested: match.itemName, variantLabel: variant, unitPrice: match.price, quantity, instagramHandle: handle });
                if (orderResult.success) {
                    await upsertCustomer(ctx.supabase, ctx.workspaceId, ctx.chatId, ctx.platform, { name, phone, address }).catch(() => { });
                    await upsertCustomerProfile(ctx.supabase, ctx.workspaceId, ctx.chatId, ctx.platform, { name, phone, totalOrders: 1 }).catch(() => { });
                }
                return { ...orderResult, product: match.itemName, price: match.price, quantity };
            },
        },
        cancel_order: {
            description: 'Cancel the customer\'s most recent pending order.',
            inputSchema: z.object({}).passthrough(),
            execute: async () => {
                return await cancelLatestOrder(ctx.supabase, ctx.workspaceId, ctx.chatId);
            },
        },
        lookup_customer: {
            description: 'Check if this customer has ordered before. Returns saved name/phone/address. Call at the start of any order flow.',
            inputSchema: z.object({}).passthrough(),
            execute: async () => {
                const known = await getKnownCustomerDetails(ctx.supabase, ctx.workspaceId, ctx.chatId);
                if (!known) return { found: false };
                return { found: true, name: known.name, phone: known.phone, address: known.address };
            },
        },
        send_product_card: {
            description: 'Send a native WhatsApp product card to the customer. Call this ONLY on WhatsApp when a customer asks about a specific product.',
            inputSchema: z.object({
                product: z.string().describe('Product name to send'),
            }),
            execute: async ({ product }: { product: string }) => {
                if (ctx.platform !== 'whatsapp') return { success: false, error: 'Only available on WhatsApp' };

                const products = await searchProducts({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, query: product });
                const match = findBestProductMatch(products, product);
                if (!match) return { success: false, error: 'Product not found' };

                const isSimulator = ctx.chatId.startsWith('sim_') || ctx.chatId.includes('simulator');
                if (isSimulator) {
                    return { success: true, message: `Sent product card for ${match.itemName} (Simulated)` };
                }

                const { data: ws } = await ctx.supabase.from('ai_settings').select('whatsapp_catalog_id, whatsapp_phone_number_id, whatsapp_access_token').eq('id', ctx.workspaceId).maybeSingle();
                if (!ws?.whatsapp_phone_number_id || !ws?.whatsapp_access_token) return { success: false, error: 'WhatsApp credentials missing' };

                if (!ws.whatsapp_catalog_id) {
                    await sendButtons(
                        { phoneNumberId: ws.whatsapp_phone_number_id, accessToken: ws.whatsapp_access_token },
                        ctx.chatId,
                        `🛍️ *${match.itemName}*\n\nPrice: *$${match.price}*\nStock: ${match.stockLevel > 0 ? '✅ In Stock' : '❌ Out of Stock'}\n\nTap below if you'd like to order!`,
                        [
                            { id: `buy_now_${match.id}`, title: '🛍️ Order Now' }
                        ],
                        match.itemName,
                        'Powered by GhostAgent'
                    );
                    return { success: true, message: `Sent product details button (Catalog fallback) for ${match.itemName}` };
                }

                await sendSingleProductCard(
                    { phoneNumberId: ws.whatsapp_phone_number_id, accessToken: ws.whatsapp_access_token },
                    ctx.chatId,
                    ws.whatsapp_catalog_id,
                    match.id
                );

                return { success: true, message: `Sent product card for ${match.itemName}` };
            },
        },
    };
}
// ═══════════════════════════════════════════════════════════════
// TRANSACTIONAL TOOL BLOCKLIST
// ═══════════════════════════════════════════════════════════════

/**
 * Tools that perform DB writes (order/appointment creation, cancellation, updates).
 * These must NEVER be available to the fallback LLM agent.
 * All transactional actions go through deterministic handlers/FSM only.
 */
export const TRANSACTIONAL_TOOL_NAMES = [
    'place_order',
    'cancel_order',
    'book_appointment',
    'cancel_appointment',
    'reschedule_appointment',
] as const;

/**
 * Create ecommerce tools with transactional tools stripped.
 * Fallback LLM agent can only search products, check hours, and lookup customers.
 */
export function createEcommerceToolsReadOnly(ctx: ToolContext) {
    const all = createEcommerceTools(ctx);
    const { place_order, cancel_order, ...readOnly } = all;
    return readOnly;
}

/**
 * Create appointment tools with transactional tools stripped.
 * Fallback LLM agent can only check slots, check hours, and lookup customers.
 */
export function createAppointmentToolsReadOnly(ctx: ToolContext) {
    const all = createAppointmentTools(ctx);
    const { book_appointment, cancel_appointment, reschedule_appointment, ...readOnly } = all;
    return readOnly;
}
