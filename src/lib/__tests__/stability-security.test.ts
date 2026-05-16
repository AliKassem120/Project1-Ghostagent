import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isGodModeUser } from '../god-mode/auth';
import { createAppointmentTools } from '../ai/tools';
import { searchSaasKnowledge } from '../ai/saas-support/knowledge';

describe('Security Patch — God Mode Auth', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('denies login in production if credentials are missing', () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('GOD_MODE_USER', '');
        vi.stubEnv('GOD_MODE_PASS', '');
        
        expect(isGodModeUser('ghost123agent', 'agentgodmode')).toBe(false);
    });

    it('allows login in production with correct env credentials', () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('GOD_MODE_USER', 'admin');
        vi.stubEnv('GOD_MODE_PASS', 'secret');
        
        expect(isGodModeUser('admin', 'secret')).toBe(true);
    });

    it('allows fallback in development/test', () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('GOD_MODE_USER', '');
        vi.stubEnv('GOD_MODE_PASS', '');
        
        expect(isGodModeUser('ghost123agent', 'agentgodmode')).toBe(true);
    });
});

describe('Stability Patch — Appointment Status', () => {
    it('cancel_appointment uses lowercase statuses', async () => {
        const mockSingle = vi.fn().mockResolvedValue({ 
            data: { 
                id: '123', 
                service: 'Haircut', 
                appointment_date: '2026-05-05', 
                start_time: '10:00',
                status: 'confirmed'
            }, 
            error: null 
        });
        const mockUpdate = vi.fn().mockResolvedValue({ error: null });
        
        const mockSupabase = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: mockSingle,
            update: vi.fn().mockReturnThis(),
        } as any;

        mockSupabase.update.mockReturnValue({ eq: mockUpdate });

        const tools = createAppointmentTools({
            supabase: mockSupabase,
            workspaceId: 'ws_123',
            chatId: 'chat_123',
            userId: 'user_123',
            config: {} as any,
            platform: 'instagram'
        });

        await tools.cancel_appointment.execute();

        // Verify update used lowercase
        expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'cancelled' });
    });
});

describe('Security Patch — SaaS Knowledge Isolation', () => {
    it('scopes knowledge search to the correct workspace and public visibility', async () => {
        const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        const mockSupabase = {
            from: vi.fn().mockReturnValue(chain),
        } as any;

        await searchSaasKnowledge(mockSupabase, 'ws_123', 'test');

        // Must scope to the specific workspace
        expect(chain.eq).toHaveBeenCalledWith('workspace_id', 'ws_123');
        // Must filter by public visibility only
        expect(chain.eq).toHaveBeenCalledWith('visibility', 'public');
    });
});
