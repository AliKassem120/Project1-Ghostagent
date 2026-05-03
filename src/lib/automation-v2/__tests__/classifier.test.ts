/**
 * ═══════════════════════════════════════════════════════════════
 * Tests — Regex Intent Classifier
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { classifyByRegex } from '../classify/regex-fallbacks';

describe('classifyByRegex', () => {
    // ── Greetings ────────────────────────────────────────────
    it('detects greetings', () => {
        expect(classifyByRegex('hey')?.intent).toBe('greeting');
        expect(classifyByRegex('hello')?.intent).toBe('greeting');
        expect(classifyByRegex('salam')?.intent).toBe('greeting');
        expect(classifyByRegex('hala')?.intent).toBe('greeting');
        expect(classifyByRegex('bonjour')?.intent).toBe('greeting');
        expect(classifyByRegex('hola')?.intent).toBe('greeting');
    });

    // ── Booking intent ───────────────────────────────────────
    it('detects booking intents', () => {
        expect(classifyByRegex('I want to book an appointment')?.intent).toBe('booking_intent');
        expect(classifyByRegex('bde e7joz maw3ed')?.intent).toBe('booking_intent');
        expect(classifyByRegex('I need a 7ajez')?.intent).toBe('booking_intent');
    });

    // ── Purchase intent ──────────────────────────────────────
    it('detects purchase intents', () => {
        expect(classifyByRegex('I want to buy a hoodie')?.intent).toBe('purchase_intent');
        expect(classifyByRegex('bade eshtere wahde')?.intent).toBe('purchase_intent');
        expect(classifyByRegex('I want to order')?.intent).toBe('purchase_intent');
    });

    it('detects natural purchase phrases', () => {
        expect(classifyByRegex('I want a ps5 please')?.intent).toBe('purchase_intent');
        expect(classifyByRegex('I need a new phone')?.intent).toBe('purchase_intent');
        expect(classifyByRegex('can I get the black one')?.intent).toBe('purchase_intent');
        expect(classifyByRegex('give me 2 of those')?.intent).toBe('purchase_intent');
        expect(classifyByRegex('send me that hoodie')?.intent).toBe('purchase_intent');
        expect(classifyByRegex("I'd like a large pizza")?.intent).toBe('purchase_intent');
        expect(classifyByRegex("I'll take it")?.intent).toBe('purchase_intent');
    });

    it('detects Arabizi purchase phrases', () => {
        expect(classifyByRegex('badde wahde')?.intent).toBe('purchase_intent');
        expect(classifyByRegex('3atine tnein')?.intent).toBe('purchase_intent');
        expect(classifyByRegex('ab3atli wahde')?.intent).toBe('purchase_intent');
    });

    // ── Handoff ──────────────────────────────────────────────
    it('detects human handoff requests', () => {
        expect(classifyByRegex('I want to talk to a manager')?.intent).toBe('human_handoff');
        expect(classifyByRegex('bade ehke ma3 hada')?.intent).toBe('human_handoff');
        expect(classifyByRegex('ma 3am tefham 3laye')?.intent).toBe('human_handoff');
    });

    // ── Business hours ───────────────────────────────────────
    it('detects business hours questions', () => {
        expect(classifyByRegex('what are your working hours?')?.intent).toBe('business_hours');
        expect(classifyByRegex('amta btefta7')?.intent).toBe('business_hours');
    });

    // ── Price questions ──────────────────────────────────────
    it('detects price questions', () => {
        expect(classifyByRegex('how much is this?')?.intent).toBe('price_question');
        expect(classifyByRegex('adde se3ro')?.intent).toBe('price_question');
        expect(classifyByRegex('shu el price')?.intent).toBe('price_question');
    });

    // ── Cancellation ─────────────────────────────────────────
    it('detects cancel order', () => {
        expect(classifyByRegex('cancel my order')?.intent).toBe('cancel_order');
        expect(classifyByRegex('bade el8e el order')?.intent).toBe('cancel_order');
    });

    it('detects cancel appointment', () => {
        expect(classifyByRegex('cancel my appointment')?.intent).toBe('cancel_appointment');
    });

    // ── Order status ─────────────────────────────────────────
    it('detects order status queries', () => {
        expect(classifyByRegex('where is my order?')?.intent).toBe('order_status');
        expect(classifyByRegex('wein el order')?.intent).toBe('order_status');
        expect(classifyByRegex('track my package')?.intent).toBe('order_status');
    });

    // ── Modify order ─────────────────────────────────────────
    it('detects modify order requests', () => {
        expect(classifyByRegex('baddi ghayer el size')?.intent).toBe('modify_order');
        expect(classifyByRegex('bade 8ayer el loun')?.intent).toBe('modify_order');
    });

    // ── Unknown ──────────────────────────────────────────────
    it('returns null for ambiguous messages', () => {
        expect(classifyByRegex('the black one')).toBe(null);
        expect(classifyByRegex('Ali 71123456')).toBe(null);
        expect(classifyByRegex('tomorrow at 3')).toBe(null);
    });
});
