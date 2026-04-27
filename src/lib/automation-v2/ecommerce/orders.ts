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
}

export async function createOrderV2(input: CreateOrderInput): Promise<boolean> {
    const { 
        supabase, userId, workspaceId, chatId, customerName, 
        customerPhone, customerAddress, itemRequested, 
        variantLabel, unitPrice, quantity, 
        instagramHandle = 'Customer', rawMessage = ''
    } = input;

    v2log.ecommerce.orderAttempt({ workspaceId, itemRequested, customerName });

    try {
        // 1. Prepare raw_message JSON for extra context (dashboard uses this)
        const rawJson = JSON.stringify({
            platform: 'instagram',
            chat_id: chatId,
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
                instagram_user_id: chatId,
                instagram_handle: instagramHandle,
                customer_name: customerName,
                customer_phone: customerPhone,
                customer_address: customerAddress,
                item_requested: `${itemRequested}${variantLabel ? ` (${variantLabel})` : ''} x${quantity}`,
                status: 'Pending',
                raw_message: rawJson,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            v2log.ecommerce.orderError({ error, workspaceId });
            return false;
        }

        v2log.ecommerce.orderSuccess({ orderId: inserted.id });
        return true;

    } catch (err) {
        v2log.error('V2_ECOMMERCE_ORDER_CREATE', 'Unexpected error during order creation', { err, workspaceId });
        return false;
    }
}
