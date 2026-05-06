/**
 * GhostAgent — Tool Definitions
 */

import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceConfig } from './types';
import { loadActiveServices, findBestServiceMatch } from './appointments/services';
import { loadBusinessHours, getHoursForDay } from './appointments/hours';
import { checkAvailability } from './appointments/availability';
import { createAppointmentV2Structured } from './appointments/create-appointment';
import { formatTime12, minutesToTime } from './time';
import { searchProducts, findBestProductMatch } from './ecommerce/products';
import { createOrderV2 } from './ecommerce/orders';
import { cancelLatestOrder } from './ecommerce/lookup';
import { getKnownCustomerDetails } from './customer-history';
import { searchSaasKnowledge } from './saas-support/knowledge';

export interface ToolContext {
    supabase: SupabaseClient;
    userId: string;
    workspaceId: string;
    chatId: string;
    config: WorkspaceConfig;
    platform: 'instagram' | 'whatsapp';
}

async function resolveHandle(ctx: ToolContext): Promise<string> {
    try {
        const { data } = await ctx.supabase
            .from('activity_log')
            .select('metadata')
            .eq('user_id', ctx.userId)
            .order('timestamp', { ascending: false })
            .limit(10);
        const best = (data || []).find((l: any) =>
            (l.metadata?.chat_id === ctx.chatId || l.metadata?.chatId === ctx.chatId) &&
            (l.metadata?.username || l.metadata?.commenter_name || l.metadata?.sender?.attendee_name)
        );
        return best?.metadata?.username || best?.metadata?.commenter_name || best?.metadata?.sender?.attendee_name || 'Customer';
    } catch {
        return 'Customer';
    }
}

export function createAppointmentTools(ctx: ToolContext) {
    return {
        check_slot: {
            description: 'Check if a date/time slot is available for a service. Call BEFORE confirming any appointment.',
            parameters: z.object({ date: z.string(), time: z.string(), service_name: z.string() }),
            execute: async ({ date, time, service_name }: { date: string; time: string; service_name: string }) => {
                const services = await loadActiveServices(ctx.supabase, ctx.workspaceId);
                const match = findBestServiceMatch(services, service_name);
                if (!match) return { available: false, reason: 'service_not_found', services_available: services.map(s => s.name) };
                const hours = await loadBusinessHours(ctx.supabase, ctx.workspaceId);
                const r = await checkAvailability({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, date, startTime: time, durationMinutes: match.durationMinutes, businessHours: hours });
                if (r.available) return { available: true, service: match.name, price: match.price, duration: match.durationMinutes, date, time: formatTime12(time) };
                if (r.reason === 'closed') {
                    const dl = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
                    return { available: false, reason: 'closed', message: `Closed on ${dl}` };
                }
                if (r.reason === 'outside_hours') {
                    const dow = new Date(`${date}T12:00:00`).getDay();
                    const h = getHoursForDay(hours, dow);
                    return { available: false, reason: 'outside_hours', message: `Open ${h ? formatTime12(h.openTime) : '9 AM'} - ${h ? formatTime12(h.closeTime) : '5 PM'}` };
                }
                return { available: false, reason: 'overlap', message: 'Slot taken' };
            },
        },
        book_appointment: {
            description: 'Create an appointment. Call ONLY after availability and customer confirmation.',
            parameters: z.object({ customer_name: z.string(), customer_phone: z.string(), service_name: z.string(), date: z.string(), time: z.string() }),
            execute: async ({ customer_name, customer_phone, service_name, date, time }: { customer_name: string; customer_phone: string; service_name: string; date: string; time: string }) => {
                const services = await loadActiveServices(ctx.supabase, ctx.workspaceId);
                const match = findBestServiceMatch(services, service_name);
                if (!match) return { success: false, error: 'Service not found' };
                const [h, m] = time.split(':').map(Number);
                const endTime = minutesToTime(h * 60 + m + match.durationMinutes);
                const appointment = await createAppointmentV2Structured({ supabase: ctx.supabase, userId: ctx.userId, workspaceId: ctx.workspaceId, chatId: ctx.chatId, customerName: customer_name, customerPhone: customer_phone, serviceName: match.name, date, startTime: time, endTime, durationMinutes: match.durationMinutes, instagramHandle: await resolveHandle(ctx) });
                return { success: appointment.success, appointmentId: appointment.appointmentId, error: appointment.error, service: match.name, date, time: formatTime12(time), price: match.price };
            },
        },
        cancel_appointment: {
            description: 'Cancel the latest upcoming appointment.',
            parameters: z.object({}),
            execute: async () => {
                const { data: upcoming } = await ctx.supabase.from('appointments').select('id, service, appointment_date, start_time').eq('workspace_id', ctx.workspaceId).eq('instagram_user_id', ctx.chatId).in('status', ['confirmed', 'pending']).order('appointment_date', { ascending: true }).limit(1).maybeSingle();
                if (!upcoming) return { success: false, message: 'No upcoming appointment found' };
                const { error } = await ctx.supabase.from('appointments').update({ status: 'cancelled' }).eq('id', upcoming.id);
                return { success: !error, cancelled: { service: upcoming.service, date: upcoming.appointment_date, time: formatTime12(upcoming.start_time) } };
            },
        },
        lookup_customer: {
            description: 'Check if this customer has booked before. Returns saved name/phone.',
            parameters: z.object({}),
            execute: async () => {
                const known = await getKnownCustomerDetails(ctx.supabase, ctx.workspaceId, ctx.chatId);
                return known ? { found: true, name: known.name, phone: known.phone, address: known.address } : { found: false };
            },
        },
    };
}

