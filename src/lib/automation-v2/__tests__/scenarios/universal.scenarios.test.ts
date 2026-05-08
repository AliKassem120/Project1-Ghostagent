/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Universal Intent Scenario Tests
 * ═══════════════════════════════════════════════════════════════
 * Tests for universal intents: gratitude, goodbye, correction,
 * clarification, handoff, frustration.
 */

import { describe, it, expect } from 'vitest';
import { classifyByRegex } from '../../classify/regex-fallbacks';

describe('Universal Intent Scenarios', () => {
    it('U1: gratitude — "thank you" → not purchase_intent', () => {
        const r = classifyByRegex('thank you so much');
        // Should be greeting or unknown, NOT purchase_intent
        if (r) {
            expect(r.intent).not.toBe('purchase_intent');
            expect(r.intent).not.toBe('booking_intent');
        }
    });

    it('U1: gratitude — "thanks" → not purchase_intent', () => {
        const r = classifyByRegex('thanks');
        if (r) {
            expect(r.intent).not.toBe('purchase_intent');
        }
    });

    it('U2: goodbye — "bye" → not purchase_intent', () => {
        const r = classifyByRegex('bye');
        if (r) {
            expect(r.intent).not.toBe('purchase_intent');
        }
    });

    it('U3: correction — "I meant X" does not trigger cancel', () => {
        const r = classifyByRegex('I meant the blue one');
        if (r) {
            expect(r.intent).not.toBe('cancel_order');
        }
    });

    it('U5: handoff — "talk to a human" → human_handoff', () => {
        const r = classifyByRegex('i want to talk to a human');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('human_handoff');
    });

    it('U5: handoff — "real person" → human_handoff', () => {
        const r = classifyByRegex('real person');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('human_handoff');
    });

    it('U6: frustration — "stop messaging me" → frustration_stop', () => {
        const r = classifyByRegex('stop messaging me');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('frustration_stop');
    });

    it('U6: frustration — "bas khalas" → frustration_stop', () => {
        const r = classifyByRegex('bas khalas');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('frustration_stop');
    });
});

describe('Cancel Scope Detection — Regex', () => {
    it('"cancel my order" → cancel_order', () => {
        const r = classifyByRegex('cancel my order');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('cancel_order');
    });

    it('"cancel both orders" → cancel_order', () => {
        const r = classifyByRegex('cancel both orders');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('cancel_order');
    });

    it('"cancel all pending orders" → cancel_order', () => {
        const r = classifyByRegex('cancel all pending orders');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('cancel_order');
    });

    it('"el8iya" → cancel_order (Arabizi)', () => {
        const r = classifyByRegex('el8iya');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('cancel_order');
    });
});
