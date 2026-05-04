import { handleAutomationMessage } from '@/lib/automation-v2';

// ═══════════════════════════════════════════════════════════════
// 🧠 GHOST AGENT — Core AI Brain Router
// Single entry point. Routes every message to the V2 engine.
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

        // Fetch business type
        const { data: settings } = await supabase
            .from('ai_settings')
            .select('business_type')
            .eq('id', workspaceId)
            .maybeSingle();

        const businessType = settings?.business_type || 'ecommerce';

        const result = await handleAutomationMessage({
            workspaceId,
            workspaceType: businessType as 'appointments' | 'ecommerce' | 'saas_support',
            chatId,
            message: userMessage,
            platform,
            supabase,
            userId,
        });

        if (!result.shouldReply) return { replyText: null, skipLegacyLogging: true };
        return { replyText: result.replyText || null, skipLegacyLogging: true };
    } catch (error: any) {
        console.error('❌ [Ghost Brain] Failed:', error);
        return null;
    }
}
