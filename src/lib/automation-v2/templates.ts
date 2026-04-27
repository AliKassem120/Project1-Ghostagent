/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Reply Templates
 * ═══════════════════════════════════════════════════════════════
 * All transactional replies come from templates. The LLM may
 * translate or polish, but it never invents the reply.
 *
 * Placeholders: {serviceName}, {dateLabel}, {timeLabel}, etc.
 */

// ── Template Definitions ─────────────────────────────────────

export const APPOINTMENT_TEMPLATES = {
    GREETING: 'Hey 👋 how can I help?',
    ASK_SERVICE: 'What service would you like to book?',
    ASK_DATE_TIME: 'Sure — what day and time would you like?',
    SLOT_AVAILABLE_NEED_DETAILS: '{dateLabel} at {timeLabel} is available. Send your name and phone number to confirm.',
    NEED_NAME_PHONE: 'Send your name and phone number to confirm.',
    CONFIRMED: 'Perfect — your {serviceName} is confirmed for {dateLabel} at {timeLabel}. ✅',
    CLOSED_DAY: "We're closed on {dayLabel}.",
    OUTSIDE_HOURS: 'That time is outside working hours ({openTime} – {closeTime}). Want a different time?',
    BOOKING_ERROR: "I'm having trouble confirming the appointment right now. Please try again in a moment.",
    UNCLEAR: 'Sorry, what would you like to book?',
    REJECTION_ACK: 'No problem. Let me know if you need anything else.',
    SERVICE_LIST: 'We offer: {serviceList}.',
    SERVICE_PRICE: '{serviceName} is {price}.',
    BUSINESS_HOURS: "We're open {hoursSummary}.",
    LOCATION: "We're located at {location}.",
    GRATITUDE: "You're welcome! 🙏",
    CANCEL_CONFIRM: "Do you want to cancel the {serviceName} on {dateLabel} at {timeLabel}?",
    CANCEL_SUCCESS: "Got it — your appointment has been cancelled. No problem.",
    CANCEL_NOT_FOUND: "I couldn't find an appointment to cancel. Is there anything else I can help with?",
} as const;

export const ECOMMERCE_TEMPLATES = {
    GREETING: 'Hey 👋 what are you looking for?',
    ASK_PRODUCT: 'Which product are you interested in?',
    ASK_VARIANT: 'What size and color would you like?',
    PRODUCT_AVAILABLE: 'Yes, {variantLabel} is available. {priceInfo}',
    PRODUCT_UNAVAILABLE: '{variantLabel} is sold out. {alternatives}',
    NEED_ORDER_DETAILS: 'Send your name, phone number, and delivery address to place the order.',
    NEED_ADDRESS: 'Send your delivery address to place the order.',
    ORDER_CONFIRMED: 'Perfect — your order is confirmed. ✅',
    ORDER_ERROR: "I'm having trouble creating the order right now. Please try again in a moment.",
    UNCLEAR: 'Sorry, which product are you looking for?',
    REJECTION_ACK: 'No problem. Let me know if you need anything else.',
    PRODUCT_PRICE: '{productName} is {price}.',
    SHIPPING_INFO: '{shippingRules}',
    LOCATION: "We're located at {location}.",
    GRATITUDE: "You're welcome! 🙏",
    CANCEL_CONFIRM: "Do you want to cancel your order for {itemName}?",
    CANCEL_SUCCESS: "Got it — your order has been cancelled.",
    CANCEL_NOT_FOUND: "I couldn't find a pending order to cancel.",
} as const;

// ── Safe Fallback Reply ──────────────────────────────────────

export const SAFE_FALLBACK = "I'm having trouble right now. Please try again in a moment.";

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
