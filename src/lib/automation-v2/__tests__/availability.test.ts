/**
 * ═══════════════════════════════════════════════════════════════
 * Tests — Appointment Availability Status Filtering
 * ═══════════════════════════════════════════════════════════════
 * Verifies that only 'confirmed' and 'pending' appointments
 * block time slots. Completed, cancelled, and no_show should
 * NOT prevent new bookings.
 */

import { describe, it, expect, vi } from 'vitest';
import { checkAvailability } from '../appointments/availability';
import type { BusinessHoursRecord } from '../types';

// ── Mock business hours: open 09:00–18:00 every day ────────

const mockBusinessHours: BusinessHoursRecord[] = Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    openTime: '09:00',
    closeTime: '18:00',
    isOpen: true,
}));

// ── Mock Supabase builder ───────────────────────────────────

/**
 * Creates a mock supabase client whose `.from('appointments')`
 * chain filters by the given appointments array.
 *
 * The mock tracks the `.in('status', [...])` call to verify
 * that only active statuses are queried.
 */
function createMockSupabase(appointments: { id: string; start_time: string; end_time: string; status: string }[]) {
    const statusFilter: string[] = [];

    const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn((column: string, values: string[]) => {
            if (column === 'status') {
                statusFilter.push(...values);
            }
            // Filter appointments by status
            const filtered = appointments.filter(a => values.includes(a.status));
            return {
                ...builder,
                // Override: after .in() the data resolves to filtered results
                _filteredData: filtered,
                then: (resolve: (val: { data: typeof filtered; error: null }) => void) => {
                    resolve({ data: filtered, error: null });
                },
            };
        }),
        then: (resolve: (val: { data: typeof appointments; error: null }) => void) => {
            resolve({ data: appointments, error: null });
        },
    };

    const supabase = {
        from: vi.fn(() => builder),
        _statusFilter: statusFilter,
        _builder: builder,
    };

    return supabase;
}

// ── Tests ───────────────────────────────────────────────────

describe('Availability - Status Filtering', () => {
    const baseArgs = {
        workspaceId: 'ws-1',
        date: '2026-05-06', // A Tuesday
        startTime: '10:00',
        durationMinutes: 30,
        businessHours: mockBusinessHours,
    };

    it('confirmed appointment BLOCKS the same slot', async () => {
        const supabase = createMockSupabase([
            { id: 'a1', start_time: '10:00', end_time: '10:30', status: 'confirmed' },
        ]);

        const result = await checkAvailability({
            ...baseArgs,
            supabase: supabase as any,
        });

        expect(result.available).toBe(false);
        expect(result.reason).toBe('overlap');
    });

    it('pending appointment BLOCKS the same slot', async () => {
        const supabase = createMockSupabase([
            { id: 'a2', start_time: '10:00', end_time: '10:30', status: 'pending' },
        ]);

        const result = await checkAvailability({
            ...baseArgs,
            supabase: supabase as any,
        });

        expect(result.available).toBe(false);
        expect(result.reason).toBe('overlap');
    });

    it('completed appointment does NOT block the same slot', async () => {
        const supabase = createMockSupabase([
            { id: 'a3', start_time: '10:00', end_time: '10:30', status: 'completed' },
        ]);

        const result = await checkAvailability({
            ...baseArgs,
            supabase: supabase as any,
        });

        expect(result.available).toBe(true);
    });

    it('cancelled appointment does NOT block the same slot', async () => {
        const supabase = createMockSupabase([
            { id: 'a4', start_time: '10:00', end_time: '10:30', status: 'cancelled' },
        ]);

        const result = await checkAvailability({
            ...baseArgs,
            supabase: supabase as any,
        });

        expect(result.available).toBe(true);
    });

    it('no_show appointment does NOT block the same slot', async () => {
        const supabase = createMockSupabase([
            { id: 'a5', start_time: '10:00', end_time: '10:30', status: 'no_show' },
        ]);

        const result = await checkAvailability({
            ...baseArgs,
            supabase: supabase as any,
        });

        expect(result.available).toBe(true);
    });

    it('mixed statuses: only active ones block', async () => {
        const supabase = createMockSupabase([
            { id: 'a6', start_time: '10:00', end_time: '10:30', status: 'completed' },
            { id: 'a7', start_time: '10:00', end_time: '10:30', status: 'cancelled' },
            { id: 'a8', start_time: '14:00', end_time: '14:30', status: 'confirmed' },
        ]);

        // 10:00 slot — completed+cancelled don't block
        const result = await checkAvailability({
            ...baseArgs,
            supabase: supabase as any,
        });

        expect(result.available).toBe(true);
    });

    it('queries only confirmed and pending statuses', async () => {
        const supabase = createMockSupabase([]);

        await checkAvailability({
            ...baseArgs,
            supabase: supabase as any,
        });

        // Verify the .in() call was made with correct statuses
        expect(supabase._builder.in).toHaveBeenCalledWith('status', ['confirmed', 'pending']);
    });
});
