/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Arabizi Dictionary
 * ═══════════════════════════════════════════════════════════════
 * High-quality, manual Lebanese Arabizi translations for all
 * engine templates. This ensures consistency and prevents
 * weird LLM-generated Arabizi.
 */

export const ARABIZI_DICTIONARY: Record<string, string> = {
    // Appointments
    'Hey 👋 how can I help?': 'Ahla 👋 Kif fiyi se3dak?',
    'What service would you like to book?': 'Ayya service badek te7jez?',
    'Sure — what day and time would you like?': 'Akid — ayya yom w se3a badek?',
    '{dateLabel} at {timeLabel} is available. Send your name and phone number to confirm.': '{dateLabel} 3al {timeLabel} feze3. Ba3atle ismak w ra2mak la2akked el 7ajez.',
    'Send your name and phone number to confirm.': 'Ba3atle ismak w ra2mak la2akked el 7ajez.',
    'Perfect — your {serviceName} is confirmed for {dateLabel} at {timeLabel}. ✅': 'Tamem — el {serviceName} t2akkad {dateLabel} 3al {timeLabel}. ✅',
    "We're closed on {dayLabel}.": 'Msekrin yom el {dayLabel}.',
    'That time is outside working hours ({openTime} – {closeTime}). Want a different time?': 'Hal wa2et barra dawemna ({openTime} – {closeTime}). Badek gheiro?',
    "I'm having trouble confirming the appointment right now. Please try again in a moment.": 'Fi meshkle bel 7ajez halla2. Jarreb kamen shway.',
    'Sorry, what would you like to book?': '3afwan, ayya service badek?',
    'No problem. Let me know if you need anything else.': 'Ma fi meshkle. Eza badek shi tene khaberne.',
    'We offer: {serviceList}.': '3anna: {serviceList}.',
    '{serviceName} is {price}.': 'el {serviceName} bi {price}.',
    "We're open {hoursSummary}.": 'Mnefta7: {hoursSummary}.',
    "We're located at {location}.": '3nwen-na: {location}.',
    "You're welcome! 🙏": 'Tekram! 🙏',

    // E-Commerce
    'Hey 👋 what are you looking for?': 'Ahla 👋 Shu 3am baddawer?',
    'Which product are you interested in?': 'Ayya product badek?',
    'What size and color would you like?': 'Ayya size w lawn badek?',
    'Yes, {variantLabel} is available. {priceInfo}': 'Eh, {variantLabel} mawjoud. {priceInfo}',
    '{variantLabel} is sold out. {alternatives}': '{variantLabel} kholsan. {alternatives}',
    'Send your name, phone number, and delivery address to place the order.': 'Ba3atle ismak, ra2mak w el address la n2akked el order.',
    'Send your delivery address to place the order.': 'Ba3atle el address la n2akked el order.',
    'Perfect — your order is confirmed. ✅': 'Tamem — order-ak t2akkad. ✅',
    "I'm having trouble creating the order right now. Please try again in a moment.": 'Fi meshkle bel order halla2. Jarreb kamen shway.',
    'Sorry, which product are you looking for?': '3afwan, ayya product badek?',
    '{productName} is {price}.': 'el {productName} bi {price}.',
    '{shippingRules}': '{shippingRules}',

    // Fallbacks
    "I'm having trouble right now. Please try again in a moment.": 'Fi meshkle halla2. Jarreb kamen shway.'
};
