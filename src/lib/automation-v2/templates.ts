/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Response Templates
 * ═══════════════════════════════════════════════════════════════
 * Pre-built multilingual responses for deterministic flows.
 * Templates replace ~70% of LLM calls with instant, predictable replies.
 *
 * Strategy: Ship templates first, iterate later.
 * Variable interpolation: {{productName}}, {{price}}, {{missing}}, etc.
 *
 * Supports: English, Arabic (formal), Arabizi (Franco-Arabic)
 */

// ── Template Entry ──────────────────────────────────────────

interface TemplateEntry {
    en: string;
    ar: string;          // Arabizi / Franco-Arabic
    arFormal?: string;   // Formal Arabic (optional)
}

type TemplateKey = keyof typeof TEMPLATES;

// ── Language Resolution ─────────────────────────────────────

function isArabiziLang(lang: string): boolean {
    return lang === 'arabizi' || lang === 'lebanese franco' || lang === 'arabic' || lang === 'mixed';
}

// ── Template Coverage Accumulators ───────────────────────────

const templateCoverage: Record<string, number> = {};

export function recordTemplateUsage(key: string): void {
    templateCoverage[key] = (templateCoverage[key] || 0) + 1;
}

export function getTemplateCoverage(): Record<string, number> {
    return { ...templateCoverage };
}

export function resetTemplateCoverage(): void {
    for (const key of Object.keys(templateCoverage)) {
        delete templateCoverage[key];
    }
}

// ── Get Template ────────────────────────────────────────────

/**
 * Get a pre-built response for the given key and language.
 * Performs variable interpolation: {{varName}} → value.
 *
 * @returns The rendered template string, or null if template not found.
 */
export function getTemplate(
    key: string,
    lang: string,
    vars?: Record<string, string | number | undefined>
): string | null {
    const template = TEMPLATES[key as TemplateKey];
    if (!template) return null;

    recordTemplateUsage(key);

    let text: string = isArabiziLang(lang) ? template.ar : template.en;

    // Variable interpolation
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v ?? ''));
        }
    }

    return text;
}

/**
 * Try template first, fall back to a custom string.
 * Use this in FSM handlers to prefer templates over inline t() calls.
 */
export function templateOr(
    key: string,
    lang: string,
    fallbackEn: string,
    fallbackAr: string,
    vars?: Record<string, string | number | undefined>
): string {
    const tpl = getTemplate(key, lang, vars);
    if (tpl) return tpl;
    return isArabiziLang(lang) ? fallbackAr : fallbackEn;
}

// ── Template Registry ────────────────────────────────────────
// Organized by category. Variables: {{productName}}, {{price}},
// {{quantity}}, {{total}}, {{missing}}, {{serviceName}},
// {{date}}, {{time}}, {{status}}, {{names}}, {{listing}},
// {{location}}, {{hours}}, {{shippingRules}}

