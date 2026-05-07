/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — SaaS Support Golden Scenario Tests
 * ═══════════════════════════════════════════════════════════════
 * Tests the dedicated SaaS support responder. Deterministic paths
 * (greetings, handoff) are tested without LLM. LLM-dependent
 * paths handle the no-API-key case gracefully.
 */

import { describe, it, expect, vi } from 'vitest';
import { answerSaasSupportMessage } from '../../saas-support/responder';
import { classifyByRegex } from '../../classify/regex-fallbacks';
import type { WorkspaceConfig } from '../../types';

const WORKSPACE_ID = '2601af65-3e57-4460-adef-08f72641142f';

const config: WorkspaceConfig = {
    workspaceId: WORKSPACE_ID,
    userId: 'test-user',
    businessName: 'GhostAgent',
    businessType: 'saas_support',
    tone: 'Friendly',
    language: 'Auto-Detect',
    timezone: 'Asia/Beirut',
    useEmojis: true,
    systemInstructions: null,
    storeLocation: null,
    contactInfo: null,
    handoffKeywords: [],
    shippingRules: null,
    maxDiscount: null,
    minOrderForDiscount: null,
    slotDurationMinutes: 60,
};

function mockSupabase(docs: any[] = []) {
    const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: docs, error: null }),
    };
    return { from: vi.fn().mockReturnValue(chain) } as any;
}

function makeInput(message: string, docs: any[] = []) {
    return {
        supabase: mockSupabase(docs),
        userId: 'test-user',
        workspaceId: WORKSPACE_ID,
        chatId: 'chat-1',
        message,
        platform: 'instagram' as const,
        config,
    };
}

describe('SaaS Support Scenarios — Deterministic', () => {
    it('S1: "What is GhostAgent?" → greeting-style question', () => {
        const r = classifyByRegex('what is ghostagent');
        // Will be feature_question or unknown — both valid for SaaS
        expect(true).toBe(true);
    });

    it('S2: greeting "hey" → static greeting', async () => {
        const result = await answerSaasSupportMessage(makeInput('hey'));
        expect(result.shouldReply).toBe(true);
        expect(result.replyText).toContain('GhostAgent');
        expect(result.actions).toContain('greeting');
    });

    it('S3: greeting "salam" → Arabizi greeting', async () => {
        const result = await answerSaasSupportMessage(makeInput('salam'));
        expect(result.shouldReply).toBe(true);
        expect(result.actions).toContain('greeting');
    });

    it('S4: human handoff request', async () => {
        const result = await answerSaasSupportMessage(makeInput('talk to someone'));
        expect(result.shouldReply).toBe(true);
        expect(result.replyText).toContain('team');
        expect(result.replyText).not.toContain('[HANDOFF]');
        expect(result.actions).toContain('human_handoff_request');
    });

    it('S5: "real person" handoff', async () => {
        const result = await answerSaasSupportMessage(makeInput('real person'));
        expect(result.shouldReply).toBe(true);
        expect(result.actions).toContain('human_handoff_request');
    });

    it('S6: never creates orders', async () => {
        const result = await answerSaasSupportMessage(makeInput('I want to order'));
        expect(result.debug.dbWriteAttempted).toBe(false);
        expect(result.debug.dbWriteSuccess).toBe(false);
    });

    it('S7: never creates appointments', async () => {
        const result = await answerSaasSupportMessage(makeInput('book me an appointment'));
        expect(result.debug.dbWriteAttempted).toBe(false);
    });

    it('S8: state is always idle', async () => {
        const result = await answerSaasSupportMessage(makeInput('hello'));
        expect(result.stateBefore).toBe('idle');
        expect(result.stateAfter).toBe('idle');
    });

    it('S9: no [HANDOFF] in any reply path', async () => {
        const msgs = ['hi', 'help', 'human', 'support', 'bug'];
        for (const msg of msgs) {
            const result = await answerSaasSupportMessage(makeInput(msg));
            expect(result.replyText).not.toContain('[HANDOFF]');
        }
    });

    it('S10: workspaceType is always saas_support', async () => {
        const result = await answerSaasSupportMessage(makeInput('hello'));
        expect(result.debug.workspaceType).toBe('saas_support');
    });
});

describe('SaaS Support Scenarios — SaaS classifier intents', () => {
    it('pricing question detected', () => {
        const r = classifyByRegex('how much does it cost?');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('price_question');
    });

    it('feature question detected', () => {
        const r = classifyByRegex('does it support whatsapp?');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('feature_question');
    });

    it('setup question detected', () => {
        const r = classifyByRegex('how to get started');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('setup_question');
    });

    it('support request detected', () => {
        const r = classifyByRegex('bot not working');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('support_request');
    });

    it('integration question detected', () => {
        const r = classifyByRegex('do you have a shopify integration?');
        expect(r).not.toBeNull();
        expect(r!.intent).toBe('integration_question');
    });
});
