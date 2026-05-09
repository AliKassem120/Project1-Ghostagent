'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'


export async function updateWorkspaceSettingsAction(workspaceId: string, settings: any, isEmpire: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Unauthorized')
    }

    // ── SERVER-SIDE PLAN VERIFICATION ──────────────────────
    // Don't trust the client-passed `isEmpire` — verify against the DB
    const { data: userData } = await supabase
        .from('users')
        .select('plan_tier')
        .eq('id', user.id)
        .single()

    const planTier = (userData?.plan_tier || 'starter').toLowerCase()
    const isPro = planTier === 'pro' || planTier === 'empire'
    const isEmpireVerified = planTier === 'empire'
    const isPaid = planTier === 'pro' || planTier === 'empire' // pro, empire get reply delay

    const { error } = await supabase
        .from('ai_settings')
        .update({
            business_name: settings.businessName,
            tone: settings.tone,
            use_emojis: settings.useEmojis,
            max_discount: settings.maxDiscount,
            min_order_for_discount: settings.minOrderForDiscount,
            language: settings.language,
            system_instructions: settings.systemPrompt,
            whatsapp_template: settings.whatsappTemplate,
            store_location: settings.storeLocation,
            contact_info: settings.contactInfo,
            shipping_rules: settings.shippingRules || null,
            business_type: settings.businessType,
            // Reply Delay: paid plans only (starter+)
            reply_delay_seconds: isPaid ? (settings.replyDelay || 0) : 0,
            // Manager Alerts (WhatsApp number): Pro+ only
            emergency_whatsapp: isPro ? settings.emergencyWhatsApp : '',
            // Auto Comment Reply: Pro+ only
            comment_auto_reply: isPro ? settings.commentAutoReply : false,
            comment_reply_style: isPro ? settings.commentReplyStyle : 'public',
            comment_keywords: isPro && settings.commentKeywords ? settings.commentKeywords.split(',').map((k: string) => k.trim()).filter(Boolean) : [],
            comment_max_per_post: isPro ? (settings.commentMaxPerPost || 0) : 0,
            updated_at: new Date().toISOString(),
            // WhatsApp Business credentials: Pro+ (server-verified)
            ...(isPro ? {
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
