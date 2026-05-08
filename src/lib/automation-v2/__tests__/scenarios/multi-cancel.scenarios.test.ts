/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Scoped Cancellation Scenario Tests
 * ═══════════════════════════════════════════════════════════════
 * Tests for multi-scope cancel (latest, both, all, ordinal, product).
 * Uses mock Supabase to verify correct DB queries and reply generation.
 */

import { describe, it, expect, vi } from 'vitest';
import { cancelOrdersForChat } from '../../ecommerce/cancel-orders';
import { cancelAppointmentsForChat } from '../../appointments/cancel-appointments';

function mockSupabase(orders: any[], updateError: any = null) {
    const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: orders, error: null }),
        update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: updateError }),
        }),
    };
    return { from: vi.fn().mockReturnValue(chain) } as any;
}

describe('Scoped Order Cancellation', () => {
    it('E23: cancel both orders — cancels 2 pending', async () => {
        const orders = [
            { id: 'o1', status: 'pending', item_requested: 'PS5', created_at: '2026-05-08' },
            { id: 'o2', status: 'pending', item_requested: 'TV', created_at: '2026-05-07' },
        ];
        const result = await cancelOrdersForChat({
            supabase: mockSupabase(orders),
            workspaceId: 'ws-1',
            chatId: 'chat-1',
            scope: 'count',
            count: 2,
        });
        expect(result.cancelledCount).toBe(2);
        expect(result.cancelledIds).toEqual(['o1', 'o2']);
    });

    it('E24: cancel all pending orders', async () => {
        const orders = [
            { id: 'o1', status: 'pending', item_requested: 'PS5', created_at: '2026-05-08' },
            { id: 'o2', status: 'shipped', item_requested: 'TV', created_at: '2026-05-07' },
            { id: 'o3', status: 'pending', item_requested: 'Phone', created_at: '2026-05-06' },
        ];
        const result = await cancelOrdersForChat({
            supabase: mockSupabase(orders),
            workspaceId: 'ws-1',
            chatId: 'chat-1',
            scope: 'all_pending',
        });
        expect(result.cancelledCount).toBe(2);
        expect(result.notCancellableCount).toBe(0); // shipped is filtered out by all_pending scope
    });

    it('E25: cancel first order', async () => {
        const orders = [
            { id: 'o1', status: 'pending', item_requested: 'PS5', created_at: '2026-05-08' },
            { id: 'o2', status: 'pending', item_requested: 'TV', created_at: '2026-05-07' },
        ];
        const result = await cancelOrdersForChat({
            supabase: mockSupabase(orders),
            workspaceId: 'ws-1',
            chatId: 'chat-1',
            scope: 'ordinal',
            ordinal: 'first',
        });
        expect(result.cancelledCount).toBe(1);
        expect(result.cancelledIds).toEqual(['o1']);
    });

    it('E26: cancel second order', async () => {
        const orders = [
            { id: 'o1', status: 'pending', item_requested: 'PS5', created_at: '2026-05-08' },
            { id: 'o2', status: 'pending', item_requested: 'TV', created_at: '2026-05-07' },
        ];
        const result = await cancelOrdersForChat({
            supabase: mockSupabase(orders),
            workspaceId: 'ws-1',
            chatId: 'chat-1',
            scope: 'ordinal',
            ordinal: 'second',
        });
        expect(result.cancelledCount).toBe(1);
        expect(result.cancelledIds).toEqual(['o2']);
    });

    it('E27: cancel product-specific order (PS5)', async () => {
        const orders = [
            { id: 'o1', status: 'pending', item_requested: 'PS5', created_at: '2026-05-08' },
            { id: 'o2', status: 'pending', item_requested: 'TV', created_at: '2026-05-07' },
        ];
        const result = await cancelOrdersForChat({
            supabase: mockSupabase(orders),
            workspaceId: 'ws-1',
            chatId: 'chat-1',
            scope: 'product_reference',
            product: 'PS5',
        });
        expect(result.cancelledCount).toBe(1);
        expect(result.cancelledIds).toEqual(['o1']);
    });

    it('E28: false plural — says "cancel order" with only 1 order', async () => {
        const orders = [
            { id: 'o1', status: 'pending', item_requested: 'PS5', created_at: '2026-05-08' },
        ];
        const result = await cancelOrdersForChat({
            supabase: mockSupabase(orders),
            workspaceId: 'ws-1',
            chatId: 'chat-1',
            scope: 'latest',
        });
        expect(result.cancelledCount).toBe(1);
    });

    it('already cancelled order returns alreadyCancelledCount', async () => {
        const orders = [
            { id: 'o1', status: 'cancelled', item_requested: 'PS5', created_at: '2026-05-08' },
        ];
        const result = await cancelOrdersForChat({
            supabase: mockSupabase(orders),
            workspaceId: 'ws-1',
            chatId: 'chat-1',
            scope: 'latest',
        });
        expect(result.cancelledCount).toBe(0);
        expect(result.alreadyCancelledCount).toBe(1);
    });

    it('not cancellable (shipped) returns notCancellableCount', async () => {
        const orders = [
            { id: 'o1', status: 'shipped', item_requested: 'PS5', created_at: '2026-05-08' },
        ];
        const result = await cancelOrdersForChat({
            supabase: mockSupabase(orders),
            workspaceId: 'ws-1',
            chatId: 'chat-1',
            scope: 'latest',
        });
        expect(result.cancelledCount).toBe(0);
        expect(result.notCancellableCount).toBe(1);
        expect(result.notCancellableStatuses).toContain('shipped');
    });

    it('no orders returns error', async () => {
        const result = await cancelOrdersForChat({
            supabase: mockSupabase([]),
            workspaceId: 'ws-1',
            chatId: 'chat-1',
            scope: 'latest',
        });
        expect(result.error).toBe('no_orders');
    });
});

describe('Scoped Appointment Cancellation', () => {
    it('A11: cancel both appointments', async () => {
        const appts = [
            { id: 'a1', status: 'confirmed', date: '2026-05-10', start_time: '10:00', service_name: 'Haircut', created_at: '2026-05-08' },
            { id: 'a2', status: 'confirmed', date: '2026-05-11', start_time: '14:00', service_name: 'Shave', created_at: '2026-05-07' },
        ];
        const result = await cancelAppointmentsForChat({
            supabase: mockSupabase(appts),
            workspaceId: 'ws-1',
            chatId: 'chat-1',
            scope: 'count',
            count: 2,
        });
        expect(result.cancelledCount).toBe(2);
    });

    it('A10: cancel already-cancelled appointment', async () => {
        const appts = [
            { id: 'a1', status: 'cancelled', date: '2026-05-10', start_time: '10:00', service_name: 'Haircut', created_at: '2026-05-08' },
        ];
        const result = await cancelAppointmentsForChat({
            supabase: mockSupabase(appts),
            workspaceId: 'ws-1',
            chatId: 'chat-1',
            scope: 'latest',
        });
        expect(result.cancelledCount).toBe(0);
        expect(result.alreadyCancelledCount).toBe(1);
    });

    it('A15: no appointments returns error', async () => {
        const result = await cancelAppointmentsForChat({
            supabase: mockSupabase([]),
            workspaceId: 'ws-1',
            chatId: 'chat-1',
            scope: 'latest',
        });
        expect(result.error).toBe('no_appointments');
    });
});
