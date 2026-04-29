/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Reply Templates
 * ═══════════════════════════════════════════════════════════════
 * All transactional replies come from templates. The LLM may
 * translate or polish, but it never invents the reply.
 *
 * Placeholders: {serviceName}, {dateLabel}, {timeLabel}, etc.
 *
 * TONE RULES:
 * - Sound like a real person texting, not a form or a robot
 * - Keep it short (1-2 sentences max)
 * - Use contractions (I'll, we're, you're, it's)
 * - One emoji max per message — never more
 */

// ── Template Definitions ─────────────────────────────────────

export const APPOINTMENT_TEMPLATES = {
    GREETING: 'Hey 👋 how can I help?',
    ASK_SERVICE: 'What are you looking to get done?',
    ASK_DATE_TIME: 'When works for you? Just send a day and time',
    SLOT_AVAILABLE_NEED_DETAILS: '{dateLabel} at {timeLabel} works! Just send me your name and phone number to lock it in',
    NEED_NAME_PHONE: 'I just need your name and phone number to book this for you',
    CONFIRMED: 'You\'re all set — {serviceName} on {dateLabel} at {timeLabel} ✅',
    CLOSED_DAY: 'We\'re closed on {dayLabel} unfortunately — want to pick another day?',
    OUTSIDE_HOURS: 'That\'s outside our hours ({openTime} – {closeTime}). What other time works?',
    BOOKING_ERROR: 'Something went wrong on my end — can you try again in a sec?',
    UNCLEAR: 'Not sure I got that — what are you looking to book?',
    REJECTION_ACK: 'No worries! Let me know if you need anything',
    SERVICE_LIST: 'We offer: {serviceList}',
    SERVICE_PRICE: '{serviceName} is {price}',
    BUSINESS_HOURS: 'We\'re open {hoursSummary}',
    LOCATION: 'We\'re at {location}',
    GRATITUDE: 'Anytime! 🙏',
    CANCEL_CONFIRM: 'Want me to cancel your {serviceName} on {dateLabel} at {timeLabel}?',
    CANCEL_SUCCESS: 'Done — your appointment\'s been cancelled, no worries',
    CANCEL_NOT_FOUND: 'I don\'t see any upcoming appointments to cancel. Anything else I can help with?',
} as const;

export const ECOMMERCE_TEMPLATES = {
    GREETING: 'Hey 👋 what are you looking for?',
    ASK_PRODUCT: 'Which product caught your eye?',
    ASK_VARIANT: 'What size and color do you want?',
    PRODUCT_AVAILABLE: 'Yeah {variantLabel} is in stock — {priceInfo}',
    PRODUCT_UNAVAILABLE: '{variantLabel} is sold out right now. {alternatives}',
    NEED_ORDER_DETAILS: 'Just send me your name, phone, and delivery address and I\'ll get this sorted for you',
    NEED_ADDRESS: 'Where should I send it? Drop your delivery address',
    ORDER_CONFIRMED: 'You\'re all set — order confirmed ✅',
    ORDER_ERROR: 'Something went wrong on my end — try again in a sec?',
    UNCLEAR: 'Which product are you asking about?',
    REJECTION_ACK: 'No worries! Let me know if you need anything',
    PRODUCT_PRICE: '{productName} is {price}',
    SHIPPING_INFO: '{shippingRules}',
    LOCATION: 'We\'re at {location}',
    GRATITUDE: 'Anytime! 🙏',
    CANCEL_CONFIRM: 'Want me to cancel your order for {itemName}?',
    CANCEL_SUCCESS: 'Done — your order\'s been cancelled',
    CANCEL_NOT_FOUND: 'I don\'t see a pending order to cancel',
} as const;

// ── Safe Fallback Reply ──────────────────────────────────────

export const SAFE_FALLBACK = "Something went wrong on my end — try again in a sec?";

// ── Template Application ─────────────────────────────────────

export function applyTemplate(
    template: string,
    data: Record<string, string | number | undefined | null>
): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        const placeholder = `{${key}}`;
        result = result.replaceAll(placeholder, value != null ? String(value) : '');
    }
    // Clean up any remaining unfilled placeholders
    result = result.replace(/\{[a-zA-Z_]+\}/g, '').replace(/\s{2,}/g, ' ').trim();
    return result;
}
