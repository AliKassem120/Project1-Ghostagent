/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — E-Commerce Lookup & Modify
 * ═══════════════════════════════════════════════════════════════
 * Lookup latest orders and apply safe modifications.
 * All modifications check editability (status + time window).
 *
 * Orders table columns used:
 *   id, user_id, workspace_id, instagram_user_id, instagram_handle,
 *   customer_name, customer_phone, customer_address, item_requested,
 *   variant_label, quantity, unit_price, status, raw_message, created_at
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
    rawMessage: any;
}

export type CancelOrderResult =
    | { success: true; orderId: string; productName: string; previousStatus: string }
    | { success: false; reason: 'no_order' }
    | { success: false; reason: 'already_cancelled'; orderId: string; productName: string }
    | { success: false; reason: 'not_pending_status'; orderId: string; productName: string; status: string }
    | { success: false; reason: 'db_error'; error: string };

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
        .select('id, item_requested, variant_label, quantity, unit_price, customer_name, customer_phone, customer_address, status, created_at, raw_message')
        .eq('workspace_id', workspaceId)
        .or(`chat_id.eq.${chatId},instagram_user_id.eq.${chatId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) return null;

    const isEditable = data.status.toLowerCase() === 'pending' && isWithinEditWindow(data.created_at, 30);

    return {
        id: data.id,
        productName: data.item_requested,
        variantLabel: data.variant_label || null,
        quantity: data.quantity || 1,
        unitPrice: data.unit_price || 0,
        customerName: data.customer_name || '',
        customerPhone: data.customer_phone || '',
        customerAddress: data.customer_address || '',
        status: data.status,
        createdAt: data.created_at,
        isEditable,
        rawMessage: data.raw_message || null,
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
        .in('status', ['Pending', 'pending']);

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
        .update({ customer_address: newAddress })
        .eq('id', orderId)
        .in('status', ['Pending', 'pending']);

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
        .in('status', ['Pending', 'pending']);

    if (error) {
        v2log.error('ECOM_LOOKUP', 'Failed to update quantity', { orderId, error });
        return false;
    }
    return true;
}

/**
 * Cancel the most recent order if it is still pending.
 */
export async function cancelLatestOrder(
    supabase: SupabaseClient,
    workspaceId: string,
    chatId: string
): Promise<CancelOrderResult> {
    const order = await lookupLatestOrder(supabase, workspaceId, chatId);
    if (!order) {
        return { success: false, reason: 'no_order' };
    }

    const normalizedStatus = order.status.toLowerCase();
    if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') {
        return {
            success: false,
            reason: 'already_cancelled',
            orderId: order.id,
            productName: order.productName,
        };
    }

    if (normalizedStatus !== 'pending') {
        return {
            success: false,
            reason: 'not_pending_status',
            orderId: order.id,
            productName: order.productName,
            status: order.status,
        };
    }

    const { error } = await supabase
        .from('orders')
        .update({ status: 'Cancelled' })
        .eq('id', order.id);

    if (error) {
        v2log.error('ECOM_LOOKUP', 'Failed to cancel order', { orderId: order.id, error });
        return { success: false, reason: 'db_error', error: error.message || 'cancel_order_failed' };
    }

    // Restore stock for the cancelled order
    try {
        let productId: string | null = null;
        if (typeof order.rawMessage === 'string') {
            try { productId = JSON.parse(order.rawMessage)?.product_id || null; } catch { /* not JSON */ }
        } else if (order.rawMessage?.product_id) {
            productId = order.rawMessage.product_id;
        }
        if (productId && !productId.startsWith('csv-')) {
            await supabase.rpc('restore_stock', { p_product_id: productId, p_quantity: order.quantity || 1 });
        }
    } catch (e) {
        v2log.warn('ECOM_LOOKUP', 'Stock restore failed (order still cancelled)', { orderId: order.id, error: e });
    }

    return {
        success: true,
        orderId: order.id,
        productName: order.productName,
        previousStatus: order.status,
    };
}

// ── Helpers ──────────────────────────────────────────────────

function isWithinEditWindow(createdAt: string, windowMinutes: number): boolean {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    return (now - created) < windowMinutes * 60 * 1000;
}
