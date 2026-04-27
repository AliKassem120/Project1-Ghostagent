import { generateEcommerceGhostReply } from './brains/ecommerce/brain';
import { generateAppointmentsGhostReply } from './brains/appointments/brain';
import { handleAutomationMessage } from '@/lib/automation-v2';

// ═══════════════════════════════════════════════════════════════
// 🧠 GHOST AGENT — Core AI Brain Router
// This file simply delegates AI generation to the fully isolated
// workspaces depending on the business type.
//
// V2 Feature Flag:
//   - If workspace has automation_engine_version = 'v2' → V2 engine
//   - If env AUTOMATION_ENGINE_VERSION = 'v2' → V2 for all workspaces
//   - Otherwise → V1 (existing brains)
// ═══════════════════════════════════════════════════════════════

export async function generateGhostReply(
    userId: string,
    userMessage: string,
    supabase: any,
    chatId?: string,
    workspaceId?: string,
    checkoutContext?: string
) {
    try {
        let settingsQuery = supabase
            .from('ai_settings')
            .select('business_type, automation_engine_version');

        if (workspaceId) {
            settingsQuery = settingsQuery.eq('id', workspaceId);
        } else {
            settingsQuery = settingsQuery.eq('user_id', userId).is('id', null);
        }

        const { data: settings } = await settingsQuery.limit(1).maybeSingle();
        const businessType = settings?.business_type || 'ecommerce';

        // ── V2 Feature Flag Check ────────────────────────────
        const envVersion = process.env.AUTOMATION_ENGINE_VERSION;
        const wsVersion = settings?.automation_engine_version;
        const useV2 = wsVersion === 'v2' || (envVersion === 'v2' && wsVersion !== 'v1');

        if (useV2 && workspaceId && chatId) {
            console.log(`🚀 [Ghost Brain Router] Using V2 engine for workspace ${workspaceId}`);
            const result = await handleAutomationMessage({
                workspaceId,
                workspaceType: businessType as 'appointments' | 'ecommerce',
                chatId,
                message: userMessage,
                platform: 'instagram',
                supabase,
                userId,
            });

            if (!result.shouldReply) return { replyText: null, skipLegacyLogging: true };
            return { replyText: result.replyText || null, skipLegacyLogging: true };
        }

        // ── V1 Fallback (existing behavior) ──────────────────
        let v1Reply: string | null = null;
        if (businessType === 'appointments') {
            v1Reply = await generateAppointmentsGhostReply(userId, userMessage, supabase, chatId, workspaceId, checkoutContext);
        } else {
            // Default to ecommerce
            v1Reply = await generateEcommerceGhostReply(userId, userMessage, supabase, chatId, workspaceId, checkoutContext);
        }
        return { replyText: v1Reply, skipLegacyLogging: false };
    } catch (error: any) {
        console.error('❌ [Ghost Brain Router] Failed to route request:', error);
        return null;
    }
}
