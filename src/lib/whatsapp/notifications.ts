/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Post-Purchase WhatsApp Notifications
 * ═══════════════════════════════════════════════════════════════
 * Sends automated WhatsApp notifications when order/appointment
 * status changes. Uses pre-approved template messages.
 */

import { sendTemplate, type WhatsAppCredentials, type TemplateComponent } from './send';

// ── Helper: Get WA credentials for a workspace ───────────────

export async function getWorkspaceWhatsAppCreds(
    supabase: any,
    workspaceId: string
): Promise<WhatsAppCredentials | null> {
    const { data: ws } = await supabase
        .from('ai_settings')
        .select('whatsapp_phone_number_id, whatsapp_access_token')
        .eq('id', workspaceId)
        .maybeSingle();

    if (!ws?.whatsapp_phone_number_id || !ws?.whatsapp_access_token) {
        // Fallback to system-level credentials
        const phoneId = process.env.WHATSAPP_FROM_PHONE_NUMBER_ID;
        const token = process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN;
        if (phoneId && token) return { phoneNumberId: phoneId, accessToken: token };
        return null;
    }

    return {
        phoneNumberId: ws.whatsapp_phone_number_id,
        accessToken: ws.whatsapp_access_token,
    };
}

// ── Order Shipped ────────────────────────────────────────────

export async function notifyOrderShipped(
    creds: WhatsAppCredentials,
    customerPhone: string,
    itemDescription: string,
    trackingLink: string = 'No tracking available'
) {
    const components: TemplateComponent[] = [
        {
            type: 'body',
            parameters: [
                { type: 'text', text: itemDescription },
                { type: 'text', text: trackingLink },
            ],
        },
    ];

    return sendTemplate(creds, customerPhone, 'ghostagent_order_shipped', 'en', components);
}

// ── Order Delivered ──────────────────────────────────────────

export async function notifyOrderDelivered(
    creds: WhatsAppCredentials,
    customerPhone: string,
    itemDescription: string
) {
    const components: TemplateComponent[] = [
        {
            type: 'body',
            parameters: [
                { type: 'text', text: itemDescription },
            ],
        },
    ];

    return sendTemplate(creds, customerPhone, 'ghostagent_order_delivered', 'en', components);
}

// ── Review Request (sent X days after delivery) ──────────────

export async function notifyReviewRequest(
    creds: WhatsAppCredentials,
    customerPhone: string,
    customerName: string,
    itemDescription: string
) {
    const components: TemplateComponent[] = [
        {
            type: 'body',
            parameters: [
                { type: 'text', text: customerName },
                { type: 'text', text: itemDescription },
            ],
        },
    ];

    return sendTemplate(creds, customerPhone, 'ghostagent_review_request', 'en', components);
}

// ── Appointment Reminder ─────────────────────────────────────

export async function notifyAppointmentReminder(
    creds: WhatsAppCredentials,
    customerPhone: string,
    serviceName: string,
    time: string
) {
    const components: TemplateComponent[] = [
        {
            type: 'body',
            parameters: [
                { type: 'text', text: serviceName },
                { type: 'text', text: time },
            ],
        },
    ];

    return sendTemplate(creds, customerPhone, 'ghostagent_appointment_reminder', 'en', components);
}

// ── Appointment Confirmed ────────────────────────────────────

export async function notifyAppointmentConfirmed(
    creds: WhatsAppCredentials,
    customerPhone: string,
    serviceName: string,
    date: string,
    time: string,
    price: string
) {
    const components: TemplateComponent[] = [
        {
            type: 'body',
            parameters: [
                { type: 'text', text: serviceName },
                { type: 'text', text: date },
                { type: 'text', text: time },
                { type: 'text', text: price },
            ],
        },
    ];

    return sendTemplate(creds, customerPhone, 'ghostagent_appointment_confirmed', 'en', components);
}
