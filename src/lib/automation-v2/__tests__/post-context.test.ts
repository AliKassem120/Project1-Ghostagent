/**
 * ═══════════════════════════════════════════════════════════════
 * Tests — Post-Context Classifier
 * ═══════════════════════════════════════════════════════════════
 * Tests for detecting references to recent orders/appointments
 * after a successful action.
 */

import { describe, it, expect } from 'vitest';
import { classifyPostContext } from '../classify/post-context-classifier';

describe('classifyPostContext', () => {
    // ── Cancel References ────────────────────────────────────
    describe('cancel_latest', () => {
        it('detects "cancel it"', () => {
            expect(classifyPostContext('cancel it').intent).toBe('cancel_latest');
        });
        it('detects "cancel the order"', () => {
            expect(classifyPostContext('cancel the order').intent).toBe('cancel_latest');
        });
        it('detects "cancel el order" (Arabizi)', () => {
            expect(classifyPostContext('cancel el order').intent).toBe('cancel_latest');
        });
        it('detects "el8iya" (Arabizi)', () => {
            expect(classifyPostContext('el8iya').intent).toBe('cancel_latest');
        });
        it('detects "ma bade"', () => {
            expect(classifyPostContext('ma bade').intent).toBe('cancel_latest');
        });
        it('detects "i dont want it"', () => {
            expect(classifyPostContext("i don't want it").intent).toBe('cancel_latest');
        });
        it('detects "never mind"', () => {
            expect(classifyPostContext('never mind').intent).toBe('cancel_latest');
        });
    });

    // ── Order Status ─────────────────────────────────────────
    describe('order_status', () => {
        it('detects "where is my order?"', () => {
            expect(classifyPostContext('where is my order?').intent).toBe('order_status');
        });
        it('detects "wein el order?" (Arabizi)', () => {
            expect(classifyPostContext('wein el order?').intent).toBe('order_status');
        });
        it('detects "track my package"', () => {
            expect(classifyPostContext('track my package').intent).toBe('order_status');
        });
        it('detects "when will it arrive?"', () => {
            expect(classifyPostContext('when will it arrive?').intent).toBe('order_status');
        });
    });

    // ── Modify Order ─────────────────────────────────────────
    describe('modify_order', () => {
        it('detects "change it to medium"', () => {
            const r = classifyPostContext('change it to medium');
            expect(r.intent).toBe('modify_order');
            expect(r.extractedValue).toBe('medium');
        });
        it('detects "baddi ghayer el size" (Arabizi)', () => {
            expect(classifyPostContext('baddi ghayer el size').intent).toBe('modify_order');
        });
        it('detects "i want to change the color"', () => {
            expect(classifyPostContext('i want to change the color').intent).toBe('modify_order');
        });
        it('detects "switch to large"', () => {
            const r = classifyPostContext('switch it to large');
            expect(r.intent).toBe('modify_order');
            expect(r.extractedValue).toBe('large');
        });
    });

    // ── Reuse Details ────────────────────────────────────────
    describe('reuse_details', () => {
        it('detects "same address"', () => {
            expect(classifyPostContext('same address').intent).toBe('reuse_details');
        });
        it('detects "same 3nwen" (Arabizi)', () => {
            expect(classifyPostContext('same 3nwen').intent).toBe('reuse_details');
        });
        it('detects "use the same details"', () => {
            expect(classifyPostContext('use the same details').intent).toBe('reuse_details');
        });
        it('detects "nefs el shi" (Arabizi)', () => {
            expect(classifyPostContext('nefs el shi').intent).toBe('reuse_details');
        });
    });

    // ── Reschedule ───────────────────────────────────────────
    describe('reschedule', () => {
        it('detects "same time next week"', () => {
            expect(classifyPostContext('same time next week').intent).toBe('reschedule');
        });
        it('detects "reschedule my appointment"', () => {
            expect(classifyPostContext('reschedule my appointment').intent).toBe('reschedule');
        });
        it('detects "can i reschedule"', () => {
            expect(classifyPostContext('can i reschedule').intent).toBe('reschedule');
        });
    });

    // ── Unrelated ────────────────────────────────────────────
    describe('unrelated', () => {
        it('returns unrelated for general questions', () => {
            expect(classifyPostContext('what products do you have?').intent).toBe('unrelated');
        });
        it('returns unrelated for greetings', () => {
            expect(classifyPostContext('hello').intent).toBe('unrelated');
        });
        it('returns unrelated for random text', () => {
            expect(classifyPostContext('the black one').intent).toBe('unrelated');
        });
    });
});
