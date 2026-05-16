/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: E-Commerce Orders
 * ═══════════════════════════════════════════════════════════════
 * Handles the database insert for orders.
 * Inserts into the same 'orders' table the dashboard uses.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v2log } from '../logger';

export interface CreateOrderInput {
    supabase: SupabaseClient;
    userId: string;
    workspaceId: string;
    chatId: string;
    platform: 'instagram' | 'whatsapp';
    productId?: string | null;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    itemRequested: string;
    variantLabel?: string | null;
    unitPrice: number;
    quantity: number;
    instagramHandle?: string;
    rawMessage?: string;
}

export type CreateOrderResult = {
    success: boolean;
    orderId?: string;
    error?: string;
    supabaseCode?: string;
};

/**
 * Creates an order. Returns a structured result so callers never infer
 * success from ambiguous/null values.
 */
export async function createOrderV2(input: CreateOrderInput): Promise<CreateOrderResult> {
    const { 
        supabase, userId, workspaceId, chatId, platform, productId, customerName,
        customerPhone, customerAddress, itemRequested, 
        variantLabel, unitPrice, quantity, 
        instagramHandle = 'Customer', rawMessage = ''
    } = input;

    v2log.ecommerce.orderAttempt({ workspaceId, itemRequested, customerName });

    try {
        // 1. Prepare raw_message JSON for extra context (dashboard uses this)
        const rawJson = JSON.stringify({
            platform,
            chat_id: chatId,
            workspace_id: workspaceId,
            product_id: productId || null,
            item_variant: variantLabel || 'N/A',
            unit_price: unitPrice,
            quantity: quantity,
            total_price: unitPrice * quantity,
            original_message: rawMessage
        });

        // 2. Insert into orders table
        const { data: inserted, error } = await supabase
            .from('orders')
            .insert({
                user_id: userId,
                workspace_id: workspaceId,
                platform,
                chat_id: chatId,
                instagram_user_id: platform === 'instagram' ? chatId : null,
                instagram_handle: instagramHandle,
                customer_name: customerName,
                customer_phone: customerPhone,
                customer_address: customerAddress,
                item_requested: `${itemRequested}${variantLabel ? ` (${variantLabel})` : ''} x${quantity}`,
                variant_label: variantLabel || null,
                quantity: quantity,
                unit_price: unitPrice,
                status: 'pending',
                raw_message: rawJson,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            v2log.ecommerce.orderError({ error, workspaceId });
            v2log.error('V2_ECOMMERCE_ORDER_CREATE', 'Order insert failed', {
                workspaceId,
                chatId,
                platform,
                itemRequested,
                productId,
                customerPhone,
                supabaseCode: error.code,
                error: error.message,
            });
            return { success: false, error: error.message, supabaseCode: error.code };
        }

        v2log.ecommerce.orderSuccess({ orderId: inserted.id });

        // 3. Decrement inventory stock
        if (productId) {
            const { error: stockError } = await supabase.rpc('decrement_stock', {
                p_product_id: productId,
                p_quantity: quantity,
            });
            if (stockError) {
                // Non-fatal: order is placed but stock sync failed
                v2log.warn('V2_ECOMMERCE_ORDER_CREATE', 'Stock decrement failed (order still placed)', {
                    productId, quantity, error: stockError.message,
                });
            }
        }

        return { success: true, orderId: inserted.id };

    } catch (err) {
        v2log.error('V2_ECOMMERCE_ORDER_CREATE', 'Unexpected error during order creation', { err, workspaceId });
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}