export function createEcommerceTools(ctx: ToolContext) {
    return {
        search_products: {
            description: 'Search products in the store. Returns name, price, stock.',
            parameters: z.object({ query: z.string().optional() }),
            execute: async ({ query }: { query?: string }) => {
                const products = await searchProducts({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, query });
                return { products: products.map(p => ({ name: p.itemName, price: p.price, inStock: p.stockLevel > 0, stock: p.stockLevel })), count: products.length };
            },
        },
        get_business_hours: {
            description: 'Get store hours.',
            parameters: z.object({}),
            execute: async () => {
                const hours = await loadBusinessHours(ctx.supabase, ctx.workspaceId);
                if (hours.length === 0) return { message: 'Hours not configured.' };
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                return { hours: hours.map(h => ({ day: dayNames[h.dayOfWeek], isOpen: h.isOpen, open: h.isOpen ? formatTime12(h.openTime) : null, close: h.isOpen ? formatTime12(h.closeTime) : null })) };
            },
        },
        place_order: {
            description: 'Create an order. Call ONLY after product is in stock and customer confirmed.',
            parameters: z.object({ customer_name: z.string(), customer_phone: z.string(), customer_address: z.string(), product_name: z.string(), variant: z.string().optional(), quantity: z.number().default(1) }),
            execute: async ({ customer_name, customer_phone, customer_address, product_name, variant, quantity }: { customer_name: string; customer_phone: string; customer_address: string; product_name: string; variant?: string; quantity: number }) => {
                const products = await searchProducts({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, query: product_name });
                const match = findBestProductMatch(products, product_name);
                if (!match) return { success: false, error: 'Product not found' };
                const order = await createOrderV2({ supabase: ctx.supabase, userId: ctx.userId, workspaceId: ctx.workspaceId, chatId: ctx.chatId, customerName: customer_name, customerPhone: customer_phone, customerAddress: customer_address, itemRequested: match.itemName, variantLabel: variant, unitPrice: match.price, quantity, instagramHandle: await resolveHandle(ctx), platform: ctx.platform, productId: match.id });
                return { success: order.success, orderId: order.orderId, error: order.error, product: match.itemName, price: match.price, quantity };
            },
        },
        cancel_order: {
            description: 'Cancel the latest order if pending.',
            parameters: z.object({}),
            execute: async () => cancelLatestOrder(ctx.supabase, ctx.workspaceId, ctx.chatId),
        },
        lookup_customer: {
            description: 'Check if this customer has ordered before. Returns saved name/phone/address.',
            parameters: z.object({}),
            execute: async () => {
                const known = await getKnownCustomerDetails(ctx.supabase, ctx.workspaceId, ctx.chatId);
                return known ? { found: true, name: known.name, phone: known.phone, address: known.address } : { found: false };
            },
        },
    };
}

export function createSaasSupportTools(ctx: ToolContext) {
    return {
        search_knowledge: {
            description: 'Search GhostAgent knowledge base for docs, pricing, features, and capabilities.',
            parameters: z.object({ query: z.string().optional() }),
            execute: async ({ query }: { query?: string }) => {
                const results = await searchSaasKnowledge(ctx.supabase, ctx.workspaceId, query);
                return { results: results.map(r => ({ title: r.title, content: r.content })), count: results.length };
            },
        },
        lookup_account: {
            description: 'Check if this user already has an account on GhostAgent.',
            parameters: z.object({}),
            execute: async () => ({ found: false, message: 'No account found.' }),
        },
    };
}
