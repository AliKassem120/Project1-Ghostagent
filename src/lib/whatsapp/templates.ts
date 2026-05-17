/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — WhatsApp Template Management
 * ═══════════════════════════════════════════════════════════════
 * Auto-creates and manages WhatsApp message templates via the
 * WhatsApp Business Management API.
 * 
 * Templates are pre-approved message formats required by Meta
 * for business-initiated (outbound) notifications.
 */

const WA_API = 'https://graph.facebook.com/v21.0';

// ── Template Definitions ─────────────────────────────────────

export const GHOSTAGENT_TEMPLATES = {
    order_shipped: {
        name: 'ghostagent_order_shipped',
        category: 'UTILITY',
        language: 'en',
        components: [
            {
                type: 'BODY',
                text: '📦 Your order *{{1}}* has been shipped! You can expect delivery soon.\n\nTracking: {{2}}\n\nThank you for shopping with us! 🙏',
                example: { body_text: [['Red Nike Air Max x1', 'https://track.example.com/123']] },
            },
        ],
    },
    order_delivered: {
        name: 'ghostagent_order_delivered',
        category: 'UTILITY',
        language: 'en',
        components: [
            {
                type: 'BODY',
                text: '✅ Your order *{{1}}* has been delivered!\n\nWe hope you love it. If you have any questions, just reply to this message.\n\nThank you! 💜',
                example: { body_text: [['Red Nike Air Max x1']] },
            },
        ],
    },
    review_request: {
        name: 'ghostagent_review_request',
        category: 'MARKETING',
        language: 'en',
        components: [
            {
                type: 'BODY',
                text: 'Hey {{1}}! 👋\n\nHow was your experience with *{{2}}*? We\'d love to hear your feedback!\n\nJust reply with a quick review — it really helps us improve. ⭐',
                example: { body_text: [['Ali', 'Red Nike Air Max']] },
            },
        ],
    },
    appointment_reminder: {
        name: 'ghostagent_appointment_reminder',
        category: 'UTILITY',
        language: 'en',
        components: [
            {
                type: 'BODY',
                text: '📅 Reminder: You have a *{{1}}* appointment tomorrow at *{{2}}*.\n\nNeed to reschedule? Just reply to this message.\n\nSee you soon! 😊',
                example: { body_text: [['Haircut', '3:00 PM']] },
            },
        ],
    },
    appointment_confirmed: {
        name: 'ghostagent_appointment_confirmed',
        category: 'UTILITY',
        language: 'en',
        components: [
            {
                type: 'BODY',
                text: '✅ Your *{{1}}* appointment is confirmed!\n\n📅 Date: {{2}}\n🕐 Time: {{3}}\n💰 Price: ${{4}}\n\nSee you there! 🙌',
                example: { body_text: [['Haircut', '2026-01-15', '3:00 PM', '25']] },
            },
        ],
    },
    promotional_blast: {
        name: 'ghostagent_promotional_blast',
        category: 'MARKETING',
        language: 'en',
        components: [
            {
                type: 'HEADER',
                format: 'TEXT',
                text: 'Exclusive Offer',
            },
            {
                type: 'BODY',
                text: 'Hey! 👋\n\n{{1}}\n\nReply to this message if you have any questions or want to claim this offer! 👻',
                example: { body_text: [['We are running a 20% sale on all vintage jackets this weekend only!']] },
            },
            {
                type: 'FOOTER',
                text: 'Powered by GhostAgent',
            },
        ],
    },
} as const;

// ── Create Template via API ──────────────────────────────────

export async function createTemplate(
    whatsappBusinessAccountId: string,
    accessToken: string,
    template: {
        name: string;
        category: string;
        language: string;
        components: any[];
    }
) {
    const res = await fetch(`${WA_API}/${whatsappBusinessAccountId}/message_templates`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: template.name,
            category: template.category,
            language: template.language,
            components: template.components,
        }),
    });

    const data = await res.json();

    if (!res.ok) {
        // Template might already exist — that's fine
        if (data.error?.code === 2388023 || data.error?.message?.includes('already exists')) {
            console.log(`ℹ️ [Templates] Template "${template.name}" already exists. Skipping.`);
            return { success: true, alreadyExists: true };
        }
        console.error(`❌ [Templates] Failed to create "${template.name}":`, data.error);
        return { success: false, error: data.error?.message };
    }

    console.log(`✅ [Templates] Created "${template.name}" (ID: ${data.id})`);
    return { success: true, templateId: data.id };
}

// ── Provision All Templates for a Workspace ──────────────────

export async function provisionAllTemplates(
    whatsappBusinessAccountId: string,
    accessToken: string
) {
    const results: Record<string, any> = {};

    for (const [key, template] of Object.entries(GHOSTAGENT_TEMPLATES)) {
        results[key] = await createTemplate(whatsappBusinessAccountId, accessToken, { ...template, components: [...template.components] });
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
    }

    return results;
}

// ── Check Which Templates Exist ──────────────────────────────

export async function listExistingTemplates(
    whatsappBusinessAccountId: string,
    accessToken: string
) {
    const res = await fetch(
        `${WA_API}/${whatsappBusinessAccountId}/message_templates?limit=100`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    if (!res.ok) return [];
    return (data.data || []).map((t: any) => ({
        name: t.name,
        status: t.status,
        category: t.category,
        id: t.id,
    }));
}
