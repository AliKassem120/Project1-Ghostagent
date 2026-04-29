/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — V3 Agent: Tool Definitions
 * ═══════════════════════════════════════════════════════════════
 * Defines all tools available to the AI agent, split by business
 * type (appointments vs. ecommerce).
 *
 * Each tool wraps an existing V2 module function so we don't
 * duplicate any business logic — the agent just calls them.
 *
 * Note: We use plain objects instead of the tool() helper because
 * AI SDK v6 changed the tool type signature. The agent passes
 * these with 'as any' to generateText, which is fine since
 * tool() is just an identity function (returns its argument).
 */

import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceConfig } from './types';

// ── Appointment imports ──────────────────────────────────────
import { loadActiveServices, findBestServiceMatch } from './appointments/services';
import { loadBusinessHours, getHoursForDay } from './appointments/hours';
import { checkAvailability } from './appointments/availability';
import { createAppointmentV2 } from './appointments/create-appointment';
import { resolveDateTime } from './appointments/date-time';
import { formatTime12, minutesToTime } from './time';

// ── E-Commerce imports ───────────────────────────────────────
import { searchProducts, findBestProductMatch } from './ecommerce/products';
import { checkProductStock } from './ecommerce/inventory';
import { createOrderV2 } from './ecommerce/orders';

// ── Shared imports ───────────────────────────────────────────
import { getKnownCustomerDetails } from './customer-history';

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
// APPOINTMENT TOOLS
// ═══════════════════════════════════════════════════════════════

export function createAppointmentTools(ctx: ToolContext) {
    return {
        get_services: {
            description: 'List all available services with prices and duration.',
            parameters: z.object({}),
            execute: async () => {
                const services = await loadActiveServices(ctx.supabase, ctx.workspaceId);
                return { services: services.map(s => ({ name: s.name, price: s.price, duration: s.durationMinutes, description: s.description })) };
            },
        },
        get_business_hours: {
            description: 'Get business operating hours for each day of the week.',
            parameters: z.object({}),
            execute: async () => {
                const hours = await loadBusinessHours(ctx.supabase, ctx.workspaceId);
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                return { hours: hours.map(h => ({ day: dayNames[h.dayOfWeek], isOpen: h.isOpen, open: h.isOpen ? formatTime12(h.openTime) : null, close: h.isOpen ? formatTime12(h.closeTime) : null })) };
            },
        },
        check_slot: {
            description: 'Check if a date/time slot is available. Call BEFORE confirming any appointment.',
            parameters: z.object({
                date: z.string().describe('YYYY-MM-DD'),
                time: z.string().describe('HH:mm 24h'),
                service_name: z.string().describe('Service name'),
            }),
            execute: async ({ date, time, service_name }: { date: string; time: string; service_name: string }) => {
                const services = await loadActiveServices(ctx.supabase, ctx.workspaceId);
                const match = findBestServiceMatch(services, service_name);
                if (!match) return { available: false, reason: 'service_not_found' };
                const hours = await loadBusinessHours(ctx.supabase, ctx.workspaceId);
                const r = await checkAvailability({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, date, startTime: time, durationMinutes: match.durationMinutes, businessHours: hours });
                if (r.available) return { available: true, service: match.name, price: match.price, duration: match.durationMinutes, date, time: formatTime12(time) };
                if (r.reason === 'closed') { const dl = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }); return { available: false, reason: 'closed', message: `Closed on ${dl}` }; }
                if (r.reason === 'outside_hours') { const dow = new Date(`${date}T12:00:00`).getDay(); const h = getHoursForDay(hours, dow); return { available: false, reason: 'outside_hours', message: `Open ${h ? formatTime12(h.openTime) : '9 AM'} - ${h ? formatTime12(h.closeTime) : '5 PM'}` }; }
                return { available: false, reason: 'overlap', message: 'Slot taken' };
            },
        },
        resolve_date_time: {
            description: 'Parse natural language date/time like "tomorrow at 3pm", "next Monday". Returns YYYY-MM-DD date and HH:mm time.',
            parameters: z.object({ text: z.string().describe('Natural language date/time') }),
            execute: async ({ text }: { text: string }) => {
                const { date, time } = resolveDateTime(text, ctx.config.timezone);
                return { date, time, parsed: !!(date || time) };
            },
        },
        book_appointment: {
            description: 'Create an appointment. Call ONLY after check_slot confirmed availability and customer confirmed.',
            parameters: z.object({
                customer_name: z.string(),
                customer_phone: z.string(),
                service_name: z.string(),
                date: z.string().describe('YYYY-MM-DD'),
                time: z.string().describe('HH:mm 24h'),
            }),
            execute: async ({ customer_name, customer_phone, service_name, date, time }: { customer_name: string; customer_phone: string; service_name: string; date: string; time: string }) => {
                const services = await loadActiveServices(ctx.supabase, ctx.workspaceId);
                const match = findBestServiceMatch(services, service_name);
                if (!match) return { success: false, error: 'Service not found' };
                const [h, m] = time.split(':').map(Number);
                const endTime = minutesToTime(h * 60 + m + match.durationMinutes);
                let handle = 'Customer';
                try { const { data } = await ctx.supabase.from('activity_log').select('metadata').eq('user_id', ctx.userId).filter('metadata->>chat_id', 'eq', ctx.chatId).order('timestamp', { ascending: false }).limit(1).maybeSingle(); if (data?.metadata?.username) handle = data.metadata.username; } catch (_e) { /* */ }
                const success = await createAppointmentV2({ supabase: ctx.supabase, userId: ctx.userId, workspaceId: ctx.workspaceId, chatId: ctx.chatId, customerName: customer_name, customerPhone: customer_phone, serviceName: match.name, date, startTime: time, endTime, durationMinutes: match.durationMinutes, instagramHandle: handle });
                return { success, service: match.name, date, time: formatTime12(time), price: match.price };
            },
        },
        cancel_appointment: {
            description: 'Cancel the customer\'s most recent upcoming confirmed appointment.',
            parameters: z.object({}),
            execute: async () => {
                const { data: upcoming } = await ctx.supabase.from('appointments').select('id, service, appointment_date, start_time').eq('workspace_id', ctx.workspaceId).eq('instagram_user_id', ctx.chatId).eq('status', 'Confirmed').order('appointment_date', { ascending: true }).limit(1).maybeSingle();
                if (!upcoming) return { success: false, message: 'No upcoming appointment found' };
                const { error } = await ctx.supabase.from('appointments').update({ status: 'Cancelled' }).eq('id', upcoming.id);
                return { success: !error, cancelled: { service: upcoming.service, date: upcoming.appointment_date, time: formatTime12(upcoming.start_time) } };
            },
        },
        lookup_customer: {
            description: 'Check if customer has booked/ordered before. Returns saved details.',
            parameters: z.object({}),
            execute: async () => {
                const known = await getKnownCustomerDetails(ctx.supabase, ctx.workspaceId, ctx.chatId);
                if (!known) return { found: false };
                return { found: true, name: known.name, phone: known.phone, address: known.address };
            },
        },
    };
}

