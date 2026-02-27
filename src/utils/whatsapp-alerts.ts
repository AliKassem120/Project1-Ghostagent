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
export async function triggerManagerAlert(
    ownerWhatsApp: string,
    senderUsername: string,
    triggeredKeyword: string,
    platform: string = 'instagram'
): Promise<void> {
    const systemToken = process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN;
    const fromPhoneId = process.env.WHATSAPP_FROM_PHONE_NUMBER_ID;

    if (!systemToken || !fromPhoneId) {
        console.warn('⚠️ Manager Alert skipped: WHATSAPP_SYSTEM_ACCESS_TOKEN or WHATSAPP_FROM_PHONE_NUMBER_ID not set.');
        return;
    }

    // Normalise: strip spaces, ensure + prefix
    const to = ownerWhatsApp.replace(/\s+/g, '').replace(/^00/, '+');

    const alertMessage = `🚨 *Ghost Agent Alert*\n\nA customer on ${platform} (*${senderUsername}*) triggered the keyword: _"${triggeredKeyword}"_\n\nThey may be requesting human assistance. Please check your DMs promptly.`;

    try {
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

        if (!response.ok) {
            const err = await response.text();
            console.error(`❌ Manager Alert failed (${response.status}):`, err);
        } else {
            console.log(`✅ Manager Alert sent to ${to} for customer: ${senderUsername}`);
        }
    } catch (err) {
        console.error('❌ Manager Alert network error:', err);
    }
}
