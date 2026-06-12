import type { AutomationResult } from '@/lib/ai/types';
import { runV3Agent } from '@/lib/ai/agent';
import { loadWorkspaceConfig } from '@/lib/ai/config';

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

        // Load full workspace config in a single DB call (includes business_type)
        const config = await loadWorkspaceConfig(supabase, workspaceId, userId);
        if (!config) {
            console.error('❌ [Ghost Brain] Failed to load workspace config');
            return null;
        }

        const result = await runV3Agent({
            workspaceId,
            workspaceType: config.businessType,
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
