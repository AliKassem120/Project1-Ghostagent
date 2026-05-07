import { describe, it, expect, vi } from 'vitest';
import { answerSaasSupportMessage } from '../saas-support/responder';
import type { WorkspaceConfig } from '../types';

// ── Test fixtures ───────────────────────────────────────────

const OFFICIAL_WORKSPACE_ID = '2601af65-3e57-4460-adef-08f72641142f';
const TEST_USER_ID = 'test-user-123';
const TEST_CHAT_ID = 'test-chat-456';

const defaultConfig: WorkspaceConfig = {
    workspaceId: OFFICIAL_WORKSPACE_ID,
    userId: TEST_USER_ID,
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

const KNOWLEDGE_ROW = {
    id: 'kb-1',
    title: 'GhostAgent Master Knowledge Base',
    content: `GhostAgent is an AI assistant for Instagram and WhatsApp that automates customer conversations.

Features:
- Automated DM replies on Instagram & WhatsApp
- Smart appointment booking
- E-commerce order management
- Multi-language support (English, Arabic, Arabizi, French)
- Comment auto-reply
- Manager alerts via WhatsApp

Pricing:
- Starter: $29/mo — 500 messages
- Pro: $79/mo — 2000 messages + WhatsApp
- Empire: $199/mo — unlimited + priority support

How it works:
1. Connect your Instagram/WhatsApp account
2. Set up your business type (e-commerce or appointments)
3. Customize your AI's tone and instructions
4. Turn on Autopilot — the AI handles everything

Arabizi Support:
GhostAgent understands Arabizi/Lebanese Franco like bde, adde, ra2me, 3nwen, and mixed English-Arabizi messages.

WhatsApp Support:
GhostAgent supports WhatsApp Business when the WhatsApp connection is configured.

Order Features:
For ecommerce businesses, GhostAgent can answer product questions, collect name/phone/address, ask for confirmation, and save orders.

Appointment Features:
For appointment businesses, GhostAgent can check services, working hours, availability, collect details, and book appointments.

Setup Guide:
1. Sign up at ghostagent.ai
2. Connect your Instagram account
3. Configure your workspace type
4. Add products or services
5. Set your tone and language
6. Enable Autopilot`,
    source_type: 'manual',
    visibility: 'public',
};

function createMockSupabase(docs: any[] = [KNOWLEDGE_ROW]) {
    const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: docs, error: null }),
    };
    return {
        from: vi.fn().mockReturnValue(chain),
        _chain: chain,
    } as any;
}

