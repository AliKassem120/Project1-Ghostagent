/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { processEcommerceState } from '../state/ecommerce-fsm';
import { createOrderV2 } from '../ecommerce/orders';

vi.mock('../ecommerce/orders', () => ({
    createOrderV2: vi.fn(),
}));

function createSupabaseMock() {
    const ordersBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: (resolve: (value: any) => void) => resolve({ data: [], error: null }),
    };

    const inventoryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { stock_level: 5 }, error: null }),
    };

    return {
        from: vi.fn((table: string) => table === 'inventory' ? inventoryBuilder : ordersBuilder),
    } as any;
}

function checkoutState() {
    return {
        stage: 'awaiting_checkout_confirmation',
        pendingAction: 'create_order',
        order: {
            productId: 'prod-1',
            productName: 'Ps5',
            unitPrice: 500,
            quantity: 1,
        },
        customer: {
            name: 'Ali Kassem',
            phone: '78820707',
            address: 'Beirut',
        },
        missingFields: [],
    } as any;
}

function ctx(message: string) {
    return {
        supabase: createSupabaseMock(),
        userId: 'user-1',
        workspaceId: 'ws-1',
        chatId: '96178820707',
        platform: 'whatsapp',
        message,
        language: 'english',
        config: { timezone: 'Asia/Beirut' },
    } as any;
}

describe('ecommerce FSM reliability', () => {
    beforeEach(() => {
        vi.mocked(createOrderV2).mockReset();
    });

    it('creates the order immediately on Yes', async () => {
        vi.mocked(createOrderV2).mockResolvedValue({ success: true, orderId: 'order-1' });

        const result = await processEcommerceState(ctx('Yes'), checkoutState());

        expect(createOrderV2).toHaveBeenCalledOnce();
        expect(result.replyText).toContain('Order confirmed');
        expect(result.actions).toContain('order_created');
        expect(result.dbWriteSuccess).toBe(true);
    });

    it('creates the order immediately on Yeahh', async () => {
        vi.mocked(createOrderV2).mockResolvedValue({ success: true, orderId: 'order-2' });

        const result = await processEcommerceState(ctx('Yeahh'), checkoutState());

        expect(createOrderV2).toHaveBeenCalledOnce();
        expect(result.replyText).toContain('Order confirmed');
        expect(result.actions).not.toContain('asked_confirmation_again');
    });

    it('does not confirm when the insert fails', async () => {
        vi.mocked(createOrderV2).mockResolvedValue({ success: false, error: 'insert failed' });

        const result = await processEcommerceState(ctx('Yes'), checkoutState());

        expect(createOrderV2).toHaveBeenCalledOnce();
        expect(result.replyText).toBe('Something went wrong. Please try again.');
        expect(result.dbWriteSuccess).toBe(false);
    });
});
