import { handleAutomationMessage } from '@/lib/automation-v2';
import type { AutomationResult } from '@/lib/automation-v2/types';

// ═══════════════════════════════════════════════════════════════
// 🧠 GHOST AGENT — Core AI Brain Router
// Single entry point. Routes every message to V2 or V3 engine.
// V3 = opt-in per workspace via ai_settings.automation_engine_version
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

        // Fetch business type + engine version
        const { data: settings } = await supabase
            .from('ai_settings')
            .select('business_type, automation_engine_version')
            .eq('id', workspaceId)
            .maybeSingle();

        const businessType = settings?.business_type || 'ecommerce';
        const engineVersion = settings?.automation_engine_version || 'v2';

        // ── V3 Orchestrator (opt-in) ────────────────────────
        if (engineVersion === 'v3') {
            try {
                const { runV3Orchestrator } = await import('@/lib/automation-v2/orchestrator');
                const { loadWorkspaceConfig } = await import('@/lib/automation-v2/router');

                const config = await loadWorkspaceConfig(supabase, workspaceId, userId);
                if (!config) {
                    console.error('❌ [Ghost Brain] V3: Failed to load workspace config');
                    // Fall through to v2
                } else {
                    const result = await runV3Orchestrator({
                        workspaceId,
                        workspaceType: businessType as 'appointments' | 'ecommerce' | 'saas_support',
                        chatId,
                        message: userMessage,
                        platform,
                        supabase,
                        userId,
                    }, config);

                    if (!result.shouldReply) {
                        return { replyText: null, skipLegacyLogging: true, automationResult: result };
                    }

                    return {
                        replyText: result.replyText || null,
                        skipLegacyLogging: true,
                        automationResult: result,
                        debug: result.debug,
                        actions: result.actions,
                    };
                }
            } catch (v3Error: any) {
                console.error('❌ [Ghost Brain] V3 failed, falling back to V2:', v3Error.message);
                // Fall through to v2
            }
        }

        // ── V2 Engine (default) ─────────────────────────────
        const result = await handleAutomationMessage({
            workspaceId,
            workspaceType: businessType as 'appointments' | 'ecommerce' | 'saas_support',
            chatId,
            message: userMessage,
            platform,
            supabase,
            userId,
        });

        if (!result.shouldReply) {
            return { replyText: null, skipLegacyLogging: true, automationResult: result };
        }

        return {
            replyText: result.replyText || null,
            skipLegacyLogging: true,
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
