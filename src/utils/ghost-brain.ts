import type { AutomationResult } from '@/lib/automation-v2/types';

// ═══════════════════════════════════════════════════════════════
// 🧠 GHOST AGENT — Core AI Brain (V3)
// Single entry point. All messages go through the V3 LLM agent.
// ═══════════════════════════════════════════════════════════════

export async function generateGhostReply(
    userId: string,
    userMessage: string,
    supabase: any,
    chatId?: string,
    workspaceId?: string,
    platform: 'instagram' | 'whatsapp' = 'instagram'
) {
    try {
        if (!workspaceId || !chatId) {
            console.error('❌ [Ghost Brain] Missing workspaceId or chatId');
            return null;
        }

        // Fetch business type from workspace settings
        const { data: settings } = await supabase
            .from('ai_settings')
            .select('business_type')
            .eq('id', workspaceId)
            .maybeSingle();

        const businessType = settings?.business_type || 'ecommerce';

        // ── V3 LLM Agent ────────────────────────────────────
        const { runV3Agent } = await import('@/lib/automation-v3/agent');
        const { loadWorkspaceConfig } = await import('@/lib/automation-v2/router');

        const config = await loadWorkspaceConfig(supabase, workspaceId, userId);
        if (!config) {
            console.error('❌ [Ghost Brain] Failed to load workspace config');
            return null;
        }

        const result = await runV3Agent({
            workspaceId,
            workspaceType: businessType as 'appointments' | 'ecommerce' | 'saas_support',
            chatId,
            message: userMessage,
            platform,
            supabase,
            userId,
        }, config);

        if (!result.shouldReply) {
            return { replyText: null, skipLegacyLogging: false, automationResult: result };
        }

        return {
            replyText: result.replyText || null,
            skipLegacyLogging: false,
            automationResult: result,
            debug: result.debug,
            actions: result.actions,
        };

    } catch (error: any) {
        console.error('❌ [Ghost Brain] Failed:', error);
        return null;
    }
}

export type GhostReplyResult = {
    replyText: string | null;
    skipLegacyLogging: boolean;
    automationResult?: AutomationResult;
    debug?: AutomationResult['debug'];
    actions?: string[];
} | null;
