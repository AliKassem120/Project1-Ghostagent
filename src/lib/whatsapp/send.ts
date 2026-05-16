/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — WhatsApp Cloud API Messaging
 * ═══════════════════════════════════════════════════════════════
 * Core utility for sending all types of WhatsApp messages:
 * text, template, interactive (buttons, lists, products), flows.
 */

const WA_API = 'https://graph.facebook.com/v21.0';

export interface WhatsAppCredentials {
    phoneNumberId: string;
    accessToken: string;
}

// ── Raw Send ─────────────────────────────────────────────────

async function sendRaw(creds: WhatsAppCredentials, payload: Record<string, any>) {
    const res = await fetch(`${WA_API}/${creds.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${creds.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    });
    const data = await res.json();
    if (!res.ok) {
        console.error('❌ [WhatsApp] Send failed:', JSON.stringify(data));
        return { success: false, error: data.error?.message || 'Unknown error' };
    }
    return { success: true, messageId: data.messages?.[0]?.id };
}

// ── Text Message ─────────────────────────────────────────────

export async function sendText(creds: WhatsAppCredentials, to: string, text: string) {
    return sendRaw(creds, {
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
    });
}

// ── Template Message ─────────────────────────────────────────

export interface TemplateComponent {
    type: 'header' | 'body' | 'button';
    sub_type?: 'url' | 'quick_reply';
    index?: number;
    parameters: { type: string; text?: string; image?: { link: string } }[];
}

export async function sendTemplate(
    creds: WhatsAppCredentials,
    to: string,
    templateName: string,
    languageCode: string = 'en',
    components?: TemplateComponent[]
) {
    const template: any = {
        name: templateName,
        language: { code: languageCode },
    };
    if (components && components.length > 0) {
        template.components = components;
    }
    return sendRaw(creds, {
        recipient_type: 'individual',
        to,
        type: 'template',
        template,
    });
}

// ── Interactive: Buttons ─────────────────────────────────────

export interface ButtonAction {
    id: string;
    title: string; // max 20 chars
}

export async function sendButtons(
    creds: WhatsAppCredentials,
    to: string,
    body: string,
    buttons: ButtonAction[],
    header?: string,
    footer?: string
) {
    const interactive: any = {
        type: 'button',
        body: { text: body },
        action: {
            buttons: buttons.map(b => ({
                type: 'reply',
                reply: { id: b.id, title: b.title },
            })),
        },
    };
    if (header) interactive.header = { type: 'text', text: header };
    if (footer) interactive.footer = { text: footer };

    return sendRaw(creds, {
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive,
    });
}

// ── Interactive: List Message ────────────────────────────────

export interface ListSection {
    title: string;
    rows: { id: string; title: string; description?: string }[];
}

export async function sendList(
    creds: WhatsAppCredentials,
    to: string,
    body: string,
    buttonText: string,
    sections: ListSection[],
    header?: string,
    footer?: string
) {
    const interactive: any = {
        type: 'list',
        body: { text: body },
        action: {
            button: buttonText,
            sections,
        },
    };
    if (header) interactive.header = { type: 'text', text: header };
    if (footer) interactive.footer = { text: footer };

    return sendRaw(creds, {
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive,
    });
}

// ── Interactive: CTA URL Button ──────────────────────────────

export async function sendCTAButton(
    creds: WhatsAppCredentials,
    to: string,
    body: string,
    buttonText: string,
    url: string,
    header?: string,
    footer?: string
) {
    const interactive: any = {
        type: 'cta_url',
        body: { text: body },
        action: {
            name: 'cta_url',
            parameters: {
                display_text: buttonText,
                url,
            },
        },
    };
    if (header) interactive.header = { type: 'text', text: header };
    if (footer) interactive.footer = { text: footer };

    return sendRaw(creds, {
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive,
    });
}

// ── Interactive: Product Message (requires catalog) ──────────

export async function sendProductCard(
    creds: WhatsAppCredentials,
    to: string,
    catalogId: string,
    productRetailerId: string,
    body?: string,
    footer?: string
) {
    const interactive: any = {
        type: 'product',
        body: body ? { text: body } : undefined,
        footer: footer ? { text: footer } : undefined,
        action: {
            catalog_id: catalogId,
            product_retailer_id: productRetailerId,
        },
    };

    return sendRaw(creds, {
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive,
    });
}

// ── Interactive: Multi-Product Message ───────────────────────

export interface ProductSection {
    title: string;
    product_items: { product_retailer_id: string }[];
}

export async function sendProductList(
    creds: WhatsAppCredentials,
    to: string,
    catalogId: string,
    header: string,
    body: string,
    sections: ProductSection[],
    footer?: string
) {
    const interactive: any = {
        type: 'product_list',
        header: { type: 'text', text: header },
        body: { text: body },
        footer: footer ? { text: footer } : undefined,
        action: {
            catalog_id: catalogId,
            sections,
        },
    };

    return sendRaw(creds, {
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive,
    });
}

// ── WhatsApp Flow Message ────────────────────────────────────

export async function sendFlow(
    creds: WhatsAppCredentials,
    to: string,
    flowId: string,
    flowToken: string,
    body: string,
    ctaText: string = 'Open',
    screenId?: string,
    flowData?: Record<string, any>,
    header?: string,
    footer?: string
) {
    const interactive: any = {
        type: 'flow',
        body: { text: body },
        action: {
            name: 'flow',
            parameters: {
                flow_message_version: '3',
                flow_id: flowId,
                flow_token: flowToken,
                flow_cta: ctaText,
                mode: 'published',
                ...(screenId ? { flow_action: 'navigate', flow_action_payload: { screen: screenId, data: flowData || {} } } : {}),
            },
        },
    };
    if (header) interactive.header = { type: 'text', text: header };
    if (footer) interactive.footer = { text: footer };

    return sendRaw(creds, {
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive,
    });
}
