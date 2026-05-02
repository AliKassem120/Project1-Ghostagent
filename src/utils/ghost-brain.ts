import { handleAutomationMessageV3 } from '@/lib/automation-v3';

// ═══════════════════════════════════════════════════════════════
// 🧠 GHOST AGENT — Core AI Brain Router
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
        if (!workspaceId || !chatId) {
            console.warn('⚠️ [Ghost Brain] Missing workspaceId or chatId, skipping automation.');
            return { replyText: null, skipLegacyLogging: true };
        }

        const { data: settings } = await supabase
            .from('ai_settings')
            .select('business_type')
            .eq('id', workspaceId)
            .limit(1)
            .maybeSingle();

        const businessType = settings?.business_type || 'ecommerce';

        console.log(`🚀 [Ghost Engine V3] Processing message for workspace ${workspaceId}`);
        const result = await handleAutomationMessageV3({
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
    } catch (error: any) {
        console.error('❌ [Ghost Engine V3] Failed to route request:', error);
        return null;
    }
}
