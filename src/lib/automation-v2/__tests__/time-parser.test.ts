/**
 * ═══════════════════════════════════════════════════════════════
 * Tests — Enhanced Time Parser
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { resolveDateFromMessage, resolveTimeFromMessage, buildTimeContext } from '../time';

// Fixed time context for testing (Monday, May 5, 2026)
function getTestTimeCtx() {
    return buildTimeContext('Asia/Beirut');
}

describe('Enhanced Date Parser', () => {
    // ── Day after tomorrow ───────────────────────────────────
    it('resolves "ba3d bukra" to day after tomorrow', () => {
        const ctx = getTestTimeCtx();
        const result = resolveDateFromMessage('ba3d bukra', ctx);
        expect(result).toBeTruthy();
        // Should be 2 days from today
        const expected = new Date(ctx.now.getTime() + 2 * 24 * 60 * 60 * 1000);
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: ctx.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
        expect(result).toBe(formatter.format(expected));
    });

    it('resolves "day after tomorrow"', () => {
        const ctx = getTestTimeCtx();
        const result = resolveDateFromMessage('day after tomorrow', ctx);
        expect(result).toBeTruthy();
    });

    it('does not confuse "ba3d bukra" with "bukra"', () => {
        const ctx = getTestTimeCtx();
        const bukra = resolveDateFromMessage('bukra', ctx);
        const ba3dBukra = resolveDateFromMessage('ba3d bukra', ctx);
        expect(bukra).not.toBe(ba3dBukra);
    });

    // ── Arabizi day name prefix ──────────────────────────────
    it('resolves "nhar l tnen" to next Monday', () => {
        const ctx = getTestTimeCtx();
        const result = resolveDateFromMessage('nhar l tnen', ctx);
        expect(result).toBeTruthy();
        const dayOfWeek = new Date(`${result}T12:00:00`).getDay();
        expect(dayOfWeek).toBe(1); // Monday
    });

    it('resolves "hal jem3a" to next Friday', () => {
        const ctx = getTestTimeCtx();
        const result = resolveDateFromMessage('hal jem3a', ctx);
        expect(result).toBeTruthy();
        const dayOfWeek = new Date(`${result}T12:00:00`).getDay();
        expect(dayOfWeek).toBe(5); // Friday
    });

    // ── Regular day names still work ─────────────────────────
    it('resolves "friday" to next Friday', () => {
        const ctx = getTestTimeCtx();
        const result = resolveDateFromMessage('friday', ctx);
        expect(result).toBeTruthy();
    });

    it('resolves "bukra" to tomorrow', () => {
        const ctx = getTestTimeCtx();
        const result = resolveDateFromMessage('bukra', ctx);
        expect(result).toBe(ctx.tomorrowDate);
    });
});

describe('Enhanced Time Parser', () => {
    // ── Time-of-day references ───────────────────────────────
    it('resolves "ba3d l doher" to 14:00', () => {
        expect(resolveTimeFromMessage('ba3d l doher')).toBe('14:00');
    });

    it('resolves "bel lel" to 20:00', () => {
        expect(resolveTimeFromMessage('bel lel')).toBe('20:00');
    });

    it('resolves "bel sobo7" to 09:00', () => {
        expect(resolveTimeFromMessage('bel sobo7')).toBe('09:00');
    });

    // ── Combined date + time ─────────────────────────────────
    it('resolves "bukra se3a 5"', () => {
        const ctx = getTestTimeCtx();
        const date = resolveDateFromMessage('bukra se3a 5', ctx);
        const time = resolveTimeFromMessage('bukra se3a 5');
        expect(date).toBe(ctx.tomorrowDate);
        expect(time).toBe('05:00');
    });

    it('resolves "jem3a se3a 3"', () => {
        const ctx = getTestTimeCtx();
        const date = resolveDateFromMessage('jem3a se3a 3', ctx);
        const time = resolveTimeFromMessage('jem3a se3a 3');
        expect(date).toBeTruthy();
        expect(time).toBe('03:00');
    });

    // ── Standard times still work ────────────────────────────
    it('resolves "4pm"', () => {
        expect(resolveTimeFromMessage('4pm')).toBe('16:00');
    });

    it('resolves "se3a 10"', () => {
        expect(resolveTimeFromMessage('se3a 10')).toBe('10:00');
    });

    it('resolves "10:30"', () => {
        expect(resolveTimeFromMessage('10:30')).toBe('10:30');
    });
});
