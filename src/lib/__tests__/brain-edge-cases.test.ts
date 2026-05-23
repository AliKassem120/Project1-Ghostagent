import { describe, it, expect, vi } from 'vitest';
import { buildTimeContext, resolveDateFromMessage, resolveTimeFromMessage, timeToMinutes, minutesToTime, formatTime12, formatDateLabel } from '../ai/time';
import { checkProductStock } from '../ai/ecommerce/inventory';
import { checkAvailability } from '../ai/appointments/availability';
import { getHoursForDay, isWithinHours } from '../ai/appointments/hours';
import type { BusinessHoursRecord, InventoryRecord } from '../ai/types';

describe('Brain Edge Cases — Time Parsing & Resolution', () => {
    it('correctly builds time context for a specific timezone', () => {
        const ctx = buildTimeContext('America/New_York');
        expect(ctx.timezone).toBe('America/New_York');
        expect(ctx.isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(ctx.isoTime).toMatch(/^\d{2}:\d{2}$/);
        expect(ctx.dayOfWeek).toBeGreaterThanOrEqual(0);
        expect(ctx.dayOfWeek).toBeLessThanOrEqual(6);
    });

    it('resolves date references from messages in multiple languages', () => {
        const fakeNow = new Date('2026-05-20T10:00:00Z'); // Wednesday, May 20, 2026
        const timeCtx = {
            now: fakeNow,
            timezone: 'UTC',
            isoDate: '2026-05-20',
            isoTime: '10:00',
            dayOfWeek: 3, // Wednesday
            dayName: 'Wednesday',
            tomorrowDate: '2026-05-21',
            tomorrowDayOfWeek: 4, // Thursday
        };

        // Today words
        expect(resolveDateFromMessage('today please', timeCtx)).toBe('2026-05-20');
        expect(resolveDateFromMessage('bade lyom', timeCtx)).toBe('2026-05-20'); // Arabizi
        expect(resolveDateFromMessage('اليوم', timeCtx)).toBe('2026-05-20'); // Arabic
        expect(resolveDateFromMessage("aujourd'hui", timeCtx)).toBe('2026-05-20'); // French
        expect(resolveDateFromMessage('hoy', timeCtx)).toBe('2026-05-20'); // Spanish

        // Tomorrow words
        expect(resolveDateFromMessage('tomorrow morning', timeCtx)).toBe('2026-05-21');
        expect(resolveDateFromMessage('bukra inshalla', timeCtx)).toBe('2026-05-21');
        expect(resolveDateFromMessage('بكرا', timeCtx)).toBe('2026-05-21');
        expect(resolveDateFromMessage('demain', timeCtx)).toBe('2026-05-21');

        // Day after tomorrow
        expect(resolveDateFromMessage('ba3d bukra', timeCtx)).toBe('2026-05-22');
        expect(resolveDateFromMessage('after tomorrow please', timeCtx)).toBe('2026-05-22');
        expect(resolveDateFromMessage('après-demain', timeCtx)).toBe('2026-05-22');

        // Day names (English/Arabizi/Arabic)
        // Wednesday is 3. Thursday is 4, Friday is 5.
        expect(resolveDateFromMessage('on friday', timeCtx)).toBe('2026-05-22'); // Friday is 2 days ahead
        expect(resolveDateFromMessage('nhar l tnen', timeCtx)).toBe('2026-05-25'); // Monday is next week (5 days ahead)
        expect(resolveDateFromMessage('يوم الجمعة', timeCtx)).toBe('2026-05-22');
    });

    it('resolves time references from messages in multiple formats', () => {
        // Time of day keywords (Arabizi)
        expect(resolveTimeFromMessage('ba3d l doher')).toBe('14:00');
        expect(resolveTimeFromMessage('bel lel')).toBe('20:00');
        expect(resolveTimeFromMessage('bel sobo7')).toBe('09:00');

        // AM/PM matches
        expect(resolveTimeFromMessage('at 4pm')).toBe('16:00');
        expect(resolveTimeFromMessage('10 am')).toBe('10:00');
        expect(resolveTimeFromMessage('12 pm')).toBe('12:00');
        expect(resolveTimeFromMessage('12 am')).toBe('00:00');

        // Arabizi style hour expressions (se3a / sa3a)
        expect(resolveTimeFromMessage('se3a 5')).toBe('17:00'); // Bare 5 afternoon default PM
        expect(resolveTimeFromMessage('se3a 10 sobo7')).toBe('10:00'); // Morning explicit override
        expect(resolveTimeFromMessage('sa3a 2:30')).toBe('14:30');
        expect(resolveTimeFromMessage('aal 6')).toBe('18:00');

        // French / Spanish / Arabic times
        expect(resolveTimeFromMessage('à 11h')).toBe('11:00');
        expect(resolveTimeFromMessage('a las 15')).toBe('15:00');
        expect(resolveTimeFromMessage('الساعة ٩')).toBe('09:00');

        // Bare number
        expect(resolveTimeFromMessage('18')).toBe('18:00');
        expect(resolveTimeFromMessage('25')).toBeNull(); // Out of bound hour
    });

    it('handles format time converters correctly', () => {
        expect(timeToMinutes('09:30')).toBe(570);
        expect(minutesToTime(570)).toBe('09:30');
        expect(formatTime12('14:05')).toBe('2:05 PM');
        expect(formatTime12('09:00')).toBe('9:00 AM');
    });
});

describe('Brain Edge Cases — Product Inventory Resolution', () => {
    const testProduct: InventoryRecord = {
        id: 'p1',
        itemName: 'Stylish Leather Jacket',
        price: 120,
        stockLevel: 15,
        description: 'Premium jacket',
        variants: [
            { label: 'Black / S', stock: 5 },
            { label: 'Black / M', stock: 0 },
            { label: 'Brown / L', stock: 10 }
        ]
    };

    it('resolves stock check correctly when no variant query is supplied', () => {
        const res = checkProductStock(testProduct);
        expect(res.inStock).toBe(true);
        expect(res.availableStock).toBe(15);
        expect(res.variantMatch).toBeUndefined();
    });

    it('handles exact size matching and case-insensitivity', () => {
        const res1 = checkProductStock(testProduct, 'Brown / L');
        expect(res1.inStock).toBe(true);
        expect(res1.availableStock).toBe(10);
        expect(res1.variantMatch?.label).toBe('Brown / L');

        const res2 = checkProductStock(testProduct, 'black / s');
        expect(res2.inStock).toBe(true);
        expect(res2.availableStock).toBe(5);
    });

    it('handles sold-out variant matching', () => {
        const res = checkProductStock(testProduct, 'Black / M');
        expect(res.inStock).toBe(false);
        expect(res.reason).toBe('sold_out');
    });

    it('handles unknown variant query gracefully', () => {
        const res = checkProductStock(testProduct, 'Pink / XL');
        expect(res.inStock).toBe(false);
        expect(res.reason).toBe('unknown_variant');
    });
});

describe('Brain Edge Cases — Appointments & Working Hours', () => {
    const businessHours: BusinessHoursRecord[] = [
        { dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Monday
        { dayOfWeek: 2, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Tuesday
        { dayOfWeek: 3, isOpen: false, openTime: '00:00', closeTime: '00:00' }, // Wednesday (Closed)
    ];

    it('correctly verifies if time is within open hours', () => {
        const mondayHours = getHoursForDay(businessHours, 1);
        expect(mondayHours).not.toBeNull();
        expect(isWithinHours('10:00', mondayHours!)).toBe(true);
        expect(isWithinHours('08:59', mondayHours!)).toBe(false);
        expect(isWithinHours('17:00', mondayHours!)).toBe(false);
    });

    it('handles closed business days', () => {
        const wednesdayHours = getHoursForDay(businessHours, 3);
        expect(wednesdayHours).not.toBeNull();
        expect(isWithinHours('10:00', wednesdayHours!)).toBe(false);
    });

    it('verifies appointments checkAvailability logic matches slot open hours', async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            // Mock empty overlaps response
            maybeSingle: vi.fn().mockResolvedValue({ data: [], error: null }),
        } as any;

        // Mock method chain
        mockSupabase.in.mockReturnValue({
            then: (resolve: any) => resolve({ data: [], error: null }),
        });

        // Booking on Monday 10:00 AM (duration 30 mins) -> within open hours (09:00 - 17:00)
        const resOpen = await checkAvailability({
            supabase: mockSupabase,
            workspaceId: 'ws1',
            date: '2026-05-18', // Monday
            startTime: '10:00',
            durationMinutes: 30,
            businessHours
        });
        expect(resOpen.available).toBe(true);

        // Booking on Wednesday -> Closed
        const resClosed = await checkAvailability({
            supabase: mockSupabase,
            workspaceId: 'ws1',
            date: '2026-05-20', // Wednesday
            startTime: '10:00',
            durationMinutes: 30,
            businessHours
        });
        expect(resClosed.available).toBe(false);
        expect(resClosed.reason).toBe('closed');

        // Booking on Monday at 08:30 AM -> Before opening
        const resEarly = await checkAvailability({
            supabase: mockSupabase,
            workspaceId: 'ws1',
            date: '2026-05-18', // Monday
            startTime: '08:30',
            durationMinutes: 30,
            businessHours
        });
        expect(resEarly.available).toBe(false);
        expect(resEarly.reason).toBe('outside_hours');
    });

    it('correctly detects overlapping appointment bookings', async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
        } as any;

        // Mock overlapping appointments: 10:00 to 10:45
        mockSupabase.in.mockReturnValue({
            then: (resolve: any) => resolve({
                data: [
                    { id: 'apt1', start_time: '10:00', end_time: '10:45' }
                ],
                error: null
            }),
        });

        // Test check overlapping slot: 10:30 to 11:00 (overlaps)
        const resOverlap = await checkAvailability({
            supabase: mockSupabase,
            workspaceId: 'ws1',
            date: '2026-05-18', // Monday
            startTime: '10:30',
            durationMinutes: 30,
            businessHours
        });
        expect(resOverlap.available).toBe(false);
        expect(resOverlap.reason).toBe('overlap');

        // Test non-overlapping slot: 10:45 to 11:15 (free slot immediately after)
        const resFree = await checkAvailability({
            supabase: mockSupabase,
            workspaceId: 'ws1',
            date: '2026-05-18', // Monday
            startTime: '10:45',
            durationMinutes: 30,
            businessHours
        });
        expect(resFree.available).toBe(true);
    });
});

