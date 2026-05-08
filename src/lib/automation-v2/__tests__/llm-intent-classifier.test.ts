/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — LLM Intent Classifier Unit Tests
 * ═══════════════════════════════════════════════════════════════
 * All tests use mocked LLM responses. No real API calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NormalizedIntent } from '../classify/normalized-intent';

// Mock the Groq SDK and generateText BEFORE importing the classifier
vi.mock('@ai-sdk/groq', () => ({
    createGroq: () => () => ({ modelId: 'test-model' }),
}));

let mockGenerateTextResponse = '{}';
vi.mock('ai', () => ({
    generateText: vi.fn(async () => ({ text: mockGenerateTextResponse })),
}));

// Now import after mocks are set up
const { classifyIntentWithLLM, safeFallbackIntent, LLMIntentSchema } = await import('../classify/llm-intent-classifier');

function setLLMResponse(obj: Record<string, unknown>) {
    mockGenerateTextResponse = JSON.stringify(obj);
}

function validBase(overrides: Record<string, unknown> = {}) {
    return {
        intent: 'unknown',
        confidence: 0.5,
        entities: {},
        isTransactional: false,
        needsClarification: false,
        language: 'english',
        ...overrides,
    };
}

describe('LLM Intent Classifier — Zod Validation', () => {
    beforeEach(() => {
        process.env.GROQ_API_KEY = 'test-key';
    });

    it('L1: valid JSON parses into NormalizedIntent', async () => {
        setLLMResponse(validBase({ intent: 'greeting', confidence: 0.95 }));
        const result = await classifyIntentWithLLM('hello', 'ecommerce');
        expect(result.intent).toBe('greeting');
        expect(result.confidence).toBe(0.95);
        expect(result.source).toBe('llm');
    });

    it('L2: invalid JSON returns unknown safe fallback', async () => {
        mockGenerateTextResponse = 'this is not json at all!!!';
        const result = await classifyIntentWithLLM('xyz', 'ecommerce');
        expect(result.intent).toBe('unknown');
        expect(result.confidence).toBe(0);
        expect(result.needsClarification).toBe(true);
        expect(result.source).toBe('llm');
    });

    it('L3: Zod validation failure returns fallback', async () => {
        // Missing required fields
        mockGenerateTextResponse = JSON.stringify({ intent: 'greeting' });
        const result = await classifyIntentWithLLM('hey', 'ecommerce');
        expect(result.intent).toBe('unknown');
        expect(result.needsClarification).toBe(true);
    });

    it('L4: cancel both orders → cancel_order / scope=count / count=2', async () => {
        setLLMResponse(validBase({
            intent: 'cancel_order',
            confidence: 0.95,
            target: 'order',
            action: 'cancel',
            scope: 'count',
            count: 2,
            isTransactional: true,
        }));
        const result = await classifyIntentWithLLM('cancel both orders', 'ecommerce');
        expect(result.intent).toBe('cancel_order');
        expect(result.scope).toBe('count');
        expect(result.count).toBe(2);
        expect(result.isTransactional).toBe(true);
    });

    it('L5: cancel second one → cancel_order / scope=ordinal / ordinal=second', async () => {
        setLLMResponse(validBase({
            intent: 'cancel_order',
            confidence: 0.93,
            scope: 'ordinal',
            ordinal: 'second',
            isTransactional: true,
        }));
        const result = await classifyIntentWithLLM('cancel the second one not the first', 'ecommerce');
        expect(result.intent).toBe('cancel_order');
        expect(result.scope).toBe('ordinal');
        expect(result.ordinal).toBe('second');
    });

    it('L6: add one more same phone/address → repeat_last_order with reuse entities', async () => {
        setLLMResponse(validBase({
            intent: 'repeat_last_order',
            confidence: 0.95,
            target: 'order',
            action: 'repeat',
            scope: 'latest',
            entities: { reusePhone: true, reuseAddress: true, quantity: 1 },
            isTransactional: true,
        }));
        const result = await classifyIntentWithLLM('add one more same phone and address', 'ecommerce');
        expect(result.intent).toBe('repeat_last_order');
        expect(result.entities.reusePhone).toBe(true);
        expect(result.entities.reuseAddress).toBe(true);
    });

    it('L7: same one new address Zeleya → repeat_last_order with changedAddress', async () => {
        setLLMResponse(validBase({
            intent: 'repeat_last_order',
            confidence: 0.92,
            entities: { changedAddress: 'Zeleya' },
            isTransactional: true,
        }));
        const result = await classifyIntentWithLLM('same one again but to my other address in Zeleya', 'ecommerce');
        expect(result.intent).toBe('repeat_last_order');
        expect(result.entities.changedAddress).toBe('Zeleya');
    });

    it('L8: crewneck black size L same name/number new address → purchase_intent with entities', async () => {
        setLLMResponse(validBase({
            intent: 'purchase_intent',
            confidence: 0.95,
            target: 'order',
            action: 'create',
            entities: {
                product: 'crewneck',
                color: 'black',
                size: 'L',
                reuseName: true,
                reusePhone: true,
                address: 'Zeleya',
            },
            isTransactional: true,
        }));
        const result = await classifyIntentWithLLM('I want a crewneck black size L same name and number change address to Zeleya', 'ecommerce');
        expect(result.intent).toBe('purchase_intent');
        expect(result.entities.product).toBe('crewneck');
        expect(result.entities.color).toBe('black');
        expect(result.entities.size).toBe('L');
        expect(result.entities.reuseName).toBe(true);
        expect(result.entities.reusePhone).toBe(true);
        expect(result.entities.address).toBe('Zeleya');
    });

    it('L9: book me like last time → booking_intent with needsClarification', async () => {
        setLLMResponse(validBase({
            intent: 'booking_intent',
            confidence: 0.80,
            target: 'appointment',
            action: 'create',
            needsClarification: true,
            isTransactional: true,
        }));
        const result = await classifyIntentWithLLM('book me like last time', 'appointments');
        expect(result.intent).toBe('booking_intent');
        expect(result.needsClarification).toBe(true);
        expect(result.isTransactional).toBe(true);
    });

    it('L10: move appointment to Friday 5 → reschedule_appointment with date/time', async () => {
        setLLMResponse(validBase({
            intent: 'reschedule_appointment',
            confidence: 0.95,
            target: 'appointment',
            action: 'update',
            entities: { date: 'Friday', time: '5' },
            isTransactional: true,
        }));
        const result = await classifyIntentWithLLM('can you move my appointment to Friday at 5', 'appointments');
        expect(result.intent).toBe('reschedule_appointment');
        expect(result.entities.date).toBe('Friday');
        expect(result.entities.time).toBe('5');
    });

    it('L11: cash on delivery → payment_methods_question', async () => {
        setLLMResponse(validBase({
            intent: 'payment_methods_question',
            confidence: 0.92,
            target: 'business',
            action: 'query',
            isTransactional: false,
        }));
        const result = await classifyIntentWithLLM('do you do cash on delivery', 'ecommerce');
        expect(result.intent).toBe('payment_methods_question');
        expect(result.isTransactional).toBe(false);
    });

    it('L12: ambiguous "that one" → product_reference + needsClarification', async () => {
        setLLMResponse(validBase({
            intent: 'product_reference',
            confidence: 0.60,
            needsClarification: true,
            isTransactional: false,
        }));
        const result = await classifyIntentWithLLM('that one', 'ecommerce');
        expect(result.intent).toBe('product_reference');
        expect(result.needsClarification).toBe(true);
    });
});

