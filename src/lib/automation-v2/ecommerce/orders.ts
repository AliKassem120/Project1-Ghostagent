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
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    itemRequested: string;
    variantLabel?: string | null;
    unitPrice: number;
    quantity: number;
    instagramHandle?: string;
    rawMessage?: string;
    platform?: 'instagram' | 'whatsapp';
    productId?: string | null;
}

export interface CreateOrderResult {
    success: boolean;
    orderId?: string;
    error?: string;
    supabaseCode?: string;
}

/**
 * Creates an order. Returns a structured result so callers never confuse
 * a failed insert with a successful transaction.
 */
export async function createOrderV2(input: CreateOrderInput): Promise<CreateOrderResult> {
    const {
        supabase, userId, workspaceId, chatId, customerName,
        customerPhone, customerAddress, itemRequested,
        variantLabel, unitPrice, quantity,
        instagramHandle = 'Customer', rawMessage = '', platform = 'instagram', productId = null
    } = input;

    v2log.ecommerce.orderAttempt({ workspaceId, itemRequested, customerName });

    try {
        const rawJson = JSON.stringify({
            platform,
            chat_id: chatId,
            workspace_id: workspaceId,
            product_id: productId,
            item_variant: variantLabel || null,
            unit_price: unitPrice,
            quantity,
            total_price: unitPrice * quantity,
            original_message: rawMessage
        });

        const insertPayload: any = {
            user_id: userId,
            workspace_id: workspaceId,
            instagram_user_id: chatId,
            instagram_handle: instagramHandle,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_address: customerAddress,
            item_requested: `${itemRequested}${variantLabel ? ` (${variantLabel})` : ''} x${quantity}`,
            variant_label: variantLabel || null,
            quantity,
            unit_price: unitPrice,
            status: 'Pending',
            raw_message: rawJson,
            created_at: new Date().toISOString()
        };

        // These columns are added by the reliability migration. If a database
        // has not run it yet, the insert error is returned clearly below.
        insertPayload.platform = platform;
        insertPayload.chat_id = chatId;

        const { data: inserted, error } = await supabase
            .from('orders')
            .insert(insertPayload)
            .select('id')
            .single();

        if (error) {
            v2log.ecommerce.orderError({ error, workspaceId });
            return {
                success: false,
                error: error.message || 'Order insert failed',
                supabaseCode: error.code,
            };
        }

        v2log.ecommerce.orderSuccess({ orderId: inserted.id });
        return { success: true, orderId: inserted.id };

    } catch (err: any) {
        const message = err?.message || String(err);
        v2log.error('V2_ECOMMERCE_ORDER_CREATE', 'Unexpected error during order creation', { err, workspaceId, chatId, platform });
        return { success: false, error: message };
    }
}