// ═══════════════════════════════════════════════════════════════
// E-COMMERCE TOOLS
// ═══════════════════════════════════════════════════════════════

export function createEcommerceTools(ctx: ToolContext) {
    return {
        search_products: {
            description: 'Search for products in the store inventory.',
            parameters: z.object({ query: z.string().optional().describe('Product name or keyword') }),
            execute: async ({ query }: { query?: string }) => {
                const products = await searchProducts({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, query });
                return { products: products.map(p => ({ name: p.itemName, price: p.price, inStock: p.stockLevel > 0, stock: p.stockLevel, description: p.description })), count: products.length };
            },
        },
        check_stock: {
            description: 'Check if a product (and optionally a variant) is in stock.',
            parameters: z.object({ product_name: z.string(), variant: z.string().optional() }),
            execute: async ({ product_name, variant }: { product_name: string; variant?: string }) => {
                const products = await searchProducts({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, query: product_name });
                const match = findBestProductMatch(products, product_name);
                if (!match) return { found: false, message: 'Product not found' };
                const stock = checkProductStock(match, variant);
                return { found: true, product: match.itemName, price: match.price, inStock: stock.inStock, available: stock.availableStock };
            },
        },
        place_order: {
            description: 'Create an order. Call ONLY after product is in stock and customer confirmed.',
            parameters: z.object({
                customer_name: z.string(),
                customer_phone: z.string(),
                customer_address: z.string(),
                product_name: z.string(),
                variant: z.string().optional(),
                quantity: z.number().default(1),
            }),
            execute: async ({ customer_name, customer_phone, customer_address, product_name, variant, quantity }: { customer_name: string; customer_phone: string; customer_address: string; product_name: string; variant?: string; quantity: number }) => {
                const products = await searchProducts({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, query: product_name });
                const match = findBestProductMatch(products, product_name);
                if (!match) return { success: false, error: 'Product not found' };
                let handle = 'Customer';
                try { const { data } = await ctx.supabase.from('activity_log').select('metadata').eq('user_id', ctx.userId).filter('metadata->>chat_id', 'eq', ctx.chatId).order('timestamp', { ascending: false }).limit(1).maybeSingle(); if (data?.metadata?.username) handle = data.metadata.username; } catch (_e) { /* */ }
                const success = await createOrderV2({ supabase: ctx.supabase, userId: ctx.userId, workspaceId: ctx.workspaceId, chatId: ctx.chatId, customerName: customer_name, customerPhone: customer_phone, customerAddress: customer_address, itemRequested: match.itemName, variantLabel: variant, unitPrice: match.price, quantity, instagramHandle: handle });
                return { success, product: match.itemName, price: match.price, quantity };
            },
        },
        cancel_order: {
            description: 'Cancel the customer\'s most recent pending order.',
            parameters: z.object({}),
            execute: async () => {
                const { data: recent } = await ctx.supabase.from('orders').select('id, item_requested').eq('workspace_id', ctx.workspaceId).eq('instagram_user_id', ctx.chatId).eq('status', 'Pending').order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (!recent) return { success: false, message: 'No pending order found' };
                const { error } = await ctx.supabase.from('orders').update({ status: 'Cancelled' }).eq('id', recent.id);
                return { success: !error, item: recent.item_requested };
            },
        },
        lookup_customer: {
            description: 'Check if customer has ordered before. Returns saved details.',
            parameters: z.object({}),
            execute: async () => {
                const known = await getKnownCustomerDetails(ctx.supabase, ctx.workspaceId, ctx.chatId);
                if (!known) return { found: false };
                return { found: true, name: known.name, phone: known.phone, address: known.address };
            },
        },
    };
}
