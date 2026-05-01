/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: E-Commerce Orders
 * ═══════════════════════════════════════════════════════════════
 * Handles the database insert for orders.
 * Inserts into the same 'orders' table the dashboard uses.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v2log } from '../logger';
import { generateWhishPaymentLink } from './whish';

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

export async function createOrderV2(input: CreateOrderInput): Promise<{ success: boolean; paymentUrl?: string }> {
    const { 
        supabase, userId, workspaceId, chatId, customerName, 
        customerPhone, customerAddress, itemRequested, 
        variantLabel, unitPrice, quantity, 
        instagramHandle = 'Customer', rawMessage = ''
    } = input;

    v2log.ecommerce.orderAttempt({ workspaceId, itemRequested, customerName });

    try {
        // 1. Generate unique Whish numeric ID (externalId)
        const whishExternalId = Math.floor(Math.random() * 1000000000) + Date.now() % 100000;

        // 2. Prepare raw_message JSON for extra context (dashboard uses this)
        const rawJson = JSON.stringify({
            platform: 'instagram',
            chat_id: chatId,
            item_variant: variantLabel || 'N/A',
            unit_price: unitPrice,
            quantity: quantity,
            total_price: unitPrice * quantity,
            whish_external_id: whishExternalId,
            original_message: rawMessage
        });

        // 3. Generate Whish URL BEFORE inserting the order (so we don't save broken orders if Whish is down)
        const paymentUrl = await generateWhishPaymentLink({
            amount: unitPrice * quantity,
            currency: 'USD',
            invoice: `Order: ${itemRequested} x${quantity}`,
            externalId: whishExternalId
        });

        // 4. Insert into orders table (even if paymentUrl fails, we still record the order, but we can set status accordingly)
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
                status: paymentUrl ? 'Pending Payment' : 'Pending',
                raw_message: rawJson,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            v2log.ecommerce.orderError({ error, workspaceId });
            return { success: false };
        }

        v2log.ecommerce.orderSuccess({ orderId: inserted.id });
        return { success: true, paymentUrl: paymentUrl || undefined };

    } catch (err) {
        v2log.error('V2_ECOMMERCE_ORDER_CREATE', 'Unexpected error during order creation', { err, workspaceId });
        return { success: false };
    }
}
