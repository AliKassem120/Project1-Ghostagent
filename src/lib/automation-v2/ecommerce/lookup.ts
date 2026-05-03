/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — E-Commerce Lookup & Modify
 * ═══════════════════════════════════════════════════════════════
 * Lookup latest orders and apply safe modifications.
 * All modifications check editability (status + time window).
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v2log } from '../logger';

export interface OrderSnapshot {
    id: string;
    productName: string;
    variantLabel: string | null;
    quantity: number;
    unitPrice: number;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    status: string;
    createdAt: string;
    isEditable: boolean;
}

/**
 * Lookup the most recent order for a chat.
 */
export async function lookupLatestOrder(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string
): Promise<OrderSnapshot | null> {
    const { data, error } = await supabase
        .from('orders')
        .select('id, item_requested, variant_label, quantity, unit_price, customer_name, customer_phone, delivery_address, status, created_at')
        .eq('workspace_id', workspaceId)
        .eq('instagram_user_id', chatId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) return null;

    const isEditable = data.status === 'Pending' && isWithinEditWindow(data.created_at, 30);

    return {
        id: data.id,
        productName: data.item_requested,
        variantLabel: data.variant_label || null,
        quantity: data.quantity || 1,
        unitPrice: data.unit_price || 0,
        customerName: data.customer_name || '',
        customerPhone: data.customer_phone || '',
        customerAddress: data.delivery_address || '',
        status: data.status,
        createdAt: data.created_at,
        isEditable,
    };
}

/**
 * Update the variant/size of a pending order.
 */
export async function updateOrderVariant(
    supabase: SupabaseClient,
    orderId: string,
    newVariant: string
): Promise<boolean> {
    const { error } = await supabase
        .from('orders')
        .update({ variant_label: newVariant })
        .eq('id', orderId)
        .eq('status', 'Pending');

    if (error) {
        v2log.error('ECOM_LOOKUP', 'Failed to update variant', { orderId, error });
        return false;
    }
    return true;
}

/**
 * Update the delivery address of a pending order.
 */
export async function updateOrderAddress(
    supabase: SupabaseClient,
    orderId: string,
    newAddress: string
): Promise<boolean> {
    const { error } = await supabase
        .from('orders')
        .update({ delivery_address: newAddress })
        .eq('id', orderId)
        .eq('status', 'Pending');

    if (error) {
        v2log.error('ECOM_LOOKUP', 'Failed to update address', { orderId, error });
        return false;
    }
    return true;
}

/**
 * Update the quantity of a pending order.
 */
export async function updateOrderQuantity(
    supabase: SupabaseClient,
    orderId: string,
    newQuantity: number
): Promise<boolean> {
    const { error } = await supabase
        .from('orders')
        .update({ quantity: newQuantity })
        .eq('id', orderId)
        .eq('status', 'Pending');

    if (error) {
        v2log.error('ECOM_LOOKUP', 'Failed to update quantity', { orderId, error });
        return false;
    }
    return true;
}

/**
 * Cancel the most recent pending order.
 */
export async function cancelLatestOrder(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string
): Promise<{ success: boolean; productName?: string }> {
    const order = await lookupLatestOrder(supabase, workspaceId, chatId);
    if (!order || order.status !== 'Pending') {
        return { success: false };
    }

    const { error } = await supabase
        .from('orders')
        .update({ status: 'Cancelled' })
        .eq('id', order.id);

    return { success: !error, productName: order.productName };
}

// ── Helpers ──────────────────────────────────────────────────

function isWithinEditWindow(createdAt: string, windowMinutes: number): boolean {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    return (now - created) < windowMinutes * 60 * 1000;
}