const TEMPLATES = {
    // ─── Greetings ───────────────────────────────────────────
    greeting: {
        en: 'Hey! How can I help? 👋',
        ar: 'Hala! Kif fiyi se3dak? 👋',
    },
    greeting_fresh: {
        en: 'Hey! How can I help?',
        ar: 'Hala! Kif fiyi se3dak?',
    },

    // ─── General ─────────────────────────────────────────────
    cancel_ack: {
        en: 'No problem. Let me know if you need anything.',
        ar: 'Wala yhemak. Khaberne eza bdk shi.',
    },
    error_generic: {
        en: "I'm having a temporary issue. Could you repeat that in a moment?",
        ar: 'Fi moshkle mo2aqate. Fik t3id ba3d shway?',
    },
    error_start_over: {
        en: "Something went wrong. Let's start over.",
        ar: 'Fi 8alat. Yalla mn el awal.',
    },
    correction: {
        en: 'Sorry about that! What did you need?',
        ar: 'Be3tezer! Shu bdk?',
    },
    frustration_stop: {
        en: "Sorry about that. I won't bother you. If you need anything, just message us.",
        ar: 'Be3tezer. Ma b3ajzak. Eza bdk shi, rase.',
    },
    how_can_help: {
        en: 'How can I help you?',
        ar: 'Kif fiyi se3dak?',
    },

    // ─── Loop Detection / Menu ───────────────────────────────
    loop_menu_ecommerce: {
        en: "Let's start fresh! What would you like to do?\n1. Browse products\n2. Track my order\n3. Talk to a human",
        ar: "Yalla mn el awal! Shu baddak ta3mel?\n1. Dawwar 3a products\n2. Track order\n3. Haki ma3 beshar",
    },
    loop_menu_appointments: {
        en: "Let's start fresh! What would you like to do?\n1. Book an appointment\n2. Check my appointment\n3. Talk to a human",
        ar: "Yalla mn el awal! Shu baddak ta3mel?\n1. E7jez maw3ed\n2. Check maw3ede\n3. Haki ma3 beshar",
    },

    // ─── E-Commerce: Product ─────────────────────────────────
    product_not_found: {
        en: 'That product is not available.',
        ar: 'Ma fi hal product.',
    },
    product_out_of_stock: {
        en: '{{productName}} is out of stock.',
        ar: '{{productName}} — ma fi halla2.',
    },
    product_ask_which: {
        en: 'We have: {{names}}. Which one?',
        ar: '3anna: {{names}}. Aya wahad?',
    },
    product_found_in_stock: {
        en: '{{productName}} — ${{price}}, in stock. Send your {{missing}}.',
        ar: '{{productName}} — ${{price}}, mawjoud. B3atle {{missing}}.',
    },
    product_confirm: {
        en: '{{productName}} — ${{price}}. Confirm order?',
        ar: '{{productName}} — ${{price}}. T2akked el order?',
    },
    product_available_want: {
        en: 'Yes, {{productName}} is available — ${{price}}. Want one?',
        ar: 'Eh, {{productName}} mawjoud — ${{price}}. Badak wa7ad?',
    },
    product_not_available: {
        en: '{{productName}} is currently out of stock.',
        ar: '{{productName}} msh mawjoud halla2.',
    },
    product_price: {
        en: '{{productName}} — ${{price}}',
        ar: '{{productName}} — ${{price}}',
    },
    product_not_found_suggest: {
        en: 'I couldn\'t find "{{candidate}}". We do have:\n{{listing}}',
        ar: 'Ma l2et "{{candidate}}". Bas 3anna:\n{{listing}}',
    },
    product_catalog: {
        en: "Here's what we have:\n{{listing}}",
        ar: '3anna:\n{{listing}}',
    },
    product_prices: {
        en: 'Here are our prices:\n{{listing}}',
        ar: 'Tfaddal el as3ar:\n{{listing}}',
    },
    no_products: {
        en: 'No products available right now.',
        ar: 'Ma fi shi mawjoud halla2.',
    },
    price_which: {
        en: 'Which product are you asking about?',
        ar: 'Aya product bdk t3rif se3ro?',
    },

    // ─── E-Commerce: Order Details ───────────────────────────
    ask_details: {
        en: 'I need your {{missing}} to place the order.',
        ar: 'B3atle {{missing}} la n2akked el order.',
    },
    still_need: {
        en: 'I still need your {{missing}}.',
        ar: 'Bado {{missing}}.',
    },
    ask_variant: {
        en: 'Got it. Send your name, phone, and delivery address.',
        ar: 'Tmm. B3atle ismak, ra2mak w el 3nwen.',
    },
    already_sent_partial: {
        en: 'I have some of your info. I still need your {{missing}}.',
        ar: '3ande ba3do. Bado {{missing}}.',
    },
    already_sent_none: {
        en: "I couldn't find your info above. I need your name, phone, and delivery address to place the order.",
        ar: 'Ma l2iton abel. B3atle ismak, ra2mak w el 3nwen la n2akked el order.',
    },

    // ─── E-Commerce: Checkout ────────────────────────────────
    order_summary: {
        en: '{{productName}} x{{quantity}} — ${{total}}. Confirm?',
        ar: '{{productName}} x{{quantity}} — ${{total}}. T2akked?',
    },
    order_confirmed: {
        en: 'Order confirmed! ✅',
        ar: 'Tmm order-ak t2akkad! ✅',
    },
    order_failed: {
        en: 'Something went wrong. Please try again.',
        ar: 'Fi 8alat. Jarreb kamen.',
    },
    order_duplicate: {
        en: 'I already have this order.',
        ar: 'Hal order mawjoud already.',
    },
    checkout_confirm_again: {
        en: 'Would you like to confirm the order?',
        ar: 'Badek t2akked el order?',
    },
    stock_depleted: {
        en: 'Sorry, {{productName}} just sold out! 😔',
        ar: 'Sorry, {{productName}} kheles halla2! 😔',
    },

    // ─── E-Commerce: Order Status ────────────────────────────
    order_status: {
        en: 'Your order ({{productName}}): {{status}}',
        ar: 'Order-ak ({{productName}}): {{status}}',
    },
    order_status_cancelled: {
        en: 'Your order status is Cancelled.',
        ar: 'Status el order: Cancelled.',
    },
    order_status_pending_cancel: {
        en: "Not yet — it's still pending. Want me to cancel it?",
        ar: 'La2 ba3do pending. Badak el8e?',
    },
    no_recent_order: {
        en: "I can't find a recent order.",
        ar: 'Ma l2et order 2arib.',
    },

    // ─── Cancel ──────────────────────────────────────────────
    order_cancelled: {
        en: 'Order cancelled.',
        ar: 'Tamem, el order tenla8a.',
    },
    order_cancelled_multi: {
        en: '{{count}} orders cancelled.',
        ar: '{{count}} orders tenla8o.',
    },
    order_already_cancelled: {
        en: 'Order is already cancelled.',
        ar: 'El order already tenla8a.',
    },
    order_not_cancellable: {
        en: "I can't cancel it because of its status.",
        ar: 'Ma fiyye el8e 7asab el status.',
    },
    cancel_no_order: {
        en: "I can't find a recent order.",
        ar: 'Ma l2et order 2arib.',
    },
    appointment_cancelled: {
        en: 'Appointment cancelled.',
        ar: 'Tamem, el maw3ed tenla8a.',
    },
    appointment_cancelled_multi: {
        en: '{{count}} appointments cancelled.',
        ar: '{{count}} mwa3id tenla8o.',
    },
    appointment_already_cancelled: {
        en: 'Appointment is already cancelled.',
        ar: 'El maw3ed already tenla8a.',
    },
    cancel_no_appointment: {
        en: "I can't find a recent appointment.",
        ar: 'Ma l2et maw3ed 2arib.',
    },

    // ─── Appointments: Service ───────────────────────────────
    ask_service: {
        en: 'Which service would you like? We offer: {{names}}',
        ar: 'Aya service bdk? 3anna: {{names}}',
    },
    service_found_ask_time: {
        en: '{{serviceName}} — ${{price}}. What day and time work for you?',
        ar: '{{serviceName}} — ${{price}}. Aya yom w se3a badek?',
    },
    service_info: {
        en: '{{serviceName}} — ${{price}} ({{duration}}min). Want to book?',
        ar: '{{serviceName}} — ${{price}} ({{duration}}d2i2a). Badak te7joz?',
    },
    service_listing: {
        en: 'Here are our services:\n{{listing}}',
        ar: '3anna:\n{{listing}}',
    },
    service_prices: {
        en: 'Here are our prices:\n{{listing}}',
        ar: 'Tfaddal el as3ar:\n{{listing}}',
    },
    no_services: {
        en: 'No services available right now.',
        ar: 'Ma fi khedamet halla2.',
    },

    // ─── Appointments: Date/Time ─────────────────────────────
    ask_date: {
        en: 'What day would you like?',
        ar: 'Aya yom badek?',
    },
    ask_time: {
        en: 'What time on {{date}}?',
        ar: 'Aya se3a {{date}}?',
    },
    slot_available_ask_details: {
        en: '{{date}} at {{time}} is available. Send your name and phone number.',
        ar: '{{date}} se3a {{time}} fi majel. B3atle ismak w ra2mak.',
    },
    slot_unavailable: {
        en: '{{date}} at {{time}} is not available. Another time?',
        ar: '{{date}} se3a {{time}} ma fi majel. Wa2t tene?',
    },
    slot_taken: {
        en: 'That slot is taken. Do you have another time?',
        ar: 'Hal wa2et msh fadi. Fi wa2t tene?',
    },
    closed_day: {
        en: "We're closed on {{day}}. Pick another day?",
        ar: 'Msakrin yom el {{day}}. Fi yom tene?',
    },
    outside_hours: {
        en: "That's outside our hours ({{hours}}). Another time?",
        ar: 'Hal wa2et barra dawemna ({{hours}}). Badek gheiro?',
    },
    slot_taken_at_confirm: {
        en: 'Sorry, that slot just got taken. Pick another time?',
        ar: 'Sorry, hal wa2et sar msh fadi. Wa2t tene?',
    },

    // ─── Appointments: Customer Details ──────────────────────
    ask_name_phone: {
        en: 'I need your name and phone number to book.',
        ar: 'B3atle ismak w ra2mak la 2akked el 7ajez.',
    },
    still_need_appt: {
        en: 'I still need your {{missing}}.',
        ar: 'Bado {{missing}}.',
    },
    already_sent_partial_appt: {
        en: 'I have some of your info. I still need your {{missing}}.',
        ar: '3ande ba3do. Bado {{missing}}.',
    },
    already_sent_none_appt: {
        en: "I couldn't find your info above. I need your name and phone number to book.",
        ar: 'Ma l2iton abel. B3atle ismak w ra2mak la 2akked el 7ajez.',
    },

    // ─── Appointments: Confirmation ──────────────────────────
    booking_confirm: {
        en: '{{serviceName}} on {{date}} at {{time}}. Confirm?',
        ar: '{{serviceName}} {{date}} se3a {{time}}. T2akked?',
    },
    booking_confirmed: {
        en: 'Done! {{serviceName}} confirmed for {{date}} at {{time}}. ✅',
        ar: 'Tmm! {{serviceName}} t2akkad {{date}} se3a {{time}}. ✅',
    },
    booking_failed: {
        en: 'Something went wrong. Please try again.',
        ar: 'Fi 8alat. Jarreb kamen.',
    },
    booking_duplicate: {
        en: 'I already have this appointment.',
        ar: 'Hal maw3ed mawjoud already.',
    },
    booking_confirm_again: {
        en: 'Would you like to confirm the booking?',
        ar: 'Badek t2akked el 7ajez?',
    },
    booking_rejected: {
        en: 'No problem. Let me know if you need anything.',
        ar: 'Wala yhemak. Khaberne eza bdk shi.',
    },
    appointment_status: {
        en: 'Your appointment status is: {{status}}.',
        ar: 'Status el maw3ed: {{status}}.',
    },
    appointment_status_cancelled: {
        en: 'Your appointment status is Cancelled.',
        ar: 'Status el maw3ed: Cancelled.',
    },
    appointment_status_active: {
        en: "Not yet — it's still active. Want me to cancel it?",
        ar: 'La2 ba3do mawjoud. Badak el8e?',
    },
    no_recent_appointment: {
        en: "I can't find an upcoming appointment.",
        ar: 'Ma l2et maw3ed 2arib.',
    },

    // ─── Business Info ───────────────────────────────────────
    business_hours: {
        en: 'Our hours:\n{{hours}}',
        ar: 'Dawemna:\n{{hours}}',
    },
    location: {
        en: "We're at: {{location}}",
        ar: 'Ma7alna: {{location}}',
    },
    shipping_rules: {
        en: '{{shippingRules}}',
        ar: '{{shippingRules}}',
    },

    // ─── Post-Context ────────────────────────────────────────
    modify_expired: {
        en: 'This order can no longer be modified. Contact us for help.',
        ar: 'Hal order ma fi n3adlo halla2. Tewasal ma3na la nse3dak.',
    },
    modify_ask: {
        en: 'What would you like to change it to?',
        ar: 'La shu badek t8ayra?',
    },
    modify_success: {
        en: 'Updated to "{{value}}" ✅',
        ar: 'T8ayaret la "{{value}}" ✅',
    },
    reschedule_expired: {
        en: 'Too late to reschedule. Contact us for help.',
        ar: 'Faat el wa2et la n8ayer el maw3ed. Tewasal ma3na.',
    },
    reschedule_ask: {
        en: 'What day and time would you like instead?',
        ar: 'Aya yom w se3a badek?',
    },
    accept_offer_ask_details: {
        en: 'Send your name, phone number, and delivery address.',
        ar: 'B3atle ismak, ra2mak w el 3nwen.',
    },
    accept_offer_ask_time: {
        en: 'What day and time works for you?',
        ar: 'Aya yom w se3a byna7sebak?',
    },

    // ─── Repeat Order ────────────────────────────────────────
    repeat_no_context: {
        en: "I don't have a recent order to repeat. What would you like to order?",
        ar: 'Ma fi order 2arib la3ido. Shu baddak tetlob?',
    },
    repeat_ask_details: {
        en: '{{productName}} x1 — ${{price}}. I need your {{missing}}.',
        ar: '{{productName}} x1 — ${{price}}. B3atle {{missing}}.',
    },
    repeat_confirm: {
        en: '{{productName}} x1 — ${{price}}. Confirm?',
        ar: '{{productName}} x1 — ${{price}}. Akid?',
    },

    // ─── Handoff ─────────────────────────────────────────────
    handoff_created: {
        en: "I've escalated this to a human agent. They'll be with you shortly.",
        ar: '7awwaltak la agent beshari. Rah yetwasal ma3ak arib.',
    },

    // ─── Rate Limiting ───────────────────────────────────────
    rate_limit_burst: {
        en: "You're sending messages too fast. Please wait a moment.",
        ar: 'Inta m3ajjal ktir. Stanna shway.',
    },
    rate_limit_duplicate: {
        en: "I've already received this message. How can I help?",
        ar: 'Wasaltne hal message. Kif fiyi se3dak?',
    },
} as const;

// ── Export template keys for testing ─────────────────────────

export type { TemplateKey };
export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[];
