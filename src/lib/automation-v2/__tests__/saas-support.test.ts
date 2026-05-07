import { describe, it, expect, vi } from 'vitest';
import { classifyIntent } from '../classify/intent-classifier';
import { searchSaasKnowledge } from '../saas-support/knowledge';

describe('SaaS Support Intents', () => {
    it('classifies feature questions correctly', () => {
        expect(classifyIntent('does it support whatsapp?').intent).toBe('feature_question');
        expect(classifyIntent('what features do you have?').intent).toBe('feature_question');
        expect(classifyIntent('can it connect to instagram?').intent).toBe('feature_question');
    });

    it('classifies setup questions correctly', () => {
        expect(classifyIntent('how to start?').intent).toBe('setup_question');
        expect(classifyIntent('how do i create account').intent).toBe('setup_question');
    });

    it('classifies arabizi questions correctly', () => {
        expect(classifyIntent('do you support arabizi?').intent).toBe('arabizi_question');
        expect(classifyIntent('can it detect language?').intent).toBe('arabizi_question');
    });

    it('classifies demo requests correctly', () => {
        expect(classifyIntent('can i see a demo?').intent).toBe('demo_request');
        expect(classifyIntent('try it').intent).toBe('demo_request');
    });

    it('classifies support requests correctly', () => {
        expect(classifyIntent('i need help').intent).toBe('support_request');
        expect(classifyIntent('its not working').intent).toBe('support_request');
        expect(classifyIntent('i found a bug').intent).toBe('support_request');
    });

    it('classifies pricing questions correctly', () => {
        // Handled by existing price_question intent
        expect(classifyIntent('how much does it cost?').intent).toBe('price_question');
        expect(classifyIntent('price?').intent).toBe('price_question');
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
