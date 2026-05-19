import { describe, it, expect, vi } from 'vitest';
import { checkProductStock } from '../ai/ecommerce/inventory';
import { createOrderV2 } from '../ai/ecommerce/orders';
import { cancelLatestOrder } from '../ai/ecommerce/lookup';
import type { InventoryRecord } from '../types';

describe('Audit Fixes — checkProductStock Variant Matching', () => {
    it('correctly matches short size string variants and avoids false substring matches (e.g. xl matching l)', () => {
        const product: InventoryRecord = {
            id: 'prod_1',
            itemName: 'Cool T-Shirt',
            price: 25,
            stockLevel: 10,
            description: 'A cool t-shirt',
            variants: ['L', 'XL']
        };

        // XL query matches XL
        const resXL = checkProductStock(product, 'XL');
        expect(resXL.variantMatch).toBe('XL');

        // L query matches L
        const resL = checkProductStock(product, 'L');
        expect(resL.variantMatch).toBe('L');

        // M query does not match anything (returns unknown_variant)
        const resM = checkProductStock(product, 'M');
        expect(resM.reason).toBe('unknown_variant');
    });

    it('matches object variants correctly based on labels', () => {
        const product: InventoryRecord = {
            id: 'prod_2',
            itemName: 'Fancy Jeans',
            price: 50,
            stockLevel: 5,
            description: 'Fancy jeans',
            variants: [
                { label: 'Blue / 32', stock: 2 },
                { label: 'Black / 34', stock: 3 }
            ]
        };

        const resBlue = checkProductStock(product, 'blue');
        expect(resBlue.variantMatch?.label).toBe('Blue / 32');

        const resBlack = checkProductStock(product, 'Black / 34');
        expect(resBlack.variantMatch?.label).toBe('Black / 34');
    });
});

describe('Audit Fixes — CSV Inventory Stock RPC Bypass', () => {
    it('skips decrement_stock for CSV product IDs in createOrderV2', async () => {
        const mockRpc = vi.fn().mockResolvedValue({ error: null });
        const mockSupabase = {
            from: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
                data: { id: 'order_123' },
                error: null
            }),
            rpc: mockRpc
        } as any;

        const res = await createOrderV2({
            supabase: mockSupabase,
            userId: 'user_123',
            workspaceId: 'ws_123',
            chatId: 'chat_123',
            platform: 'instagram',
            productId: 'csv-0', // CSV-style ID
            customerName: 'Alice',
            customerPhone: '123456',
            customerAddress: '123 Main St',
            itemRequested: 'Shirt',
            unitPrice: 20,
            quantity: 1
        });

        expect(res.success).toBe(true);
        expect(mockRpc).not.toHaveBeenCalled();
    });

    it('skips restore_stock for CSV product IDs in cancelLatestOrder', async () => {
        const mockRpc = vi.fn().mockResolvedValue({ error: null });
        const mockSupabase = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: {
                    id: 'order_123',
                    item_requested: 'Shirt',
                    quantity: 1,
                    unit_price: 20,
                    status: 'pending',
                    created_at: new Date().toISOString(),
                    raw_message: JSON.stringify({ product_id: 'csv-0' })
                },
                error: null
            }),
            update: vi.fn().mockReturnThis(),
            rpc: mockRpc
        } as any;

        // Mock update to return success
        mockSupabase.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

        const res = await cancelLatestOrder(mockSupabase, 'ws_123', 'chat_123');

        expect(res.success).toBe(true);
        expect(mockRpc).not.toHaveBeenCalled();
    });
});
