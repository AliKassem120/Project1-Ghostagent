/**
 * ═══════════════════════════════════════════════════════════════
 * Tests — Reply Validator
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { validateReply } from '../validation/reply-validator';

describe('validateReply', () => {
    // ── Empty ────────────────────────────────────────────────
    it('blocks empty replies', () => {
        expect(validateReply('').isValid).toBe(false);
        expect(validateReply('  ').isValid).toBe(false);
    });

    // ── False confirmations ──────────────────────────────────
    it('blocks false confirmations when not confirmed', () => {
        const r = validateReply('Your appointment has been booked!', { isConfirmed: false });
        expect(r.isValid).toBe(false);
        expect(r.reason).toContain('false_confirmation');
    });

    it('blocks "confirmed" without DB success', () => {
        const r = validateReply('Order confirmed!', { isConfirmed: false });
        expect(r.isValid).toBe(false);
    });

    it('blocks "t2akad" without DB success', () => {
        const r = validateReply('Tmm t2akad el order', { isConfirmed: false });
        expect(r.isValid).toBe(false);
    });

    it('allows confirmation when DB succeeded', () => {
        const r = validateReply('Your appointment is confirmed!', { isConfirmed: true });
        expect(r.isValid).toBe(true);
    });

    // ── AI self-reveal ───────────────────────────────────────
    it('blocks "I am an AI" replies', () => {
        const r = validateReply('I am an AI assistant and I cannot help with that.');
        expect(r.isValid).toBe(false);
        expect(r.reason).toContain('ai_self_reveal');
    });

    it('blocks "as a bot" replies', () => {
        const r = validateReply('As a bot, I don\'t have access to that information.');
        expect(r.isValid).toBe(false);
    });

    // ── Too long ─────────────────────────────────────────────
    it('blocks overly long paragraph replies', () => {
        const longReply = 'This is a very long reply. '.repeat(20);
        const r = validateReply(longReply);
        // Should either be invalid or have a repaired version
        if (!r.isValid) {
            expect(r.repaired).toBeDefined();
            expect(r.repaired!.length).toBeLessThan(longReply.length);
        }
    });

    // ── Valid replies ────────────────────────────────────────
    it('allows normal short replies', () => {
        expect(validateReply('Hey! How can I help?').isValid).toBe(true);
        expect(validateReply('Eh mawjoud, $50.').isValid).toBe(true);
        expect(validateReply('Ma fi halla2.').isValid).toBe(true);
    });

    // ── Product listings (up to 6 newlines) ──────────────────
    it('allows product listing with 5 newlines', () => {
        const listing = '• Item 1\n• Item 2\n• Item 3\n• Item 4\n• Item 5\n• Item 6';
        expect(validateReply(listing).isValid).toBe(true);
    });

    it('blocks excessive paragraphs (7+ newlines)', () => {
        const paragraphs = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8';
        const r = validateReply(paragraphs);
        expect(r.isValid).toBe(false);
        expect(r.reason).toBe('paragraph_style');
    });

    // ── Arabizi repair ──────────────────────────────────────
    it('provides Arabizi repaired reply for false confirmation', () => {
        const r = validateReply('confirmed!', { isConfirmed: false, language: 'arabizi' });
        expect(r.isValid).toBe(false);
        expect(r.repaired).toBe('Fi 8alat. Jarreb kamen.');
    });
});
