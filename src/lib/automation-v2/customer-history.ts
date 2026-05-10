
import { SupabaseClient } from '@supabase/supabase-js';
import { getCustomerFromStore } from './customer-store';

export interface KnownCustomerDetails {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
}

/**
 * Returns known customer details for a chat, checking in priority order:
 * 1. customers table (updated in real-time as we learn info)
 * 2. orders table (backwards compat — completed orders)
 * 3. appointments table (backwards compat — completed bookings)
 */
export async function getKnownCustomerDetails(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string
): Promise<KnownCustomerDetails | null> {
    try {
        // 1. Check the dedicated customers table first (most up-to-date)
        const stored = await getCustomerFromStore(supabase, workspaceId, chatId);
        if (stored?.name || stored?.phone) return stored;

        // 2. Fall back to most recent appointment
        const { data: appt } = await supabase
            .from('appointments')
            .select('customer_name, customer_phone')
            .eq('workspace_id', workspaceId)
            .eq('instagram_user_id', chatId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // 3. Fall back to most recent order (for address)
        const { data: order } = await supabase
            .from('orders')
            .select('customer_name, customer_phone, customer_address')
            .eq('workspace_id', workspaceId)
            .eq('instagram_user_id', chatId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const name = order?.customer_name || appt?.customer_name || null;
        const phone = order?.customer_phone || appt?.customer_phone || null;
        const address = order?.customer_address || null;

        if (!name && !phone && !address) return null;
        return { name, phone, address };
    } catch (e) {
        return null;
    }
}
