
import { SupabaseClient } from '@supabase/supabase-js';

export interface KnownCustomerDetails {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
}

/**
 * Searches the historical records (appointments and orders) to find
 * the most recent details for a given customer.
 */
export async function getKnownCustomerDetails(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string
): Promise<KnownCustomerDetails | null> {
    try {
        // 1. Check most recent appointment
        const { data: appt } = await supabase
            .from('appointments')
            .select('customer_name, customer_phone')
            .eq('workspace_id', workspaceId)
            .eq('instagram_user_id', chatId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // 2. Check most recent order (for address)
        const { data: order } = await supabase
            .from('orders')
            .select('customer_name, customer_phone, customer_address')
            .eq('workspace_id', workspaceId)
            .eq('instagram_user_id', chatId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // Combine (Order takes priority for name/phone if it's more recent, but we merge)
        const name = order?.customer_name || appt?.customer_name || null;
        const phone = order?.customer_phone || appt?.customer_phone || null;
        const address = order?.customer_address || null;

        if (!name && !phone && !address) return null;

        return { name, phone, address };
    } catch (e) {
        return null;
    }
}
