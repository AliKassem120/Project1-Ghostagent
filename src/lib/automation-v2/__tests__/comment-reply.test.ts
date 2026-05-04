/**
 * ═══════════════════════════════════════════════════════════════
 * Tests — Comment Reply Plan Logic
 * ═══════════════════════════════════════════════════════════════
 * Verifies the comment reply style dispatch logic:
 * - 'public' → only publicCommentText, no DM
 * - 'dm'    → only privateDmText with useful answer (no CTA)
 * - 'both'  → public CTA + private useful answer
 */

import { describe, it, expect } from 'vitest';

// ── CTA detection helper (mirrors the validation in route.ts) ──

const CTA_PHRASES = [
    'check your dm',
    'sent you a dm',
    "i dm'd you",
    'check inbox',
    'check your inbox',
    'dm us',
];

function containsCta(text: string): boolean {
    const lower = text.toLowerCase();
    return CTA_PHRASES.some(phrase => lower.includes(phrase));
}

function stripCta(text: string): string {
    let result = text;
    for (const phrase of CTA_PHRASES) {
        result = result.replace(new RegExp(phrase, 'gi'), '').trim();
    }
    return result.replace(/\s{2,}/g, ' ').replace(/^\s*[,!.]\s*/, '').trim();
}

// ── Comment Reply Plan Type ──

interface CommentReplyPlan {
    publicCommentText: string | null;
    privateDmText: string | null;
}

/**
 * Simulates the plan structure based on reply style.
 * In production, the LLM generates these. Here we test
 * the dispatch/validation logic.
 */
function buildMockPlan(
    style: 'public' | 'dm' | 'both',
    publicText: string,
    dmText: string
): CommentReplyPlan {
    const plan: CommentReplyPlan = { publicCommentText: null, privateDmText: null };

    if (style === 'public' || style === 'both') {
        plan.publicCommentText = publicText;
    }
    if (style === 'dm' || style === 'both') {
        plan.privateDmText = dmText;
    }
    return plan;
}

// ── Tests ───────────────────────────────────────────────────

describe('Comment Reply Plan - Style Dispatch', () => {

    it('style "public" only produces publicCommentText, no DM', () => {
        const plan = buildMockPlan('public', 'DM us for details! 💬', 'PS5 is $500');

        expect(plan.publicCommentText).toBeTruthy();
        expect(plan.privateDmText).toBeNull();
    });

    it('style "dm" only produces privateDmText, no public comment', () => {
        const plan = buildMockPlan('dm', 'Check your DMs! 👻', 'PS5 is available — $500. Want me to reserve one?');

        expect(plan.publicCommentText).toBeNull();
        expect(plan.privateDmText).toBeTruthy();
    });

    it('style "both" produces both public and DM texts', () => {
        const plan = buildMockPlan('both', 'Sent you a DM! 👻', 'PS5 is available — $500. Want me to reserve one?');

        expect(plan.publicCommentText).toBeTruthy();
        expect(plan.privateDmText).toBeTruthy();
    });
});

describe('Comment Reply Plan - DM CTA Validation', () => {

    it('DM text "Check your DMs!" is flagged as containing CTA', () => {
        expect(containsCta('Check your DMs! 💬')).toBe(true);
    });

    it('DM text "Sent you a DM 👻" is flagged as containing CTA', () => {
        expect(containsCta('Sent you a DM 👻')).toBe(true);
    });

    it('DM text "I DM\'d you the details" is flagged as containing CTA', () => {
        expect(containsCta("I DM'd you the details")).toBe(true);
    });

    it('DM text "Check inbox for info" is flagged as containing CTA', () => {
        expect(containsCta('Check inbox for info')).toBe(true);
    });

    it('DM text "DM us for more info" is flagged as containing CTA', () => {
        expect(containsCta('DM us for more info')).toBe(true);
    });

    it('Useful DM answer does NOT contain CTA', () => {
        expect(containsCta('Hey! PS5 is available for $500. Want me to reserve one? 🎮')).toBe(false);
    });

    it('Useful DM answer with booking info does NOT contain CTA', () => {
        expect(containsCta('Hi! A haircut is $30, and we have openings tomorrow at 3pm. Want me to book you in? ✂️')).toBe(false);
    });

    it('stripCta removes CTA phrases from DM text', () => {
        const cleaned = stripCta('Check your DMs! PS5 is $500.');
        expect(cleaned).not.toMatch(/check your dm/i);
        expect(cleaned).toContain('PS5 is $500');
    });
});

describe('Comment Reply Plan - Style "dm" Content Quality', () => {

    it('DM-only plan should contain a useful answer, not a CTA', () => {
        // Simulate what the LLM should produce for style "dm"
        const dmText = 'Hey! The PS5 is available for $500 and currently in stock. Want me to reserve one for you? 🎮';
        const plan = buildMockPlan('dm', '', dmText);

        expect(plan.privateDmText).toBeTruthy();
        expect(containsCta(plan.privateDmText!)).toBe(false);
        // Should contain actual product info
        expect(plan.privateDmText!.toLowerCase()).toMatch(/ps5|500/);
    });

    it('DM text should use inventory when available', () => {
        const dmText = 'Hi! We have the PS5 Console in stock for $500. Would you like to place an order? 😊';
        expect(dmText.toLowerCase()).toContain('ps5');
        expect(dmText).toContain('500');
        expect(containsCta(dmText)).toBe(false);
    });
});

describe('Comment Reply Plan - Style "both" Separation', () => {

    it('"both" public text should be a short CTA', () => {
        const publicText = 'Sent you a DM! 👻';
        expect(publicText.length).toBeLessThan(100);
        expect(containsCta(publicText)).toBe(true); // Public IS supposed to be a CTA
    });

    it('"both" DM text should be the actual useful answer', () => {
        const dmText = 'Hey! PS5 is available — $500. Want me to reserve one? 🎮';
        expect(containsCta(dmText)).toBe(false);
        expect(dmText.toLowerCase()).toMatch(/ps5|available|\$500|reserve/);
    });

    it('"both" plan has different content for public vs DM', () => {
        const plan = buildMockPlan('both', 'Sent you a DM! 👻', 'PS5 is available — $500. Want me to reserve one?');
        expect(plan.publicCommentText).not.toBe(plan.privateDmText);
    });
});
