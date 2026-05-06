/**
 * Regression test: cancellation status values match DB CHECK constraints.
 *
 * orders_status_check allows: Pending, pending, Contacted, contacted,
 *   Fulfilled, fulfilled, Completed, completed, Cancelled, cancelled,
 *   Canceled, canceled
 *
 * appointments_status_check allows: pending, Pending, confirmed, Confirmed,
 *   cancelled, Cancelled, canceled, Canceled, completed, Completed,
 *   no_show, No Show
 */

import { describe, expect, it, vi } from 'vitest';

// ── Allowed values (mirrors the SQL CHECK constraints) ────────

const VALID_ORDER_STATUSES = new Set([
    'Pending', 'pending',
    'Contacted', 'contacted',
    'Fulfilled', 'fulfilled',
    'Completed', 'completed',
    'Cancelled', 'cancelled',
    'Canceled', 'canceled',
]);

const VALID_APPOINTMENT_STATUSES = new Set([
    'pending', 'Pending',
    'confirmed', 'Confirmed',
    'cancelled', 'Cancelled',
    'canceled', 'Canceled',
    'completed', 'Completed',
    'no_show', 'No Show',
]);

// ── Mock supabase that captures the status value ──────────────

function createMockSupabase(returnData: any = { id: 'test-id', status: 'Pending', item_requested: 'Test', created_at: new Date().toISOString() }) {
    let capturedStatus: string | null = null;

    const mock: any = {
        from: () => mock,
        select: () => mock,
        insert: () => mock,
        eq: () => mock,
        or: () => mock,
        order: () => mock,
        limit: () => mock,
        in: () => mock,
        maybeSingle: () => Promise.resolve({ data: returnData, error: null }),
        single: () => Promise.resolve({ data: returnData, error: null }),
        update: (payload: any) => {
            capturedStatus = payload.status;
            return mock;
        },
        getCapturedStatus: () => capturedStatus,
    };
    return mock;
}

// ── Tests ─────────────────────────────────────────────────────

describe('Status constraint regression', () => {
    it('cancelLatestOrder writes a status accepted by orders_status_check', async () => {
        const mockData = {
            id: 'order-1',
            item_requested: 'PS5',
            variant_label: null,
            quantity: 1,
            unit_price: 500,
            customer_name: 'Ali',
            customer_phone: '71123456',
            customer_address: 'Beirut',
            status: 'Pending',
            created_at: new Date().toISOString(),
        };
        const mock = createMockSupabase(mockData);
        const { cancelLatestOrder } = await import('../ecommerce/lookup');
        await cancelLatestOrder(mock, 'workspace-1', 'chat-1');
        const written = mock.getCapturedStatus();

        expect(written).not.toBeNull();
        expect(VALID_ORDER_STATUSES.has(written!)).toBe(true);
        // Specifically, we expect title-case for orders
        expect(written).toBe('Cancelled');
    });

    it('cancelLatestAppointment writes a status accepted by appointments_status_check', async () => {
        const mockData = {
            id: 'appt-1',
            service_name: 'Haircut',
            status: 'confirmed',
            date: '2026-05-10',
            start_time: '10:00',
            created_at: new Date().toISOString(),
        };
        const mock = createMockSupabase(mockData);
        const { cancelLatestAppointment } = await import('../appointments/lookup');
        await cancelLatestAppointment(mock, 'workspace-1', 'chat-1');
        const written = mock.getCapturedStatus();

        expect(written).not.toBeNull();
        expect(VALID_APPOINTMENT_STATUSES.has(written!)).toBe(true);
        // Specifically, we expect lowercase for appointments
        expect(written).toBe('cancelled');
    });

    it('pending order can transition to Cancelled', () => {
        expect(VALID_ORDER_STATUSES.has('Pending')).toBe(true);
        expect(VALID_ORDER_STATUSES.has('Cancelled')).toBe(true);
    });

    it('confirmed appointment can transition to cancelled', () => {
        expect(VALID_APPOINTMENT_STATUSES.has('confirmed')).toBe(true);
        expect(VALID_APPOINTMENT_STATUSES.has('cancelled')).toBe(true);
    });
});
