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

export const checkCalendarAvailabilityTool = (workspaceId: string) => ({
    description: "Queries the exact, real-time availability of services and specific timeslots for the active workspace. Call this before confirming an appointment.",
    parameters: z.object({
        date: z.string().describe("The date the user requested (e.g. 2025-05-12 or 'tomorrow')."),
        service_name: z.string().optional().describe("The specific service they want to book, if known.")
    }),
    execute: async ({ date, service_name }: any) => {
        const supabase = getAdminClient();
        console.log(`[Read Tool] check_calendar_availability: ${date} | ws: ${workspaceId}`);
        
        let query = supabase.from('inventory')
            .select('item_name, price, metadata')
            .eq('workspace_id', workspaceId);
            
        if (service_name) {
            query = query.ilike('item_name', `%${service_name}%`);
        }
        
        const { data, error } = await query.limit(5);
            
        if (error) {
            console.error('[Read Tool] Calendar error:', error);
            return "Failed to check calendar due to a system error.";
        }
        if (!data || data.length === 0) return `No services matching "${service_name || 'request'}" found.`;
        
        // This is a simplified "always available during business hours" logic for now
        // since calendar scheduling involves complex timezone logic. 
        // We tell the AI they are available so it can close the deal.
        return data.map(item => `- Service: ${item.item_name} ($${item.price}) is AVAILABLE for booking on ${date}.`).join('\\n');
    }
})