describe('LLM Intent Classifier — Edge Cases', () => {
    beforeEach(() => {
        process.env.GROQ_API_KEY = 'test-key';
    });

    it('handles markdown-wrapped JSON', async () => {
        mockGenerateTextResponse = '```json\n' + JSON.stringify(validBase({ intent: 'greeting', confidence: 0.9 })) + '\n```';
        const result = await classifyIntentWithLLM('hey', 'ecommerce');
        expect(result.intent).toBe('greeting');
    });

    it('returns fallback when GROQ_API_KEY missing', async () => {
        delete process.env.GROQ_API_KEY;
        const result = await classifyIntentWithLLM('hello', 'ecommerce');
        expect(result.intent).toBe('unknown');
        expect(result.source).toBe('llm');
    });

    it('sets isTransactional correctly for cancel intent', async () => {
        setLLMResponse(validBase({
            intent: 'cancel_order',
            confidence: 0.9,
            isTransactional: true,
        }));
        const result = await classifyIntentWithLLM('cancel my order', 'ecommerce');
        expect(result.isTransactional).toBe(true);
    });
});

describe('Safe Fallback Intent', () => {
    it('returns correct defaults', () => {
        const fallback = safeFallbackIntent();
        expect(fallback.intent).toBe('unknown');
        expect(fallback.confidence).toBe(0);
        expect(fallback.needsClarification).toBe(true);
        expect(fallback.source).toBe('llm');
        expect(fallback.isTransactional).toBe(false);
    });
});

const { guardFinalReply } = await import('../validation/final-reply-guard');

describe('Count-Aware Final Reply Guard', () => {

    it('blocks "both orders cancelled" when cancelledCount < 2', () => {
        const result = guardFinalReply({
            replyText: 'Both orders cancelled.',
            language: 'english',
            dbWriteSuccess: true,
            cancelMeta: { requestedScope: 'count', requestedCount: 2, cancelledCount: 1 },
        });
        expect(result.actionsToAdd).toContain('cancel_count_mismatch_blocked');
    });

    it('allows "both orders cancelled" when cancelledCount >= 2', () => {
        const result = guardFinalReply({
            replyText: 'Both orders cancelled.',
            language: 'english',
            dbWriteSuccess: true,
            cancelMeta: { requestedScope: 'count', requestedCount: 2, cancelledCount: 2 },
        });
        expect(result.actionsToAdd).not.toContain('cancel_count_mismatch_blocked');
    });

    it('blocks "all orders cancelled" when cancelledCount is 0', () => {
        const result = guardFinalReply({
            replyText: 'All orders cancelled.',
            language: 'english',
            dbWriteSuccess: true,
            cancelMeta: { requestedScope: 'all_pending', requestedCount: 3, cancelledCount: 0 },
        });
        expect(result.actionsToAdd).toContain('cancel_count_mismatch_blocked');
    });

    it('blocks "2 orders cancelled" when only 1 was cancelled', () => {
        const result = guardFinalReply({
            replyText: '2 orders cancelled.',
            language: 'english',
            dbWriteSuccess: true,
            cancelMeta: { requestedScope: 'count', requestedCount: 2, cancelledCount: 1 },
        });
        expect(result.actionsToAdd).toContain('cancel_count_mismatch_blocked');
    });

    it('allows status explanations like "only 1 order cancelled"', () => {
        const result = guardFinalReply({
            replyText: 'Only 1 order could be cancelled. The other is shipped.',
            language: 'english',
            dbWriteSuccess: true,
            cancelMeta: { requestedScope: 'count', requestedCount: 2, cancelledCount: 1 },
        });
        // "only 1 order" matches STATUS_EXPLANATION_PATTERNS
        expect(result.blockedReason).toBeUndefined();
    });
});
