import { tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// Helper to get Admin Supabase client internally (Read Only)
const getAdminClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
    );
};

// 1. E-Commerce Inventory
export const checkEcommerceInventoryTool = (workspaceId: string) => tool({
    description: "Queries the exact, real-time stock count and variants for the active workspace's store. Call this before confirming product availability.",
    parameters: z.object({
        product_name: z.string().describe("The name or category of the product to check. Be broad if checking availability of types.")
    }),
    execute: async ({ product_name }) => {
        const supabase = getAdminClient();
        console.log(`[Read Tool] check_ecommerce_inventory: ${product_name} | ws: ${workspaceId}`);
        const { data, error } = await supabase.from('inventory')
            .select('item_name, stock_level, price, description')
            .eq('workspace_id', workspaceId)
            .ilike('item_name', `%${product_name}%`)
            .limit(10);

        if (error || !data || data.length === 0) return { status: 'not_found', message: `No active inventory found matching "${product_name}".` };
        return { status: 'success', stock: data };
    }
});

// 2. Appointments / Calendar
export const checkCalendarAvailabilityTool = (workspaceId: string) => tool({
    description: "Check available time slots for a specified date and service. Call this before offering appointment times to the user.",
    parameters: z.object({
        date: z.string().describe("The requested date (YYYY-MM-DD format)."),
        service: z.string().optional().describe("The specific service requested, if any.")
    }),
    execute: async ({ date, service }) => {
        const supabase = getAdminClient();
        console.log(`[Read Tool] check_calendar_availability: ${date} ${service} | ws: ${workspaceId}`);
        // In reality, this queries your Google Calendar / Bookings table
        const { data, error } = await supabase.from('bookings')
            .select('service_time, duration, status')
            .eq('workspace_id', workspaceId)
            .eq('booking_date', date);

        if (error) return { status: 'error', message: "Unable to reach the calendar." };
        // For demonstration, we simply return the booked slots. The AI can deduce available slots from business hours minus booked slots.
        return { status: 'success', date, booked_slots: data, note: "If booked_slots is empty, the entire day is free." };
    }
});

// 3. Real Estate
export const searchActiveListingsTool = (workspaceId: string) => tool({
    description: "Searches the real estate database for active listings matching budget and location. Must be queried to present real properties.",
    parameters: z.object({
        budget_max: z.number().optional().describe("Maximum budget the customer is willing to spend."),
        location_keyword: z.string().optional().describe("Location, neighborhood, or city name.")
    }),
    execute: async ({ budget_max, location_keyword }) => {
        const supabase = getAdminClient();
        console.log(`[Read Tool] search_active_listings: ${budget_max} ${location_keyword} | ws: ${workspaceId}`);
        let query = supabase.from('properties')
            .select('title, price, location, bedrooms, bathrooms, description')
            .eq('workspace_id', workspaceId)
            .eq('status', 'available');

        if (budget_max) query = query.lte('price', budget_max);
        if (location_keyword) query = query.ilike('location', `%${location_keyword}%`);

        const { data, error } = await query.limit(5);
        if (error || !data || data.length === 0) return { status: 'not_found', message: "No active properties match these criteria." };
        return { status: 'success', listings: data };
    }
});

// 4. Food & Beverage
export const searchMenuItemsTool = (workspaceId: string) => tool({
    description: "Returns the current menu items, availability, and prices. Ensure you cross-reference this before confirming orders.",
    parameters: z.object({
        item_category: z.string().optional().describe("E.g., Pizza, Drinks, Dessert. Leave blank to check random items.")
    }),
    execute: async ({ item_category }) => {
        const supabase = getAdminClient();
        console.log(`[Read Tool] search_menu_items: ${item_category} | ws: ${workspaceId}`);
        let query = supabase.from('menu_items')
            .select('item_name, price, is_available, dietary_info')
            .eq('workspace_id', workspaceId)
            .eq('is_available', true);

        if (item_category) query = query.ilike('category', `%${item_category}%`);

        const { data, error } = await query.limit(15);
        if (error || !data || data.length === 0) return { status: 'not_found', message: "Could not find those menu items active right now." };
        return { status: 'success', items: data };
    }
});

// 5. Events & Ticketing
export const checkTicketAvailabilityTool = (workspaceId: string) => tool({
    description: "Checks if an event has remaining ticket capacity for a specific tier (e.g. VIP or General). Do this before checkout.",
    parameters: z.object({
        event_name: z.string().describe("Name of the event. Be broad."),
        tier: z.string().optional().describe("Specific ticket tier (VIP, General, etc).")
    }),
    execute: async ({ event_name, tier }) => {
        const supabase = getAdminClient();
        console.log(`[Read Tool] check_ticket_availability: ${event_name} ${tier} | ws: ${workspaceId}`);
        let query = supabase.from('events')
            .select('event_name, date, tier, price, remaining_capacity')
            .eq('workspace_id', workspaceId)
            .ilike('event_name', `%${event_name}%`);

        if (tier) query = query.ilike('tier', `%${tier}%`);

        const { data, error } = await query.limit(5);
        if (error || !data || data.length === 0) return { status: 'not_found', message: "Event not found or sold out." };
        return { status: 'success', tickets: data };
    }
});

// 6. Digital Services
export const fetchSupportDocsTool = (workspaceId: string) => tool({
    description: "Searches the business' specific knowledge base or FAQs. Use this to provide accurate, business-specific technical support and policies.",
    parameters: z.object({
        query: z.string().describe("The core question or topic to search the knowledge base for.")
    }),
    execute: async ({ query }) => {
        const supabase = getAdminClient();
        console.log(`[Read Tool] fetch_support_docs: ${query} | ws: ${workspaceId}`);
        // Basic full text search emulation (in reality, you might use pg_search or embeddings)
        const { data, error } = await supabase.from('knowledge_base')
            .select('title, content')
            .eq('workspace_id', workspaceId)
            .ilike('content', `%${query}%`)
            .limit(3);

        if (error || !data || data.length === 0) return { status: 'not_found', message: "No documentation found for this query in the knowledge base." };
        return { status: 'success', articles: data };
    }
});
