// ═══════════════════════════════════════════════════════════════
// 📱 GHOST AGENT — WhatsApp Manager Alert Utility
// Sends an escalation alert to the business owner's WhatsApp
// when a customer triggers a handoff keyword on Instagram.
//
// Uses a Ghost Agent SYSTEM-level token so the owner doesn't
// need to configure WhatsApp Business credentials for alerts.
// ═══════════════════════════════════════════════════════════════

const WA_API_BASE = 'https://graph.facebook.com/v18.0';

// Keywords that always trigger a manager alert (merged with user's own handoff_keywords)
export const ALERT_KEYWORDS = ['manager', 'human', 'scam', 'scammer', 'bot', 'refund', 'fraud', 'lawsuit', 'police'];

/**
 * Check if a message contains any alert-triggering keywords.
 */
export function containsAlertKeyword(message: string, extraKeywords: string[] = []): boolean {
    const allKeywords = [...ALERT_KEYWORDS, ...extraKeywords];
    const lower = message.toLowerCase();
    return allKeywords.some(kw => lower.includes(kw.toLowerCase()));
}

/**
 * Send a WhatsApp escalation alert to the business owner.
 * Uses the system-level Ghost Agent WhatsApp token.
 *
 * @param ownerWhatsApp  - Owner's WhatsApp number in E.164 format (e.g. +9611234567)
 * @param senderUsername - Instagram username or sender ID of the customer
 * @param triggeredKeyword - The keyword that triggered the alert
 * @param platform       - Source platform (default: 'instagram')
 */
export interface ManagerAlertOptions {
    ownerWhatsAppNumber: string;
    senderName: string;
    triggerKeyword: string;
    customerMessage: string;
    platform?: string;
}

export async function triggerManagerAlert(opts: ManagerAlertOptions): Promise<void> {
    const { ownerWhatsAppNumber, senderName, triggerKeyword, customerMessage, platform = 'instagram' } = opts;
    const systemToken = process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN;
    const fromPhoneId = process.env.WHATSAPP_FROM_PHONE_NUMBER_ID;

    if (!systemToken || !fromPhoneId) {
        console.warn('⚠️ Manager Alert skipped: WHATSAPP_SYSTEM_ACCESS_TOKEN or WHATSAPP_FROM_PHONE_NUMBER_ID not set.');
        return;
    }

    // Normalise: strip spaces, ensure + prefix
    const to = ownerWhatsAppNumber.replace(/\s+/g, '').replace(/^00/, '+');

    const alertMessage = `🚨 *Ghost Agent Alert*\n\nA customer on ${platform} (*${senderName}*) triggered the keyword: _“${triggerKeyword}”_\n\n*Their message:*\n“${customerMessage}”\n\nPlease check your DMs promptly.`;

    try {
        console.log(`🚨 [Alert] Sending WhatsApp alert to ${to} (from phone ID: ${fromPhoneId})`);
        const response = await fetch(`${WA_API_BASE}/${fromPhoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${systemToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'text',
                text: { body: alertMessage },
            }),
        });

        // Always log the full response body for debugging
        const responseBody = await response.text();
        if (!response.ok) {
            console.error(`❌ [Alert] Meta API error (${response.status}):`, responseBody);
        } else {
            console.log(`✅ [Alert] Manager Alert sent to ${to}. Meta response:`, responseBody);
        }
    } catch (err) {
        console.error('❌ [Alert] Manager Alert network error:', err);
    }
}
