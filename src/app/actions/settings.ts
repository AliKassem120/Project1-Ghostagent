'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'


export async function updateWorkspaceSettingsAction(workspaceId: string, settings: any, isEmpire: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Unauthorized')
    }

    const { error } = await supabase
        .from('ai_settings')
        .update({
            business_name: settings.businessName,
            tone: settings.tone,
            use_emojis: settings.useEmojis,
            max_discount: settings.maxDiscount,
            min_order_for_discount: settings.minOrderForDiscount,
            emergency_whatsapp: settings.emergencyWhatsApp,
            language: settings.language,
            system_instructions: settings.systemPrompt,
            whatsapp_template: settings.whatsappTemplate,
            store_location: settings.storeLocation,
            contact_info: settings.contactInfo,
            shipping_rules: settings.shippingRules || null,
            use_local_slang: settings.useLocalSlang,
            business_type: settings.businessType,
            reply_delay_seconds: settings.replyDelay || 0,
            updated_at: new Date().toISOString(),
            ...(isEmpire ? {
                whatsapp_business_account_id: settings.waBusinessAccountId || null,
                whatsapp_phone_number_id: settings.waPhoneNumberId || null,
                whatsapp_access_token: settings.waAccessToken || null,
            } : {}),
        })
        .eq('id', workspaceId)

    if (error) {
        console.error('Failed to update workspace settings:', error.message)
        throw new Error('Failed to save settings')
    }

    // Aggressively dump the cache and force redraw
    revalidatePath('/dashboard', 'layout')

    return { success: true }
}
