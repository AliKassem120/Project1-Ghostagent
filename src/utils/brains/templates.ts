export const APPOINTMENT_TEMPLATES = {
    GREETING: "Hey 👋 how can I help?",
    ASK_SERVICE: "What service would you like to book?",
    ASK_DATE_TIME: "Sure — what day and time would you like?",
    SLOT_AVAILABLE_NEED_DETAILS: "{dateLabel} at {timeLabel} is available. Send your name and phone number to confirm.",
    NEED_NAME: "Send your name to confirm.",
    NEED_PHONE: "Send your phone number to confirm.",
    NEED_NAME_AND_PHONE: "Send your name and phone number to confirm.",
    CONFIRMED: "Perfect — your {serviceName} is confirmed for {dateLabel} at {timeLabel}.",
    CLOSED_DAY: "We're closed on {dayLabel}.",
    OUTSIDE_HOURS: "We close at {closeTime}, so that time won't work. I can offer {suggestedTime} if available.",
    BUSINESS_HOURS_GENERAL: "We're open {summary}.",
    NO_AVAILABILITY: "That time isn't available. I can offer {slotOptions}.",
    BOOKING_ERROR: "I'm having trouble confirming the appointment right now. Please try again in a moment.",
    REJECTION_ACK: "No problem. Let me know if you change your mind or need anything else."
};

export const ECOM_TEMPLATES = {
    GREETING: "Hey 👋 what are you looking for?",
    ASK_PRODUCT_VARIANT: "What size and color do you want?",
    PRODUCT_AVAILABLE: "Yes, {productName} in {variantLabel} is available.",
    PRODUCT_UNAVAILABLE: "{variantLabel} is sold out, but {availableOptions} are available.",
    NEED_ORDER_DETAILS: "Send your name, phone number, and delivery address to place the order.",
    ORDER_CONFIRMED: "Perfect — your order is confirmed.",
    CHECKOUT_LINK_READY: "Here's your checkout link: {checkoutUrl}",
    ORDER_ERROR: "I'm having trouble creating the order right now. Please try again in a moment.",
    HUMAN_HANDOFF: "I'll pass this to the team so they can help.",
};

export const FORBIDDEN_PHRASES = [
    "How can I assist you today",
    "Can you please give me a moment",
    "I'm checking",
    "At our Beirut hamra location",
    "Would you like me to suggest some options",
    "You can also contact us",
    "Further assistance",
    "I have checked",
    "Kindly provide"
];

export function applyTemplate(template: string, data: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        result = result.replace(new RegExp(`{${key}}`, 'g'), String(value));
    }
    return result;
}
