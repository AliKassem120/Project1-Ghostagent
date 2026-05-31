import { WorkspaceConfig } from './types';

export async function loadWorkspaceConfig(supabase: any, workspaceId: string, userId: string): Promise<WorkspaceConfig | null> {
    const { data: settings } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('id', workspaceId)
        .maybeSingle();

    if (!settings) return null;

    return {
        workspaceId,
        userId,
        businessName: settings.business_name || 'GhostAgent Business',
        businessType: settings.business_type === 'appointments' ? 'appointments' : 'ecommerce',
        tone: settings.tone || 'Friendly',
        language: settings.language || 'Auto-Detect',
        timezone: settings.timezone || 'UTC',
        useEmojis: settings.use_emojis ?? true,
        systemInstructions: settings.system_instructions || null,
        storeLocation: settings.store_location || null,
        contactInfo: settings.contact_info || null,
        handoffKeywords: settings.handoff_keywords || [],
        shippingRules: settings.shipping_rules || null,
        maxDiscount: settings.max_discount || null,
        minOrderForDiscount: settings.min_order_for_discount || null,
        slotDurationMinutes: settings.slot_duration_minutes || 30,
        automationEngineVersion: settings.automation_engine_version || 'v2'
    };
}
