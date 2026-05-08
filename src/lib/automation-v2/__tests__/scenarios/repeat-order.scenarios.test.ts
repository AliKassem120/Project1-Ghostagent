/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Repeat Order Scenario Tests
 * ═══════════════════════════════════════════════════════════════
 * Tests for repeat_last_order intent detection and regex classification.
 */

import { describe, it, expect } from 'vitest';
import { classifyByRegex } from '../../classify/regex-fallbacks';

describe('Repeat Last Order — Regex Detection', () => {
    it('E20: "add one more" → repeat_last_order', () => {
        const r = classifyByRegex('add one more');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('repeat_last_order');
    });

    it('E20: "another one" → repeat_last_order', () => {
        const r = classifyByRegex('another one');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('repeat_last_order');
    });

    it('E20: "same product" → repeat_last_order', () => {
        const r = classifyByRegex('same product');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('repeat_last_order');
    });

    it('E20: "repeat order" → repeat_last_order', () => {
        const r = classifyByRegex('repeat order');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('repeat_last_order');
    });

    it('E20: "can you add one more" → repeat_last_order', () => {
        const r = classifyByRegex('can you add one more');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('repeat_last_order');
    });

    it('E20: "order another" → repeat_last_order', () => {
        const r = classifyByRegex('order another');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('repeat_last_order');
    });

    it('E20: "add another" → repeat_last_order', () => {
        const r = classifyByRegex('add another');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('repeat_last_order');
    });

    it('Arabizi: "bde we7de tene" → repeat_last_order', () => {
        const r = classifyByRegex('bde we7de tene');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('repeat_last_order');
    });

    it('Arabizi: "nafs l order" → repeat_last_order', () => {
        const r = classifyByRegex('nafs l order');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('repeat_last_order');
    });

    it('Arabizi: "kamen wahad" → repeat_last_order', () => {
        const r = classifyByRegex('kamen wahad');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('repeat_last_order');
    });

    // Guard: regular purchase intent should NOT be classified as repeat
    it('E29: "I want to buy a PS5" → purchase_intent (NOT repeat)', () => {
        const r = classifyByRegex('I want to buy a PS5');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('purchase_intent');
    });

    it('E29: "I want to order a TV" → purchase_intent (NOT repeat)', () => {
        const r = classifyByRegex('I want to order a TV');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('purchase_intent');
    });
});
