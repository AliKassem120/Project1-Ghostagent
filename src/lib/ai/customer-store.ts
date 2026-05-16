/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Customer Store
 * ═══════════════════════════════════════════════════════════════
 * Persists customer name/phone/address the moment it is learned —
 * even mid-conversation, before any order or appointment is created.
 *
 * This is the fix for returning customers being asked for their
 * info again: we now have a dedicated table that isn't gated on
 * a completed transaction.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v2log } from './logger';

export interface CustomerRecord {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
}

/**
 * Save (or update) what we know about a customer as soon as we learn it.
 * Only updates fields that are provided — won't overwrite existing data
 * with null values.
 */
export async function upsertCustomer(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string,
    platform: string,
    data: CustomerRecord
): Promise<void> {
    // Only include fields that actually have values
    const updates: Record<string, string> = {};
    if (data.name) updates.name = data.name;
    if (data.phone) updates.phone = data.phone;
    if (data.address) updates.address = data.address;

    if (Object.keys(updates).length === 0) return;

    try {
        const { error } = await supabase
            .from('customers')
            .upsert(
                {
                    workspace_id: workspaceId,
                    chat_id: chatId,
                    platform,
                    ...updates,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'workspace_id,chat_id', ignoreDuplicates: false }
            );

        if (error) {
            v2log.warn('CUSTOMER_STORE', 'Failed to upsert customer', { error, chatId });
        } else {
            v2log.info('CUSTOMER_STORE', 'Customer saved', { chatId, fields: Object.keys(updates) });
        }
    } catch (err) {
        v2log.warn('CUSTOMER_STORE', 'Exception upserting customer', { err });
    }
}

/**
 * Load known customer details from the customers table.
 * Returns null if no record exists.
 */
export async function getCustomerFromStore(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string
): Promise<CustomerRecord | null> {
    try {
        const { data, error } = await supabase
            .from('customers')
            .select('name, phone, address')
            .eq('workspace_id', workspaceId)
            .eq('chat_id', chatId)
            .maybeSingle();

        if (error || !data) return null;
        if (!data.name && !data.phone && !data.address) return null;

        return {
            name: data.name || null,
            phone: data.phone || null,
            address: data.address || null,
        };
    } catch {
        return null;
    }
}
