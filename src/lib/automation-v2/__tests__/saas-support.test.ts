import { describe, it, expect, vi } from 'vitest';
import { classifyIntent } from '../classify/intent-classifier';
import { searchSaasKnowledge } from '../saas-support/knowledge';
import { OFFICIAL_GHOSTAGENT_FACTS } from '../saas-support/official-ghostagent-knowledge';

/**
 * SaaS support intents are handled by the dedicated responder.
 * The regex classifier no longer contains SaaS-specific intents
 * (feature_question, setup_question, etc.) because saas_support
 * workspaces are routed BEFORE the classifier runs.
 *
 * These tests verify:
 * 1. SaaS-style messages do NOT falsely trigger transactional intents
 * 2. Pricing questions still hit price_question (shared intent)
 * 3. The official knowledge module exists and contains key facts
 */
describe('SaaS Support — Intent Safety', () => {
    it('pricing questions hit price_question (shared intent)', () => {
        expect(classifyIntent('how much does it cost?').intent).toBe('price_question');
        expect(classifyIntent('price?').intent).toBe('price_question');
    });

    it('"does it support whatsapp?" does NOT trigger purchase_intent', () => {
        const result = classifyIntent('does it support whatsapp?');
        expect(result.intent).not.toBe('purchase_intent');
    });

    it('"how to get started" does NOT trigger purchase_intent', () => {
        const result = classifyIntent('how to get started');
        expect(result.intent).not.toBe('purchase_intent');
    });

    it('"i need help" does NOT trigger booking_intent', () => {
        const result = classifyIntent('i need help');
        expect(result.intent).not.toBe('booking_intent');
    });

    it('"can i see a demo?" does NOT trigger purchase_intent', () => {
        const result = classifyIntent('can i see a demo?');
        expect(result.intent).not.toBe('purchase_intent');
    });
});

describe('SaaS Official Knowledge Module', () => {
    it('contains key facts about GhostAgent', () => {
        expect(OFFICIAL_GHOSTAGENT_FACTS).toContain('GhostAgent');
        expect(OFFICIAL_GHOSTAGENT_FACTS).toContain('Instagram');
        expect(OFFICIAL_GHOSTAGENT_FACTS).toContain('WhatsApp');
    });

    it('contains pricing info', () => {
        expect(OFFICIAL_GHOSTAGENT_FACTS).toContain('Starter');
        expect(OFFICIAL_GHOSTAGENT_FACTS).toContain('Pro Agent');
        expect(OFFICIAL_GHOSTAGENT_FACTS).toContain('Empire');
        expect(OFFICIAL_GHOSTAGENT_FACTS).toContain('$49');
        expect(OFFICIAL_GHOSTAGENT_FACTS).toContain('$199');
    });

    it('contains workspace types', () => {
        expect(OFFICIAL_GHOSTAGENT_FACTS).toContain('E-Commerce');
        expect(OFFICIAL_GHOSTAGENT_FACTS).toContain('Appointments');
    });

    it('contains language support', () => {
        expect(OFFICIAL_GHOSTAGENT_FACTS).toContain('Arabizi');
        expect(OFFICIAL_GHOSTAGENT_FACTS).toContain('Lebanese Franco');
    });

    it('contains Autopilot info', () => {
        expect(OFFICIAL_GHOSTAGENT_FACTS).toContain('Autopilot');
        expect(OFFICIAL_GHOSTAGENT_FACTS).toContain('Draft');
    });

    it('does NOT contain private admin details', () => {
        expect(OFFICIAL_GHOSTAGENT_FACTS).not.toContain('service_role');
        expect(OFFICIAL_GHOSTAGENT_FACTS).not.toContain('SUPABASE_URL');
        expect(OFFICIAL_GHOSTAGENT_FACTS).not.toContain('god_mode');
    });
});

describe('SaaS Knowledge Search', () => {
    const OFFICIAL_WORKSPACE = '2601af65-3e57-4460-adef-08f72641142f';

    function createMockSupabase(rows: any[]) {
        const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
        };
        return {
            from: vi.fn().mockReturnValue(chain),
            _chain: chain,
        } as any;
    }

    it('returns knowledge when query matches "ghostagent" in content', async () => {
        const knowledgeRow = {
            id: 'kb-1',
            title: 'GhostAgent Master Knowledge Base',
            content: 'GhostAgent is an AI assistant for Instagram and WhatsApp that automates customer conversations.',
            source_type: 'manual',
            visibility: 'public',
        };

        const mockSb = createMockSupabase([knowledgeRow]);
        const results = await searchSaasKnowledge(mockSb, OFFICIAL_WORKSPACE, 'What is GhostAgent?');

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].title).toBe('GhostAgent Master Knowledge Base');
        expect(results[0].content).toContain('GhostAgent is an AI assistant');
    });

    it('falls back to all docs when keyword search finds nothing', async () => {
        const knowledgeRow = {
            id: 'kb-1',
            title: 'GhostAgent Master Knowledge Base',
            content: 'GhostAgent is an AI assistant that handles DMs.',
            source_type: 'manual',
            visibility: 'public',
        };

        // First call (keyword search) returns empty, second (fallback) returns docs
        const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn()
                .mockResolvedValueOnce({ data: [], error: null })
                .mockResolvedValueOnce({ data: [knowledgeRow], error: null }),
        };
        const mockSb = { from: vi.fn().mockReturnValue(chain) } as any;

        const results = await searchSaasKnowledge(mockSb, OFFICIAL_WORKSPACE, 'xyz obscure query');

        // Should have fallen back and returned the doc
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].title).toBe('GhostAgent Master Knowledge Base');
    });

    it('returns empty array when workspace has no knowledge docs', async () => {
        const mockSb = createMockSupabase([]);
        const results = await searchSaasKnowledge(mockSb, OFFICIAL_WORKSPACE, 'anything');
        expect(results).toEqual([]);
    });
});
