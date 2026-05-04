/**
 * ═══════════════════════════════════════════════════════════════
 * Tests — Appointments Flow
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { resolveTimeFromMessage, resolveDateFromMessage, buildTimeContext } from '../time';
import { classifyByRegex } from '../classify/regex-fallbacks';
import { findBestServiceMatch } from '../appointments/services';
import type { ServiceRecord } from '../types';

const mockServices: ServiceRecord[] = [
    { id: '1', name: 'Haircut', description: null, price: 30, durationMinutes: 30, isActive: true, aliases: ['7ala2a', 'hala2a', 'cut'], category: null, bufferBefore: 0, bufferAfter: 0 },
    { id: '2', name: 'Beard Trim', description: null, price: 15, durationMinutes: 15, isActive: true, aliases: ['da2n', 'de2en'], category: null, bufferBefore: 0, bufferAfter: 0 },
    { id: '3', name: 'Full Package', description: null, price: 50, durationMinutes: 60, isActive: true, aliases: ['kamele', 'full'], category: null, bufferBefore: 0, bufferAfter: 0 },
];

describe('Time Resolution - PM Heuristic', () => {
    it('"se3a 5" → 17:00 (PM), not 05:00', () => {
        const result = resolveTimeFromMessage('se3a 5');
        expect(result).toBe('17:00');
    });

    it('"sa3a 3" → 15:00 (PM)', () => {
        const result = resolveTimeFromMessage('sa3a 3');
        expect(result).toBe('15:00');
    });

    it('"se3a 9" → 09:00 (no PM for 8+)', () => {
        const result = resolveTimeFromMessage('se3a 9');
        expect(result).toBe('09:00');
    });

    it('"se3a 12" → 12:00 (no PM shift for 12)', () => {
        const result = resolveTimeFromMessage('se3a 12');
        expect(result).toBe('12:00');
    });

    it('"4pm" → 16:00', () => {
        const result = resolveTimeFromMessage('4pm');
        expect(result).toBe('16:00');
    });

    it('"10am" → 10:00', () => {
        const result = resolveTimeFromMessage('10am');
        expect(result).toBe('10:00');
    });

    it('"ba3d l doher" → 14:00', () => {
        const result = resolveTimeFromMessage('ba3d l doher');
        expect(result).toBe('14:00');
    });

    it('"bel sobo7" → 09:00', () => {
        const result = resolveTimeFromMessage('bel sobo7');
        expect(result).toBe('09:00');
    });
});

describe('Date Resolution', () => {
    const timeCtx = buildTimeContext('Asia/Beirut');

    it('"bukra" → tomorrow', () => {
        const result = resolveDateFromMessage('bukra', timeCtx);
        expect(result).toBe(timeCtx.tomorrowDate);
    });

    it('"lyom" → today', () => {
        const result = resolveDateFromMessage('lyom', timeCtx);
        expect(result).toBe(timeCtx.isoDate);
    });

    it('"tomorrow" → tomorrow', () => {
        const result = resolveDateFromMessage('tomorrow', timeCtx);
        expect(result).toBe(timeCtx.tomorrowDate);
    });

    it('"ba3d bukra" → day after tomorrow', () => {
        const result = resolveDateFromMessage('ba3d bukra', timeCtx);
        expect(result).toBeTruthy();
        expect(result).not.toBe(timeCtx.isoDate);
        expect(result).not.toBe(timeCtx.tomorrowDate);
    });
});

describe('One-Message Extraction', () => {
    const timeCtx = buildTimeContext('Asia/Beirut');

    it('extracts time from "haircut tomorrow at 5"', () => {
        const time = resolveTimeFromMessage('haircut tomorrow at 5pm');
        expect(time).toBe('17:00');
    });

    it('extracts date from "haircut tomorrow at 5"', () => {
        const date = resolveDateFromMessage('haircut tomorrow at 5pm', timeCtx);
        expect(date).toBe(timeCtx.tomorrowDate);
    });

    it('extracts time from "bde e7joz haircut bukra se3a 5"', () => {
        const time = resolveTimeFromMessage('bde e7joz haircut bukra se3a 5');
        expect(time).toBe('17:00');
    });

    it('extracts date from "bde e7joz haircut bukra se3a 5"', () => {
        const date = resolveDateFromMessage('bde e7joz haircut bukra se3a 5', timeCtx);
        expect(date).toBe(timeCtx.tomorrowDate);
    });
});

describe('Service Matching', () => {
    it('matches by name', () => {
        const result = findBestServiceMatch(mockServices, 'haircut');
        expect(result?.name).toBe('Haircut');
    });

    it('matches by alias', () => {
        const result = findBestServiceMatch(mockServices, '7ala2a');
        expect(result?.name).toBe('Haircut');
    });

    it('matches by partial name', () => {
        const result = findBestServiceMatch(mockServices, 'beard');
        expect(result?.name).toBe('Beard Trim');
    });

    it('returns null for non-existent service', () => {
        const result = findBestServiceMatch(mockServices, 'massage');
        expect(result).toBeNull();
    });
});

describe('Correction Intent', () => {
    it('detects "I didn\'t ask for products"', () => {
        const result = classifyByRegex("I didn't ask for products");
        expect(result?.intent).toBe('correction');
    });

    it('detects "you misunderstood"', () => {
        const result = classifyByRegex('you misunderstood');
        expect(result?.intent).toBe('correction');
    });

    it('detects "ma hek"', () => {
        const result = classifyByRegex('ma hek');
        expect(result?.intent).toBe('correction');
    });

    it('detects "msh hek"', () => {
        const result = classifyByRegex('msh hek');
        expect(result?.intent).toBe('correction');
    });
});
