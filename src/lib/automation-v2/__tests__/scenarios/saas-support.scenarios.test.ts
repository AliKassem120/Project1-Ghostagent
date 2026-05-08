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
    it('S1: "What is GhostAgent?" → handled by responder', async () => {
        const result = await answerSaasSupportMessage(makeInput('what is ghostagent'));
        expect(result.shouldReply).toBe(true);
        // SaaS responder always handles this — no classifier needed
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

describe('SaaS Support Scenarios — SaaS Bypass Proof', () => {
    it('feature question handled by responder, not classifier', async () => {
        // "does it support whatsapp?" should be answerable by the SaaS responder directly
        // without needing a regex intent — the responder has official knowledge
        const result = await answerSaasSupportMessage(makeInput('does it support whatsapp?'));
        expect(result.shouldReply).toBe(true);
        expect(result.debug.dbWriteAttempted).toBe(false);
    });

    it('setup question handled by responder', async () => {
        const result = await answerSaasSupportMessage(makeInput('how do I get started?'));
        expect(result.shouldReply).toBe(true);
        expect(result.debug.dbWriteAttempted).toBe(false);
    });

    it('pricing question handled by responder', async () => {
        const result = await answerSaasSupportMessage(makeInput('how much does it cost?'));
        expect(result.shouldReply).toBe(true);
        expect(result.debug.dbWriteAttempted).toBe(false);
    });

    it('bug report handled by responder without order/appointment creation', async () => {
        const result = await answerSaasSupportMessage(makeInput('bot not working'));
        expect(result.shouldReply).toBe(true);
        expect(result.debug.dbWriteAttempted).toBe(false);
    });

    it('Arabizi questions handled', async () => {
        const result = await answerSaasSupportMessage(makeInput('shu howe GhostAgent?'));
        expect(result.shouldReply).toBe(true);
    });

    it('never outputs [HANDOFF] for any query type', async () => {
        const queries = [
            'what is ghostagent?',
            'how does it work?',
            'does it support whatsapp?',
            'can it take orders?',
            'can it book appointments?',
            'does it support arabizi?',
        ];
        for (const q of queries) {
            const result = await answerSaasSupportMessage(makeInput(q));
            expect(result.replyText).not.toContain('[HANDOFF]');
        }
    });
});

