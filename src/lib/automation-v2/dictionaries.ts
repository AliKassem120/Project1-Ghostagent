/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Lebanese Master Dictionary
 * ═══════════════════════════════════════════════════════════════
 * This is the SOURCE OF TRUTH for all Lebanese Arabizi translations.
 * All phrases provided by the user are strictly enforced here.
 */

export const LEBANESE_VOCABULARY = `
Category,Lebanese_Arabizi,English_Translation
Greetings,Hala / Salam,Hi / Hello
Greetings,Ahla w sahla,Welcome
Greetings,Tfadal / Tfadale,Welcome / Come in / Here you go
Greetings,Kifak / Kifek,How are you
Greetings,Shokran / Mamnunak,Thanks
Greetings,Tekram / Tekrame,You're very welcome / My pleasure
Greetings,Ysalemon / Ysalem 2idek,Thank you (bless your hands)
Greetings,Wala yhemak / Wala yhemik,Don't worry about it
Greetings,Basita,Simple / No big deal
Greetings,Msh m7rze,Not worth it
Greetings,3a rase,With pleasure
Greetings,Be3tezer,I apologize / Sorry
General,Eh / Akid / Yalla,Yes / Definitely / Let's go
General,Laa / La2,No

General,5aye / E5te,Brother / Sister
General,Ana / Enta / Ente,Me / You
Shopping,Ade 7a2o / 7a2a / Ade se3ro,How much is it / Price
Shopping,Bde wehde,I want one
Shopping,Mawjud / Fi meno,Available / Do you have it?
Shopping,2yes / Ma2asak,Size
Shopping,Lon / Alwen,Color / Colors
Shopping,Z8ir / S8ir,Small
Shopping,Kbir / Kbire,Big / Large
Shopping,Nos,Half
Shopping,Makfule,Guaranteed
Shopping,Balesh,Free
Shopping,Mni7a,Good
Shopping,Msh mni7a,Not good / Bad
Shopping,Asle,Original
Appointments,Maw3ed,Appointment
Appointments,B nesbak,Suits you / Works for you
Appointments,Fi majel,Is there an opening
Appointments,Ajel l maw3ed,Postpone the appointment
Appointments,Beje 3al ma7al,I will come to the store/shop
Appointments,Natrinak,Waiting for you
Appointments,Fethin / Msakrin,Open / Closed
Appointments,Dawr,Turn / Line
Appointments,Jalse,Session
Appointments,Amta / Aimta,When
Logistics,Towsil / Delivery,Delivery
Logistics,3nwen / Wen mawjud,Address / Location
Logistics,Manta2a,Area / Region
Logistics,Bineye,Building
Logistics,Ra2m,Number / Phone
Logistics,Bokra,Tomorrow
Logistics,Taleta,Tuesday
Logistics,Bser3a,Quickly
Logistics,Se3a,Hour / Time
Logistics,Min,Minutes
Logistics,Ana 3al tari2,I am on the way
Logistics,Fi 3aj2a,There is traffic
Money,Cash,Cash
Money,Frata,Change
Money,7wele,Money transfer
Money,Card,Card
Commands,8alat,Wrong / Mistake
Commands,Bade badela,I want to exchange it
Commands,Bde el8e / El8iya,I want to cancel it
Commands,T2a5arto,You are late
Commands,Ma woselne shi,I didn't receive anything
Commands,Senye bas,Just a second
Commands,Ma fhmt,I didn't understand
Commands,Mwazaf,Human agent
Commands,B3atle,Send me
Commands,Sura,Picture
Digital,Wpp,WhatsApp
Digital,Insta,Instagram
Digital,Link,Link
Digital,Msg,Message
Digital,Saf7a,Page
`;

