export const APPOINTMENT_REPLY_TEMPLATES = {
  GREETING: 'Hey 👋 how can I help?',
  ASK_SERVICE: 'What service would you like to book?',
  ASK_DATE_TIME: 'Sure — what day and time would you like?',
  SLOT_AVAILABLE_NEED_DETAILS: '{dateLabel} at {timeLabel} is available. Send your name and phone number to confirm.',
  NEED_NAME_PHONE: 'Send your name and phone number to confirm.',
  CONFIRMED: 'Perfect — your {serviceName} is confirmed for {dateLabel} at {timeLabel}.',
  CLOSED_DAY: "We're closed on {dayLabel}.",
  OUTSIDE_HOURS: 'That time is outside working hours. I can offer {suggestedTime} if available.',
  BOOKING_ERROR: "I'm having trouble confirming the appointment right now. Please try again in a moment.",
  UNCLEAR: 'Sorry, what would you like to book?',
} as const;

export const ECOMMERCE_REPLY_TEMPLATES = {
  GREETING: 'Hey 👋 what are you looking for?',
  ASK_PRODUCT: 'Which product do you want?',
  ASK_VARIANT: 'What size and color do you want?',
  PRODUCT_AVAILABLE: 'Yes, {variantLabel} is available.',
  PRODUCT_UNAVAILABLE: '{variantLabel} is sold out, but {availableOptions} are available.',
  NEED_ORDER_DETAILS: 'Send your name, phone number, and delivery address to place the order.',
  NEED_ADDRESS: 'Send your delivery address to place the order.',
  ORDER_CONFIRMED: 'Perfect — your order is confirmed.',
  CHECKOUT_LINK_READY: "Here’s your checkout link: {checkoutUrl}",
  ORDER_ERROR: "I'm having trouble creating the order right now. Please try again in a moment.",
  UNCLEAR: 'Sorry, which product do you want?',
} as const;

export function applyTemplate(template: string, values: Record<string, string | number | null | undefined>) {
  return Object.entries(values).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v ?? '')), template);
}
