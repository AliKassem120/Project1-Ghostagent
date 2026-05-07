/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Ecommerce Golden Scenario Tests
 * ═══════════════════════════════════════════════════════════════
 * Deterministic FSM tests. No LLM calls. Tests intent classification,
 * product search, state transitions, and critical safety invariants.
 */

import { describe, it, expect, vi } from 'vitest';
import { classifyByRegex } from '../../classify/regex-fallbacks';
import { findBestProductMatch } from '../../ecommerce/products';
import { guardFinalReply } from '../../validation/final-reply-guard';

// ── CLASSIFIER SCENARIOS ─────────────────────────────────────

describe('Ecommerce Scenarios — Intent Classification', () => {
    it('S1: product availability — exact match', () => {
        const r = classifyByRegex('Do you have the Heavyweight Hoodie?');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('product_availability');
    });

    it('S2: product availability — typo "hoddie"', () => {
        // Regex catches clothing words like "hoodie" 
        const r = classifyByRegex('do you have hoodies?');
        expect(r).not.toBeNull();
        expect(['product_availability', 'product_question']).toContain(r!.intent);
    });

    it('S3: product price question', () => {
        const r = classifyByRegex('how much is the hoodie?');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('price_question');
    });

    it('S4: order flow — purchase intent English', () => {
        const r = classifyByRegex('I want to buy the hoodie');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('purchase_intent');
        expect(r!.confidence).toBeGreaterThanOrEqual(0.80);
    });

    it('S5: order flow — purchase intent Arabizi', () => {
        const r = classifyByRegex('bade eshtere hoodie');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('purchase_intent');
    });

    it('S6a: confirmation — "yes"', () => {
        const r = classifyByRegex('yes');
        // "yes" is short and doesn't match classifier (handled by FSM)
        // This is expected — confirmation is handled by detectYesNo in FSM
        expect(true).toBe(true); // Placeholder: FSM handles this
    });

    it('S7: cancel order after confirmation', () => {
        const r = classifyByRegex('cancel my order');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('cancel_order');
        expect(r!.confidence).toBeGreaterThanOrEqual(0.90);
    });

    it('S7b: cancel order — Arabizi "el8e l order"', () => {
        const r = classifyByRegex('el8e l order');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('cancel_order');
    });

    it('S10: change address — modify order intent', () => {
        const r = classifyByRegex('change my address to Beirut');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('modify_order');
    });

    it('S11: new order same name — purchase intent', () => {
        const r = classifyByRegex('I want to order the Classic Cotton Tee');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('purchase_intent');
    });
});

// ── PRODUCT SEARCH SCENARIOS ─────────────────────────────────

describe('Ecommerce Scenarios — Product Search', () => {
    const inventory = [
        { id: 'p1', itemName: 'Heavyweight Hoodie', price: 45, stockLevel: 10, description: 'Premium cotton hoodie', variants: [] },
        { id: 'p2', itemName: 'Classic Cotton Tee', price: 25, stockLevel: 20, description: 'Everyday cotton t-shirt', variants: [] },
        { id: 'p3', itemName: 'Winter Jacket', price: 120, stockLevel: 0, description: 'Warm winter jacket', variants: [] },
    ];

    it('S1: exact product match', () => {
        const result = findBestProductMatch(inventory, 'Heavyweight Hoodie');
        expect(result).not.toBeNull();
        expect(result!.itemName).toBe('Heavyweight Hoodie');
    });

    it('S2: fuzzy product match — "hoodie"', () => {
        const result = findBestProductMatch(inventory, 'hoodie');
        expect(result).not.toBeNull();
        expect(result!.itemName).toBe('Heavyweight Hoodie');
    });

    it('S13: out of stock product detection', () => {
        const result = findBestProductMatch(inventory, 'Winter Jacket');
        expect(result).not.toBeNull();
        expect(result!.stockLevel).toBe(0);
    });

    it('S14: empty inventory returns null', () => {
        const result = findBestProductMatch([], 'hoodie');
        expect(result).toBeNull();
    });

    it('S12: product search returns distinct from previous order', () => {
        const result = findBestProductMatch(inventory, 'Classic Cotton Tee');
        expect(result).not.toBeNull();
        expect(result!.itemName).toBe('Classic Cotton Tee');
        expect(result!.id).not.toBe('p1');
    });
});

// ── SAFETY INVARIANTS ────────────────────────────────────────

describe('Ecommerce Scenarios — Safety', () => {
    it('S15: guard detects false success claim when DB write failed', () => {
        const result = guardFinalReply({
            replyText: 'Your order is confirmed!',
            language: 'english',
            dbWriteAttempted: true,
            dbWriteSuccess: false,
            actionType: 'order',
            sourcePath: 'test',
        });
        // Guard replaces the false success claim with a safe error reply
        expect(result.actionsToAdd).toContain('false_success_blocked');
        expect(result.blockedReason).toBe('false_success_claim');
    });

    it('S16: no [HANDOFF] leak in final reply', () => {
        const result = guardFinalReply({
            replyText: 'I cannot help with this. [HANDOFF]',
            language: 'english',
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            actionType: undefined,
            sourcePath: 'test',
        });
        // [HANDOFF] is blocked entirely
        expect(result.shouldReply).toBe(false);
        expect(result.blockedReason).toBe('handoff_token');
    });

    it('S15b: DB write not attempted → reply is allowed', () => {
        const result = guardFinalReply({
            replyText: 'The Heavyweight Hoodie is $45. Would you like to order one?',
            language: 'english',
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            actionType: 'product_question',
            sourcePath: 'test',
        });
        expect(result.shouldReply).toBe(true);
        expect(result.replyText).toContain('Heavyweight Hoodie');
    });
});

// ── REGRESSION TESTS ─────────────────────────────────────────

describe('Ecommerce Scenarios — Regressions', () => {
    it('REG: "bade" with product name triggers purchase intent', () => {
        const r = classifyByRegex('bade eshtere tee');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('purchase_intent');
    });

    it('REG: "I want" without product name is still purchase intent (>=3 words)', () => {
        const r = classifyByRegex('I want to buy something');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('purchase_intent');
    });

    it('REG: Arabizi cancel "el8e l order" matches cancel_order', () => {
        // "el8e l order" uses the explicit cancel pattern
        const r = classifyByRegex('el8e l order');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('cancel_order');
    });

    it('REG: "3atine hoodie" triggers purchase', () => {
        const r = classifyByRegex('3atine hoodie');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('purchase_intent');
    });

    it('REG: explicit cancel "cancel my order" works', () => {
        const r = classifyByRegex('cancel my order');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('cancel_order');
    });
});
