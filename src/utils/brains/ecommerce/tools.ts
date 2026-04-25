import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

export type InventoryItem = {
    item_name: string;
    stock_level: number | null;
    price: number | string | null;
    description?: string | null;
};

export type EcommerceOrderInput = {
    userId: string;
    workspaceId?: string;
    chatId?: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    item?: string | null;
    variant?: string | null;
    payment_method?: string | null;
};

export type OrderActionResult = {
    ok: boolean;
    code:
        | 'missing_fields'
        | 'product_not_found'
        | 'out_of_stock'
        | 'duplicate_prevented'
        | 'order_updated'
        | 'order_saved'
        | 'database_error';
    message: string;
    missingFields?: string[];
    item?: string;
    updatedItems?: string;
    products?: InventoryItem[];
};

export const CheckoutInfoSchema = z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    payment_method: z.string().optional(),
    item: z.string().optional(),
    variant: z.string().optional(),
});

export const getAdminClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
    );
};

function clean(value: string | null | undefined): string | null {
    const v = value?.trim();
    return v ? v : null;
}

function normalize(value: string): string {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseJsonSafe(raw: string | null | undefined): Record<string, any> {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function scopeInventoryQuery(query: any, userId: string, workspaceId?: string) {
    if (workspaceId) return query.eq('workspace_id', workspaceId);
    return query.eq('user_id', userId).is('workspace_id', null);
}

function scopeOrderQuery(query: any, userId: string, workspaceId?: string) {
    query = query.eq('user_id', userId);
    if (workspaceId) return query.eq('workspace_id', workspaceId);
    return query.is('workspace_id', null);
}

export function getMissingCheckoutFields(input: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
    item?: string | null;
}) {
    const missing: string[] = [];
    if (!clean(input.item)) missing.push('item');
    if (!clean(input.name)) missing.push('name');
    if (!clean(input.phone)) missing.push('phone');
    if (!clean(input.address)) missing.push('address');
    return missing;
}

export async function searchInventory(args: {
    supabase: any;
    userId: string;
    workspaceId?: string;
    productName?: string | null;
    limit?: number;
}): Promise<{ items: InventoryItem[]; error?: string }> {
    const { supabase, userId, workspaceId, productName, limit = 10 } = args;

    let query = supabase
        .from('inventory')
        .select('item_name, stock_level, price, description')
        .limit(limit);

    query = scopeInventoryQuery(query, userId, workspaceId);

    if (clean(productName)) {
        query = query.ilike('item_name', `%${clean(productName)}%`);
    }

    const { data, error } = await query;
    if (error) {
        console.error('[EcommerceTools] Inventory search error:', error);
        return { items: [], error: error.message || 'inventory_search_failed' };
    }

    return { items: (data || []) as InventoryItem[] };
}

export function findBestInventoryMatch(items: InventoryItem[], requestedItem: string | null | undefined): InventoryItem | null {
    if (!items.length) return null;
    const requested = clean(requestedItem);
    if (!requested) return items[0];

    const normalizedRequest = normalize(requested);
    const exact = items.find((item) => normalize(item.item_name) === normalizedRequest);
    if (exact) return exact;

    const contains = items.find((item) => normalize(item.item_name).includes(normalizedRequest));
    if (contains) return contains;

    return items[0];
}

export function isItemInStock(item: InventoryItem | null): boolean {
    if (!item) return false;
    if (item.stock_level == null) return true;
    return Number(item.stock_level) > 0;
}

export async function findRecentCustomerOrder(args: {
    supabase: any;
    userId: string;
    workspaceId?: string;
    chatId?: string;
    phone?: string | null;
    name?: string | null;
}) {
    const { supabase, userId, workspaceId, chatId, phone, name } = args;

    let query = supabase
        .from('orders')
        .select('id, item_requested, status, created_at, customer_name, customer_phone, customer_address, raw_message')
        .order('created_at', { ascending: false })
        .limit(1);

    query = scopeOrderQuery(query, userId, workspaceId);

    if (chatId) {
        query = query.eq('instagram_user_id', chatId);
    } else if (clean(phone)) {
        query = query.eq('customer_phone', clean(phone));
    } else if (clean(name)) {
        query = query.ilike('customer_name', `%${clean(name)}%`);
    } else {
        return { order: null, error: null };
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
        console.error('[EcommerceTools] Recent order lookup error:', error);
        return { order: null, error: error.message || 'order_lookup_failed' };
    }

    return { order: data || null, error: null };
}

export async function finalizeEcommerceOrder(args: EcommerceOrderInput & { supabase: any }): Promise<OrderActionResult> {
    const { supabase, userId, workspaceId, chatId } = args;
    const name = clean(args.name);
    const phone = clean(args.phone);
    const address = clean(args.address);
    const item = clean(args.item);
    const variant = clean(args.variant);
    const itemLabel = [item, variant].filter(Boolean).join(' - ');

    const missingFields = getMissingCheckoutFields({ name, phone, address, item });
    if (missingFields.length > 0) {
        return {
            ok: false,
            code: 'missing_fields',
            message: `Missing checkout fields: ${missingFields.join(', ')}`,
            missingFields,
            item: itemLabel || item || undefined,
        };
    }

    const inventoryResult = await searchInventory({ supabase, userId, workspaceId, productName: item, limit: 5 });
    const matchedItem = findBestInventoryMatch(inventoryResult.items, item);

    if (!matchedItem) {
        return {
            ok: false,
            code: 'product_not_found',
            message: `The requested item was not found in inventory: ${item}`,
            item: itemLabel,
            products: inventoryResult.items,
        };
    }

    if (!isItemInStock(matchedItem)) {
        return {
            ok: false,
            code: 'out_of_stock',
            message: `The requested item is out of stock: ${matchedItem.item_name}`,
            item: matchedItem.item_name,
            products: inventoryResult.items,
        };
    }

    try {
        let handle = 'Customer';
        if (chatId) {
            const { data: lastMsg } = await supabase
                .from('activity_log')
                .select('metadata')
                .eq('user_id', userId)
                .filter('metadata->>chat_id', 'eq', chatId)
                .order('timestamp', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (lastMsg?.metadata?.username) handle = lastMsg.metadata.username;
        }

        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        let recentOrderQuery = supabase
            .from('orders')
            .select('id, item_requested, raw_message')
            .eq('status', 'Pending')
            .gte('created_at', thirtyMinsAgo);

        recentOrderQuery = scopeOrderQuery(recentOrderQuery, userId, workspaceId);
        if (chatId) recentOrderQuery = recentOrderQuery.eq('instagram_user_id', chatId);

        const { data: recentOrders } = await recentOrderQuery.order('created_at', { ascending: false }).limit(1);
        const finalItemLabel = itemLabel || matchedItem.item_name;

        if (recentOrders && recentOrders.length > 0) {
            const existingOrder = recentOrders[0];
            const existingItems = existingOrder.item_requested || '';

            if (normalize(existingItems).includes(normalize(finalItemLabel))) {
                return {
                    ok: true,
                    code: 'duplicate_prevented',
                    message: `${finalItemLabel} is already in this pending order.`,
                    item: finalItemLabel,
                    updatedItems: existingItems,
                };
            }

            const updatedItems = `${existingItems}, ${finalItemLabel}`.replace(/^,\s*/, '');
            const existingRaw = parseJsonSafe(existingOrder.raw_message);
            const updatedRaw = {
                ...existingRaw,
                item_variant: variant ? `${existingRaw.item_variant || ''}, ${variant}`.replace(/^,\s*/, '') : existingRaw.item_variant,
                payment_method: args.payment_method || existingRaw.payment_method || 'Cash on Delivery',
            };

            const { error } = await supabase
                .from('orders')
                .update({
                    item_requested: updatedItems,
                    raw_message: JSON.stringify(updatedRaw),
                    customer_name: name,
                    customer_phone: phone,
                    customer_address: address,
                })
                .eq('id', existingOrder.id);

            if (error) throw error;

            return {
                ok: true,
                code: 'order_updated',
                message: `Item added to existing pending order.`,
                item: finalItemLabel,
                updatedItems,
            };
        }

        const { error } = await supabase.from('orders').insert({
            user_id: userId,
            workspace_id: workspaceId || null,
            instagram_user_id: chatId || null,
            instagram_handle: handle,
            status: 'Pending',
            created_at: new Date().toISOString(),
            customer_name: name,
            customer_phone: phone,
            customer_email: clean(args.email),
            item_requested: finalItemLabel,
            customer_address: address,
            raw_message: JSON.stringify({
                item_variant: variant || null,
                payment_method: args.payment_method || 'Cash on Delivery',
                inventory_item_name: matchedItem.item_name,
            }),
        });

        if (error) throw error;

        return {
            ok: true,
            code: 'order_saved',
            message: `Order saved successfully.`,
            item: finalItemLabel,
        };
    } catch (error: any) {
        console.error('[EcommerceTools] Failed to finalize order:', error);
        return {
            ok: false,
            code: 'database_error',
            message: error?.message || 'Database error while saving order.',
            item: itemLabel,
        };
    }
}

export const checkEcommerceInventoryTool = (workspaceId: string, userId?: string) => ({
    description: "Queries the exact real-time stock count and variants for the active workspace's store. Use only as a read tool.",
    parameters: z.object({
        product_name: z.string().describe('The product/category to check. Be broad if checking availability of types.'),
    }),
    execute: async ({ product_name }: any) => {
        const supabase = getAdminClient();
        const effectiveUserId = userId || '';
        console.log(`[Read Tool] check_ecommerce_inventory: ${product_name} | ws: ${workspaceId}`);

        let query = supabase
            .from('inventory')
            .select('item_name, stock_level, price, description')
            .eq('workspace_id', workspaceId)
            .ilike('item_name', `%${product_name}%`)
            .limit(10);

        if (!workspaceId && effectiveUserId) {
            query = supabase
                .from('inventory')
                .select('item_name, stock_level, price, description')
                .eq('user_id', effectiveUserId)
                .is('workspace_id', null)
                .ilike('item_name', `%${product_name}%`)
                .limit(10);
        }

        const { data, error } = await query;
        if (error) {
            console.error('[Read Tool] Inventory error:', error);
            return 'Failed to check inventory due to a system error.';
        }

        if (!data || data.length === 0) return `Product matching "${product_name}" was not found in inventory.`;

        return data
            .map((item: InventoryItem) => `- ${item.item_name}: ${Number(item.stock_level || 0) > 0 ? `${item.stock_level} in stock` : 'OUT OF STOCK'} ($${item.price}). ${item.description || ''}`)
            .join('\n');
    },
});