export const ARABIZI_DICTIONARY: Record<string, string> = {
    // --- Ultra-Short (1-8 word style) ---
    'Yes, available.': 'Eh mawjoud.',
    'Yes available': 'Eh mawjoud',
    'Yes, in stock.': 'Eh mawjoud.',
    'Yes, in stock': 'Eh mawjoud',
    'Out of stock.': 'Ma fi halla2.',
    'Out of stock': 'Ma fi halla2',
    'Not available at the moment.': 'Ma fi hala2.',
    'Not available.': 'Msh mawjoud.',
    'Order confirmed.': 'Tmm t2akad el order. ✅',
    'Booking confirmed.': 'Tmm t2akad el 7ajez. ✅',
    'Send your name, phone, and delivery address.': 'B3atle ismak, ra2mak w el 3nwen.',
    'Send your name and phone number.': 'B3atle ismak w ra2mak.',
    'What size?': 'Aya 2yes?',
    'What color?': 'Aya lon?',
    'What size and color?': 'Aya 2yes w lon?',
    'Yes, delivery available.': 'Eh fi delivery.',
    'Where is the location?': 'Wen l location?',
    'One moment.': 'Lahza.',
    'Thank you.': 'Shokran.',

    // --- Appointments ---
    'Hey 👋 how can I help?': 'Hala 👋 Kif fiyi se3dak?',
    'What service would you like to book?': 'Aya service bdk te7jez?',
    'Sure — what day and time would you like?': 'Akid — aya yom w se3a badek?',
    '{dateLabel} at {timeLabel} is available. Send your name and phone number to confirm.': '{dateLabel} se3a {timeLabel} fi majel. B3atle ismak w ra2mak la2akked el 7ajez.',
    'Send your name and phone number to confirm.': 'B3atle esmak w ra2mak la 2aked el 7ajez.',
    'Perfect — your {serviceName} is confirmed for {dateLabel} at {timeLabel}. ✅': 'Tmm — el {serviceName} t2akkad {dateLabel} se3a {timeLabel}. ✅',
    "We're closed on {dayLabel}.": 'Msakrin yom el {dayLabel}.',
    'That time is outside working hours ({openTime} – {closeTime}). Want a different time?': 'Hal wa2et barra dawemna ({openTime} – {closeTime}). Badek gheiro?',
    "I'm having trouble confirming the appointment right now. Please try again in a moment.": 'Fi 8alat bel 7ajez halla2. Jarreb kamen shway.',
    'Sorry, what would you like to book?': 'Be3tezer, aya service bdk?',
    'That slot is taken. Do you have another time in mind?': 'Hal wa2et msh fadi. Fi wa2t tene b belak?',
    'That slot is already taken. Do you have another time in mind?': 'Hal wa2et msh fadi. fi wa2t tene b belak?',
    'No problem. Let me know if you need anything else.': 'Wala yhemak. Eza bdk shi tene khaberne.',
    'We offer: {serviceList}.': '3anna: {serviceList}.',
    '{serviceName} is {price}.': 'el {serviceName} 7a2o {price}.',
    "We're open {hoursSummary}.": 'Fethin: {hoursSummary}.',
    "We're located at {location}.": 'mawjudin 3a hay location : {location}.',
    "You're welcome! 🙏": 'Tekram! 🙏',

    // --- E-Commerce ---
    'Hey 👋 what are you looking for?': 'Hala 👋 3a shu 3am tdawer?',
    'Which product are you interested in?': 'Aya product bdk?',
    'What size and color would you like?': 'Aya 2yes w lon bdkk?',
    'Yes, {variantLabel} is available. {priceInfo}': 'Eh, {variantLabel} mawjud. {priceInfo}',
    '{variantLabel} is sold out. {alternatives}': '{variantLabel} khalsin. {alternatives}',
    'Send your name, phone number, and delivery address to place the order.': 'B3atle esmak, ra2mak w el 3nwen la n2aked el order.',
    'Send your delivery address to place the order.': 'B3atle el 3nwen la n2akked el order.',
    'Perfect — your order is confirmed. ✅': 'Tmm — order-ak t2akkad. ✅',
    "I'm having trouble creating the order right now. Please try again in a moment.": 'Fi 8alat bel order hala2. Jareb kamen shway.',
    'Sorry, which product are you looking for?': 'Be3tezer, aya product bdk?',
    '{productName} is {price}.': 'el {productName} 7a2o {price}.',
    '{shippingRules}': '{shippingRules}',

    // --- Pricing (ultra-short) ---
    'Hello {price}': 'Hala {price}',
    '{productName} — {price}, in stock.': '{productName} — {price}, mawjoud.',
    '{productName} — out of stock.': '{productName} — ma fi halla2.',

    // --- Fallbacks ---
    "I'm having trouble right now. Please try again in a moment.": 'Fi 8alat hala2. Jareb b3d shway.',
    'Sorry, I cannot help with that.': 'Be3tezer, ma fiye se3dak bhal shi.',
};
