/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { cancelLatestOrder } from '../ecommerce/lookup';

type MockOrder = {
    id: string;
    item_requested: string;
    variant_label?: string | null;
    quantity?: number;
    unit_price?: number;
    customer_name?: string;
    customer_phone?: string;
    customer_address?: string;
    status: string;
    created_at: string;
};

function supabaseFor(order: MockOrder | null, updateError: any = null) {
    const selectBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: order, error: null }),
    };

    const updateBuilder = {
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (value: any) => void) => resolve({ error: updateError }),
    };

    return {
        from: vi.fn(() => ({
            select: selectBuilder.select,
            eq: selectBuilder.eq,
            or: selectBuilder.or,
            order: selectBuilder.order,
            limit: selectBuilder.limit,
            maybeSingle: selectBuilder.maybeSingle,
            update: vi.fn(() => updateBuilder),
        })),
        updateBuilder,
    } as any;
}

const baseOrder: MockOrder = {
    id: 'order-1',
    item_requested: 'Ps5',
    status: 'Pending',
    created_at: new Date().toISOString(),
};

describe('cancelLatestOrder', () => {
    it('cancels the latest pending order', async () => {
        const supabase = supabaseFor(baseOrder);
        const result = await cancelLatestOrder(supabase, 'ws-1', 'chat-1');

        expect(result).toMatchObject({ success: true, orderId: 'order-1', productName: 'Ps5' });
        expect(supabase.updateBuilder.eq).toHaveBeenCalledWith('id', 'order-1');
    });

    it('returns already_cancelled for cancelled orders', async () => {
        const result = await cancelLatestOrder(supabaseFor({ ...baseOrder, status: 'Cancelled' }), 'ws-1', 'chat-1');
        expect(result).toMatchObject({ success: false, reason: 'already_cancelled' });
    });

    it('does not cancel fulfilled orders', async () => {
        const result = await cancelLatestOrder(supabaseFor({ ...baseOrder, status: 'Fulfilled' }), 'ws-1', 'chat-1');
        expect(result).toMatchObject({ success: false, reason: 'not_pending_status', status: 'Fulfilled' });
    });

    it('returns no_order when no recent order exists', async () => {
        const result = await cancelLatestOrder(supabaseFor(null), 'ws-1', 'chat-1');
        expect(result).toEqual({ success: false, reason: 'no_order' });
    });
});
