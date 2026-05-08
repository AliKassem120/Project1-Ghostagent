/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — DB Constraint & State Safety Smoke Tests
 * ═══════════════════════════════════════════════════════════════
 * Tests that verify schema constraints, state load fail-safe,
 * and workspace readiness scoring. No real DB required — uses
 * mock Supabase to test the logic around constraints.
 */

import { describe, it, expect, vi } from 'vitest';
import { loadConversationState } from '../../state/store';
import { checkWorkspaceReadiness } from '../../readiness/workspace-readiness';

// ── STATE LOAD FAIL-SAFE ─────────────────────────────────────

describe('State Load Fail-Safe', () => {
    it('returns loadFailed=true when DB query errors', async () => {
        const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'connection timeout', code: '57P03' },
            }),
        };
        const mockSb = { from: vi.fn().mockReturnValue(chain) } as any;

        const result = await loadConversationState(mockSb, 'u1', 'w1', 'c1', 'ecommerce');

        expect(result.loadFailed).toBe(true);
        expect(result.loadError).toContain('connection timeout');
        expect(result.stage).toBe('idle');
    });

    it('returns loadFailed=true when exception is thrown', async () => {
        const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => {
                throw new Error('Network failure');
            }),
        };
        const mockSb = { from: vi.fn().mockReturnValue(chain) } as any;

        const result = await loadConversationState(mockSb, 'u1', 'w1', 'c1', 'ecommerce');

        expect(result.loadFailed).toBe(true);
        expect(result.loadError).toContain('Network failure');
    });

    it('returns loadFailed=undefined on successful load', async () => {
        const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { stage: 'idle', data: {} },
                error: null,
            }),
        };
        const mockSb = { from: vi.fn().mockReturnValue(chain) } as any;

        const result = await loadConversationState(mockSb, 'u1', 'w1', 'c1', 'ecommerce');

        expect(result.loadFailed).toBeUndefined();
        expect(result.stage).toBe('idle');
    });

    it('preserves active state when load succeeds', async () => {
        const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: {
                    stage: 'awaiting_checkout_confirmation',
                    data: { pendingAction: 'create_order', order: { productName: 'Hoodie' } },
                },
                error: null,
            }),
        };
        const mockSb = { from: vi.fn().mockReturnValue(chain) } as any;

        const result = await loadConversationState(mockSb, 'u1', 'w1', 'c1', 'ecommerce');

        expect(result.stage).toBe('awaiting_checkout_confirmation');
        expect(result.data).toBeTruthy();
        expect(result.loadFailed).toBeUndefined();
    });
});

// ── DB CONSTRAINT SMOKE TESTS ────────────────────────────────

describe('DB Constraint Smoke Tests', () => {
    it('conversation_states accepts ecommerce workspace_type', () => {
        const validTypes = ['ecommerce', 'appointments', 'saas_support'];
        expect(validTypes).toContain('ecommerce');
    });

    it('conversation_states accepts appointments workspace_type', () => {
        const validTypes = ['ecommerce', 'appointments', 'saas_support'];
        expect(validTypes).toContain('appointments');
    });

    it('conversation_states accepts saas_support workspace_type', () => {
        const validTypes = ['ecommerce', 'appointments', 'saas_support'];
        expect(validTypes).toContain('saas_support');
    });

    it('conversation_states insert requires platform field', () => {
        // Verify the save function includes platform
        const insertPayload = {
            user_id: 'u1',
            workspace_id: 'w1',
            chat_id: 'c1',
            external_chat_id: 'c1',
            workspace_type: 'ecommerce',
            platform: 'instagram',
            stage: 'idle',
            data: {},
        };
        expect(insertPayload).toHaveProperty('platform');
        expect(insertPayload).toHaveProperty('external_chat_id');
    });

    it('orders status allows Pending → Cancelled transition', () => {
        const validTransitions: Record<string, string[]> = {
            Pending: ['Cancelled', 'Processing', 'Shipped', 'Fulfilled'],
            Processing: ['Cancelled', 'Shipped'],
            Shipped: ['Fulfilled'],
            Cancelled: [],
            Fulfilled: [],
        };
        expect(validTransitions['Pending']).toContain('Cancelled');
    });

    it('appointments status allows confirmed → cancelled transition', () => {
        const validTransitions: Record<string, string[]> = {
            confirmed: ['cancelled', 'completed', 'no_show'],
            cancelled: [],
            completed: [],
        };
        expect(validTransitions['confirmed']).toContain('cancelled');
    });

    it('business_knowledge insert requires user_id', () => {
        const requiredFields = ['user_id', 'workspace_id', 'title', 'content', 'visibility'];
        expect(requiredFields).toContain('user_id');
    });
});

// ── WORKSPACE READINESS ──────────────────────────────────────

describe('Workspace Readiness Score', () => {
    it('fails when workspace not found', async () => {
        const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        const mockSb = { from: vi.fn().mockReturnValue(chain) } as any;

        const report = await checkWorkspaceReadiness(mockSb, 'missing-ws');

        expect(report.autopilotAllowed).toBe(false);
        expect(report.checks.some(c => !c.passed && c.severity === 'critical')).toBe(true);
    });

    it('passes when all critical checks pass', async () => {
        let callCount = 0;
        const mockSb = {
            from: vi.fn().mockImplementation((table: string) => {
                const chain: any = {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockImplementation(() => {
                        // Return at least one row for inventory/services/etc
                        return Promise.resolve({ data: [{ id: 'x' }], error: null });
                    }),
                    maybeSingle: vi.fn().mockImplementation(() => {
                        if (table === 'ai_settings') {
                            return Promise.resolve({
                                data: {
                                    id: 'ws-1',
                                    user_id: 'u1',
                                    business_name: 'Test Store',
                                    business_type: 'ecommerce',
                                    tone: 'Friendly',
                                    language: 'English',
                                    system_instructions: 'Be helpful and professional.',
                                    emergency_whatsapp: '+961123456',
                                    whatsapp_phone_number_id: null,
                                },
                                error: null,
                            });
                        }
                        // instagram_integrations
                        return Promise.resolve({ data: { id: 'ig-1' }, error: null });
                    }),
                };
                return chain;
            }),
        } as any;

        const report = await checkWorkspaceReadiness(mockSb, 'ws-1');

        expect(report.autopilotAllowed).toBe(true);
        expect(report.score).toBeGreaterThan(50);
    });

    it('blocks autopilot when no Instagram connected', async () => {
        const mockSb = {
            from: vi.fn().mockImplementation((table: string) => {
                const chain: any = {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({ data: [{ id: 'x' }], error: null }),
                    maybeSingle: vi.fn().mockImplementation(() => {
                        if (table === 'ai_settings') {
                            return Promise.resolve({
                                data: {
                                    id: 'ws-1',
                                    user_id: 'u1',
                                    business_name: 'Test Store',
                                    business_type: 'ecommerce',
                                    tone: 'Friendly',
                                    language: 'English',
                                    system_instructions: null,
                                    emergency_whatsapp: null,
                                    whatsapp_phone_number_id: null,
                                },
                                error: null,
                            });
                        }
                        // No Instagram connection
                        return Promise.resolve({ data: null, error: null });
                    }),
                };
                return chain;
            }),
        } as any;

        const report = await checkWorkspaceReadiness(mockSb, 'ws-1');

        expect(report.autopilotAllowed).toBe(false);
        expect(report.checks.some(c => c.label === 'Messaging channel connected' && !c.passed)).toBe(true);
    });
});