describe('Brain Edge Cases — Session Context Expiration', () => {
    it('returns empty history if the conversation has been idle for more than 12 hours', async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            filter: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
        } as any;

        // Mock 13 hours old activity log event
        const oldTimestamp = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
        mockSupabase.limit.mockReturnValue({
            then: (resolve: any) => resolve({
                data: [
                    { event_type: 'INCOMING_MESSAGE', description: 'hey', metadata: { chat_id: 'c1' }, timestamp: oldTimestamp }
                ],
                error: null
            })
        });

        const { loadConversationHistory } = await import('../ai/history');
        const history = await loadConversationHistory(mockSupabase, 'u1', 'w1', 'c1');
        expect(history).toEqual([]);
    });

    it('retains history if the last message was less than 12 hours ago', async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            filter: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
        } as any;

        // Mock 1 hour old activity log event
        const recentTimestamp = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
        mockSupabase.limit.mockReturnValue({
            then: (resolve: any) => resolve({
                data: [
                    { event_type: 'INCOMING_MESSAGE', description: 'hey', metadata: { chat_id: 'c1' }, timestamp: recentTimestamp }
                ],
                error: null
            })
        });

        const { loadConversationHistory } = await import('../ai/history');
        const history = await loadConversationHistory(mockSupabase, 'u1', 'w1', 'c1');
        expect(history.length).toBe(1);
        expect(history[0]).toEqual({ role: 'user', content: 'hey' });
    });
});