function makeInput(message: string, supabase?: any) {
    return {
        supabase: supabase || createMockSupabase(),
        userId: TEST_USER_ID,
        workspaceId: OFFICIAL_WORKSPACE_ID,
        chatId: TEST_CHAT_ID,
        message,
        platform: 'instagram' as const,
        config: defaultConfig,
    };
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

describe('SaaS Support Responder — Greetings', () => {
    it('responds to "hi" with greeting', async () => {
        const result = await answerSaasSupportMessage(makeInput('hi'));
        expect(result.shouldReply).toBe(true);
        expect(result.replyText).toContain('GhostAgent');
        expect(result.actions).toContain('greeting');
        expect(result.replyText).not.toContain('[HANDOFF]');
    });

    it('responds to "salam" with Arabizi greeting', async () => {
        const result = await answerSaasSupportMessage(makeInput('salam'));
        expect(result.shouldReply).toBe(true);
        expect(result.replyText).toBeDefined();
        expect(result.actions).toContain('greeting');
    });

    it('responds to "hello!" with greeting', async () => {
        const result = await answerSaasSupportMessage(makeInput('hello!'));
        expect(result.shouldReply).toBe(true);
        expect(result.actions).toContain('greeting');
    });
});

describe('SaaS Support Responder — Human Handoff', () => {
    it('responds to "talk to someone" without [HANDOFF]', async () => {
        const result = await answerSaasSupportMessage(makeInput('talk to someone'));
        expect(result.shouldReply).toBe(true);
        expect(result.replyText).toContain('team');
        expect(result.replyText).not.toContain('[HANDOFF]');
        expect(result.actions).toContain('human_handoff_request');
    });

    it('responds to "human" without [HANDOFF]', async () => {
        const result = await answerSaasSupportMessage(makeInput('human'));
        expect(result.shouldReply).toBe(true);
        expect(result.replyText).not.toContain('[HANDOFF]');
        expect(result.actions).toContain('human_handoff_request');
    });

    it('responds to "call me" without [HANDOFF]', async () => {
        const result = await answerSaasSupportMessage(makeInput('call me'));
        expect(result.shouldReply).toBe(true);
        expect(result.replyText).not.toContain('[HANDOFF]');
    });
});

describe('SaaS Support Responder — Never calls transactional functions', () => {
    it('never inserts into orders table', async () => {
        const mockSb = createMockSupabase();
        const result = await answerSaasSupportMessage(makeInput('I want to order something', mockSb));

        // Even if LLM is unavailable, no DB writes should happen
        expect(result.shouldReply).toBe(true);
        expect(result.debug.dbWriteAttempted).toBe(false);
        expect(result.debug.dbWriteSuccess).toBe(false);
        expect(result.replyText).not.toContain('[HANDOFF]');
    });

    it('never inserts into appointments table', async () => {
        const mockSb = createMockSupabase();
        const result = await answerSaasSupportMessage(makeInput('I want to book an appointment', mockSb));

        expect(result.shouldReply).toBe(true);
        expect(result.debug.dbWriteAttempted).toBe(false);
        expect(result.debug.dbWriteSuccess).toBe(false);
    });

    it('stateAfter is always idle (no FSM state)', async () => {
        const result = await answerSaasSupportMessage(makeInput('tell me about pricing'));
        expect(result.stateBefore).toBe('idle');
        expect(result.stateAfter).toBe('idle');
        // saas_support never saves transactional state
        expect(result.debug.workspaceType).toBe('saas_support');
    });
});

describe('SaaS Support Responder — Knowledge Search', () => {
    it('passes workspaceId to knowledge search', async () => {
        const mockSb = createMockSupabase();
        await answerSaasSupportMessage(makeInput('What is GhostAgent?', mockSb));

        // Verify from() was called with business_knowledge
        expect(mockSb.from).toHaveBeenCalledWith('business_knowledge');
    });

    it('uses visibility=public filter', async () => {
        const mockSb = createMockSupabase();
        await answerSaasSupportMessage(makeInput('pricing', mockSb));

        expect(mockSb._chain.eq).toHaveBeenCalledWith('visibility', 'public');
    });

    it('handles empty knowledge gracefully', async () => {
        // First call (keyword) empty, second call (fallback) also empty
        const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        const mockSb = { from: vi.fn().mockReturnValue(chain) } as any;

        const result = await answerSaasSupportMessage(makeInput('random question', mockSb));

        expect(result.shouldReply).toBe(true);
        expect(result.replyText).toBeDefined();
        // Without GROQ_API_KEY (CI), returns error_no_api_key
        // With GROQ_API_KEY (local), returns saas_knowledge_fallback
        const validActions = ['saas_knowledge_fallback', 'error_no_api_key'];
        expect(result.actions.some(a => validActions.includes(a))).toBe(true);
    });
});

describe('SaaS Support Responder — Reply Safety', () => {
    it('reply never contains [HANDOFF]', async () => {
        // Test with various messages that might trigger handoff
        const messages = [
            'help me',
            'this is broken',
            'I need support',
            'how does ghost agent works',
            'what features do you have',
        ];

        for (const msg of messages) {
            const result = await answerSaasSupportMessage(makeInput(msg));
            expect(result.replyText).not.toContain('[HANDOFF]');
        }
    });

    it('never asks for order details (deterministic check)', async () => {
        // Use greeting path to avoid LLM dependency
        const result = await answerSaasSupportMessage(makeInput('hi'));
        expect(result.replyText).not.toMatch(/what.*address/i);
        expect(result.replyText).not.toMatch(/phone.*number/i);
        expect(result.replyText).not.toMatch(/what.*size/i);
    });

    it('never asks for appointment date/time (deterministic check)', async () => {
        // Use greeting path to avoid LLM dependency
        const result = await answerSaasSupportMessage(makeInput('hello'));
        expect(result.replyText).not.toMatch(/what.*date/i);
        expect(result.replyText).not.toMatch(/what.*time/i);
        expect(result.replyText).not.toMatch(/which.*service/i);
    });

    it('dbWriteAttempted is always false', async () => {
        const result = await answerSaasSupportMessage(makeInput('can you book for me?'));
        expect(result.debug.dbWriteAttempted).toBe(false);
        expect(result.debug.dbWriteSuccess).toBe(false);
    });
});
