import { generateEcommerceGhostReply } from './brains/ecommerce/brain';
import { generateAppointmentsGhostReply } from './brains/appointments/brain';

// ═══════════════════════════════════════════════════════════════
// 🧠 GHOST AGENT — Core AI Brain Router
// This file simply delegates AI generation to the fully isolated
// workspaces depending on the business type.
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
            .select('business_type');

        if (workspaceId) {
            settingsQuery = settingsQuery.eq('id', workspaceId);
        } else {
            settingsQuery = settingsQuery.eq('user_id', userId).is('id', null);
        }

        const { data: settings } = await settingsQuery.limit(1).maybeSingle();
        const businessType = settings?.business_type || 'ecommerce';

        if (businessType === 'appointments') {
            return await generateAppointmentsGhostReply(userId, userMessage, supabase, chatId, workspaceId, checkoutContext);
        } else {
            // Default to ecommerce
            return await generateEcommerceGhostReply(userId, userMessage, supabase, chatId, workspaceId, checkoutContext);
        }
    } catch (error: any) {
        console.error('❌ [Ghost Brain Router] Failed to route request:', error);
        return null;
    }
}
