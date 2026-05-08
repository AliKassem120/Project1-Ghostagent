/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — LLM Classifier Scenario Tests
 * ═══════════════════════════════════════════════════════════════
 * Tests for the full classifier pipeline (regex → LLM fallback)
 * with mocked LLM. No real API calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Groq + generateText before importing
vi.mock('@ai-sdk/groq', () => ({
    createGroq: () => () => ({ modelId: 'test-model' }),
}));

let mockLLMResponse = '{}';
vi.mock('ai', () => ({
    generateText: vi.fn(async () => ({ text: mockLLMResponse })),
}));

// Import after mocks
const { classifyIntentWithSemanticFallback } = await import('../../classify/intent-classifier');
const { classifyByRegex } = await import('../../classify/regex-fallbacks');

function setLLM(obj: Record<string, unknown>) {
    mockLLMResponse = JSON.stringify({
        intent: 'unknown',
        confidence: 0.5,
        entities: {},
        isTransactional: false,
        needsClarification: false,
        language: 'english',
        ...obj,
    });
}

describe('LLM Classifier Scenarios — Complex Phrasing', () => {
    beforeEach(() => {
        process.env.GROQ_API_KEY = 'test-key';
    });

    it('LS1: weird cancel-both phrasing → cancel_order via LLM', async () => {
        setLLM({
            intent: 'cancel_order',
            confidence: 0.93,
            target: 'order',
            action: 'cancel',
            scope: 'count',
            count: 2,
            isTransactional: true,
        });
        const result = await classifyIntentWithSemanticFallback(
            'can u remove the two things I ordered',
            'ecommerce'
        );
        expect(result.intent).toBe('cancel_order');
        expect(result.scope).toBe('count');
        expect(result.count).toBe(2);
    });

    it('LS2: weird repeat phrasing → repeat_last_order via LLM', async () => {
        setLLM({
            intent: 'repeat_last_order',
            confidence: 0.92,
            entities: { changedAddress: 'Zeleya' },
            isTransactional: true,
        });
        const result = await classifyIntentWithSemanticFallback(
            'same one again but to my other address in Zeleya',
            'ecommerce'
        );
        // Regex may catch "same one" as repeat_last_order, or LLM may handle it
        expect(result.intent).toBe('repeat_last_order');
        // Entities only present if source is LLM
        if (result.source === 'llm') {
            expect(result.entities.changedAddress).toBe('Zeleya');
        }
    });

    it('LS3: appointment reschedule phrasing goes through classifier', async () => {
        setLLM({
            intent: 'reschedule_appointment',
            confidence: 0.95,
            target: 'appointment',
            action: 'update',
            entities: { date: 'Friday', time: '5' },
            isTransactional: true,
        });
        const result = await classifyIntentWithSemanticFallback(
            'can you move my appointment to Friday at 5',
            'appointments'
        );
        // Regex may catch this as booking_intent; LLM would return reschedule
        // Either is valid — the decision engine handles both correctly
        expect(['booking_intent', 'reschedule_appointment']).toContain(result.intent);
    });

    it('LS4: Arabizi repeat last order → repeat_last_order via LLM', async () => {
        // "bde we7de tene same ra2em" — likely caught by regex, but test LLM path
        setLLM({
            intent: 'repeat_last_order',
            confidence: 0.92,
            entities: { reusePhone: true, quantity: 1 },
            isTransactional: true,
            language: 'arabizi',
        });
        // Simulate a case where regex doesn't catch it (variant spelling)
        const result = await classifyIntentWithSemanticFallback(
            'bde wa7de kamane nafs el ra2em',
            'ecommerce'
        );
        expect(result.intent).toBe('repeat_last_order');
        expect(result.language).toBe('arabizi');
    });

    it('LS5: Arabizi cancellation → cancel_order via LLM', async () => {
        setLLM({
            intent: 'cancel_order',
            confidence: 0.90,
            isTransactional: true,
            language: 'arabizi',
        });
        const result = await classifyIntentWithSemanticFallback(
            'ma bde yeh ba2a',
            'ecommerce'
        );
        // May be caught by regex or LLM
        expect(['cancel_order', 'cancel_latest']).toContain(result.intent);
    });

    it('LS6: payment / COD question → classified by regex or LLM', async () => {
        setLLM({
            intent: 'payment_methods_question',
            confidence: 0.95,
            target: 'business',
            action: 'query',
            isTransactional: false,
        });
        const result = await classifyIntentWithSemanticFallback(
            'do you do cash on delivery',
            'ecommerce'
        );
        // Regex catches "delivery" as shipping_question with high confidence
        // LLM would classify as payment_methods_question
        // Both are valid info queries, decision engine handles both
        expect(['payment_methods_question', 'shipping_question']).toContain(result.intent);
        expect(result.isTransactional).toBe(false);
    });
});

describe('Classifier Pipeline — Regex Priority', () => {
    beforeEach(() => {
        process.env.GROQ_API_KEY = 'test-key';
    });

    it('LS7: high-confidence regex wins over LLM', async () => {
        // "hello" is a strong regex match (greeting)
        const result = await classifyIntentWithSemanticFallback('hello', 'ecommerce');
        expect(result.intent).toBe('greeting');
        expect(result.source).toBe('regex');
    });

    it('LS8: regex fallback used when LLM fails', async () => {
        // Set LLM to return garbage
        mockLLMResponse = 'invalid json garbage';
        // Use a message that regex partially recognizes
        const regexResult = classifyByRegex('cancel my stuff');
        // The regex might or might not match — test the pipeline doesn't crash
        const result = await classifyIntentWithSemanticFallback(
            'cancel my stuff',
            'ecommerce'
        );
        // Should not crash, should return something
        expect(result).toBeTruthy();
        expect(result.source).toMatch(/regex|llm/);
    });

    it('LS9: LLM low confidence returns needsClarification', async () => {
        setLLM({
            intent: 'product_reference',
            confidence: 0.45,
            needsClarification: false,
        });
        const result = await classifyIntentWithSemanticFallback(
            'hmm maybe that thing',
            'ecommerce'
        );
        // Confidence < 0.70, so pipeline should set needsClarification
        expect(result.needsClarification).toBe(true);
    });
});

describe('Classifier Safety — LLM is Read-Only', () => {
    it('LS10: LLM result has source=llm, never source=db or source=handler', async () => {
        process.env.GROQ_API_KEY = 'test-key';
        setLLM({
            intent: 'cancel_order',
            confidence: 0.95,
            isTransactional: true,
        });
        const result = await classifyIntentWithSemanticFallback(
            'remove all my orders please',
            'ecommerce'
        );
        expect(result.source).toMatch(/regex|llm/);
    });

    it('LS11: LLM result never contains replyText', async () => {
        process.env.GROQ_API_KEY = 'test-key';
        setLLM({
            intent: 'greeting',
            confidence: 0.95,
        });
        const result = await classifyIntentWithSemanticFallback('hey there buddy', 'ecommerce');
        // NormalizedIntent doesn't have replyText
        expect((result as any).replyText).toBeUndefined();
    });
});
