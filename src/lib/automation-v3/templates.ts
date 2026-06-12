export type LanguageScript = 'english' | 'arabic' | 'franco' | 'mixed' | 'unknown' | 'arabizi';

const TEMPLATES: Record<string, Record<string, string>> = {
  // === GREETINGS ===
  greeting: {
    english: "Hey! What are you looking for? 👋",
    arabic: "مرحبا! عم تفتش على شي معين؟ 👋",
    franco: "Hala! Kifak? Fi she 3am tdawwer 3leh? 👋",
    mixed: "Hey! Kifna? Shu baddak lyom? 👋"
  },
  greeting_returning: {
    english: "Back again? 😎 What are we getting today?",
    arabic: "أهلاً من جديد! 😎 شو بدك نجيب اليوم؟",
    franco: "Hala walla rje3et! 😎 Shu badna njib lyom?",
    mixed: "Back again? 😎 Shu badna njib lyom?"
  },
  greeting_vip: {
    english: "Hey {{name}}! Good to see you again 🙌",
    arabic: "أهلاً {{name}}! منور، حلو نشوفك مرة تانية 🙌",
    franco: "Hala {{name}}! Mnawwer, mnee7 yalli shufnak marra tanye 🙌",
    mixed: "Hey {{name}}! Mnawwer walla 🙌"
  },

  // === SCARCITY / URGENCY ===
  scarcity_urgent: {
    english: "Only {{stock}} left in {{variant}} — want me to hold one? ${{price}}",
    arabic: "باقي بس {{stock}} حبات من {{variant}} — بدك احجزلك وحدة؟ ${{price}}",
    franco: "B2ye bas {{stock}} mn {{variant}} — baddak 7ajezlak wahde? ${{price}}",
    mixed: "Only {{stock}} left mn {{variant}} — baddak 7ajezlak wahde? ${{price}}"
  },
  scarcity_last_one: {
    english: "That's the last one 😬 Want it?",
    arabic: "هيدي آخر قطعة 😬 بدك ياها؟",
    franco: "Hayde akher 2et3a ?? Baddak yaha?",
    mixed: "That's the last one 😬 Baddak yaha?"
  },

  // === RETURNING CUSTOMER ===
  returning_customer: {
    english: "Back for more? 😎 You got the {{lastProduct}} last time — same again or something new?",
    arabic: "راجع للمزيد؟ 😎 أخذت {{lastProduct}} المرة الماضية — نفس الشيء أو بدك جديد؟",
    franco: "Rje3na? 😎 Akhadet {{lastProduct}} l marra l madye — nafs el shee aw jdid?",
    mixed: "Back for more? 😎 Akhadet {{lastProduct}} l marra l madye — same or jdid?"
  },
  returning_customer_suggestion: {
    english: "Since you liked the {{lastProduct}}, this new drop might be your thing 🔥",
    arabic: "بما إنك حبيت {{lastProduct}}، هالقطعة الجديدة أكيد رح تعجبك 🔥",
    franco: "Bema ennak 7ebet {{lastProduct}}, hal jdeede ra7 tejebak 🔥",
    mixed: "Since you liked {{lastProduct}}, hal jdeede ra7 tejebak 🔥"
  },

  // === FRUSTRATION / DE-ESCALATION ===
  frustration_acknowledge: {
    english: "ugh yeah that's annoying — let me fix this for you",
    arabic: "بعتذر، هاد مزعج فعلاً — خليني زبطلكم الوضع",
    franco: "Walla meshkle.. khalline zabethalnak hla2",
    mixed: "ugh that's annoying — khalline zabethalnak hla2"
  },
  frustration_sorry: {
    english: "my bad — that's on us. here's what i can do:",
    arabic: "بعتذر، هيدي غلطتنا. هاد اللي بقدر اعملو:",
    franco: "Ghaltetna sam7na — hayda li b2dar a3mlo hla2:",
    mixed: "my bad — ghaltetna. Hayda li b2dar a3mlo:"
  },
  frustration_compensation: {
    english: "not cool — i'm throwing in free shipping for you",
    arabic: "حقك علينا — الشحن مجاني هالمرة",
    franco: "Mesh 7elo yalle sar — el shipping majane 3aleyn2",
    mixed: "not cool — el shipping majane 3aleyn2"
  },

  // === HESITANT / NURTURE ===
  hesitant_nudge: {
    english: "no pressure — but this one's moving fast. want me to save your spot?",
    arabic: "على راحتك — بس الطلب عليها كتير عالي. بدك احجزلك؟",
    franco: "3ala ra7tak — bas hayde 3am tmshe bser3a. baddak 7ajezlak?",
    mixed: "no pressure — bas hayde 3am tmshe bser3a. baddak 7ajezlak?"
  },
  hesitant_social_proof: {
    english: "3 people grabbed this today — just saying 😏",
    arabic: "٣ أشخاص طلبوها اليوم — بس عم قلك 😏",
    franco: "3 ashkhass akhaduoa lyom — bas 3am 2ellak 😏",
    mixed: "3 people akhaduoa lyom — just saying 😏"
  },
  hesitant_guarantee: {
    english: "if it doesn't work out, returns are easy — no stress",
    arabic: "إذا ما زبطت، التبديل كتير سهل — ما تعتل هم",
    franco: "iza ma zabtet, el tabdil sahl — ma ta3tal hamm",
    mixed: "if it doesn't work out, el tabdil sahl — no stress"
  },

  // === ORDER / BOOKING FLOW ===
  awaiting_order_details: {
    english: "{{productName}} — ${{price}}. Send your name, phone, and delivery address.",
    arabic: "{{productName}} — ${{price}}. أرسل اسمك ورقمك وعنوان التوصيل.",
    franco: "{{productName}} — ${{price}}. Bas b3atle ismak, ra2mak w el 3nwen.",
    mixed: "{{productName}} — ${{price}}. Bas b3atle ismak, ra2mak w el 3nwen."
  },
  order_confirmed: {
    english: "Locked in! ✅ Tracking link coming soon",
    arabic: "تم تسجيل الطلب! ✅ منبعتلك رابط التتبع قريباً",
    franco: "T2akkad el order! ✅ Tracking link jeye 2ariban",
    mixed: "Locked in! ✅ Tracking link jeye 2ariban"
  },
  booking_confirmed: {
    english: "You're booked! ✅ See you {{date}} at {{time}}",
    arabic: "تم الحجز! ✅ نشوفك بـ {{date}} الساعة {{time}}",
    franco: "T2akkad el 7ajes! ✅ Nshufak {{date}} 3al {{time}}",
    mixed: "You're booked! ✅ Nshufak {{date}} 3al {{time}}"
  },

  // === LOOP DETECTION / RESET ===
  loop_detected_menu: {
    english: "Let's start fresh! What would you like to do?\n1. Browse products\n2. Track my order\n3. Talk to a human",
    arabic: "خلينا نبلش من جديد! شو حابب تعمل؟\n1. تصفح المنتجات\n2. تتبع الطلبية\n3. حكي حدا من الشباب",
    franco: "Yalla mn el awal! Shu baddak ta3mel?\n1. Browse products\n2. Track order\n3. Haki ma3 el shabeb",
    mixed: "Yalla mn el awal! Shu baddak ta3mel?\n1. Browse products\n2. Track order\n3. Talk to human"
  },
  loop_detected_simple: {
    english: "i think i'm confused — can you tell me what you need in one message?",
    arabic: "ضعت شوي 😅 فيك تقلي شو بدك برسالة وحدة واضحة؟",
    franco: "D3et shway 😅 fik t2elle shu baddak b-resale wa7de ashal?",
    mixed: "i think mesh fahham — fik t2elle shu baddak b-resale wa7de?"
  },

  // === HUMAN HANDOFF ===
  handoff_requested: {
    english: "Connecting you with the team now — one sec",
    arabic: "عم وصلك بالشباب هلق — لحظة وحدة",
    franco: "3am wasselak ma3 el shabeb — la7ze",
    mixed: "Connecting you ma3 el shabeb — one sec"
  },
  handoff_complex: {
    english: "This one's above my pay grade 😅 Let me get someone who knows this better",
    arabic: "خليني حولك على حدا من الشباب ليساعدك بشكل أفضل 😅",
    franco: "Lah la7za, khalline wasslak ma3 el shabeb kramel nsa3dak aktar 😅",
    mixed: "This one's a bit complex 😅 Khalline wasslak ma3 el shabeb"
  },

  // === CULTURAL / LEBANESE SPECIFIC ===
  lebanese_casual_close: {
    english: "Say hi to the fam from us 🙌",
    arabic: "سلم على الأهل 🙌",
    franco: "Sallem 3al ahel 🙌",
    mixed: "Sallem 3al ahel 🙌"
  },
  lebanese_ramadan: {
    english: "Ramadan Kareem! 🌙 We have special evening delivery slots",
    arabic: "رمضان كريم! 🌙 عنا خدمة توصيل مسائية خاصة",
    franco: "Ramadan Kareem! 🌙 3anna delivery mas2e khas",
    mixed: "Ramadan Kareem! 🌙 3anna delivery mas2e khas"
  },

  // === PROACTIVE ===
  proactive_abandoned_cart: {
    english: "Still thinking about the {{productName}}? It's waiting for you 👀",
    arabic: "بعدك عم تفكر بـ {{productName}}؟ ناطرتك 👀",
    franco: "Ba3dak 3am tfakkar b-{{productName}}? Natorak 👀",
    mixed: "Still thinking about {{productName}}? Natorak 👀"
  },
  proactive_restock: {
    english: "Good news — the {{productName}} you wanted is back! 🔥",
    arabic: "خبريات حلوة — الـ {{productName}} يلي كنت بدك ياها رجعت! 🔥",
    franco: "Khabar 7elo — el {{productName}} yalle baddak yeh raja3! 🔥",
    mixed: "Good news — el {{productName}} yalle baddak yeh raja3! 🔥"
  },
};

export function getTemplate(
  templateId: string,
  languageScript: LanguageScript,
  variables: Record<string, string> = {}
): string | null {
  const templateSet = TEMPLATES[templateId];
  if (!templateSet) return null;

  let script = languageScript;
  if (script === 'arabizi') script = 'franco';

  // Try exact match first
  let text = templateSet[script];

  // Fallback chain: mixed → franco → english
  if (!text && languageScript === 'mixed') text = templateSet['franco'];
  if (!text && languageScript === 'franco') text = templateSet['mixed'];
  if (!text) text = templateSet['english'];
  if (!text) return null;

  // Replace variables
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] !== undefined ? variables[key] : match);
}

export function hasTemplate(templateId: string): boolean {
  return !!TEMPLATES[templateId];
}

export function listTemplates(): string[] {
  return Object.keys(TEMPLATES);
}

const TEMPLATE_VARIANTS: Record<string, Record<string, string[]>> = {
    awaiting_order_details: {
        english: [
            "{{productName}} — ${{price}}. Just need your name, number, and where to send it",
            "Got it — {{productName}} for ${{price}}. Name, phone, and address?",
            "{{productName}} at ${{price}}. Cool if I get your name, number, and delivery address?",
            "That's ${{price}} for the {{productName}}. Drop your name, phone, and address and we're good",
            "{{productName}} — ${{price}}. What's your name, number, and where should I send it?",
        ],
        franco: [
            "{{productName}} — ${{price}}. Bade ismak, ra2mak w el 3enwen",
            "Fhemet — {{productName}} b-${{price}}. Ism, telefon, w 3enwen?",
            "{{productName}} b-${{price}}. Bade ismak, ra2mak, w ween baddik ewasselon?",
        ],
        arabic: [
            "{{productName}} — ${{price}}. بدي اسمك، رقمك، والعنوان",
            "تمام — {{productName}} بـ${{price}}. الاسم، التلفون، والعنوان؟",
            "{{productName}} بـ${{price}}. فيك تعطيني اسمك، رقمك، وعنوان التوصيل؟",
        ],
    },
    order_confirmed: {
        english: [
            "Locked in! ✅",
            "All set! Your order's placed 🙌",
            "Done! You'll get a tracking link soon",
            "Got it! Order confirmed ✅",
            "You're good to go! Order's in",
        ],
        franco: [
            "Tayyeb! ✅",
            "Tamm! Order m7ebbas 🙌",
            "Khalas! Tracking link jeye 2ariban",
            "Bserraf! Order confirmed ✅",
        ],
        arabic: [
            "تمام! ✅",
            "تم! طلبك مسجل 🙌",
            "خلص! رابط التتبع جاي قريباً",
            "تم التأكيد! ✅",
        ],
    },
    booking_confirmed: {
        english: [
            "You're booked! ✅ See you {{date}} at {{time}}",
            "All set! {{date}} at {{time}} — see you then 🙌",
            "Locked in for {{date}} at {{time}}! ✅",
            "Got you down for {{date}} at {{time}}! See you",
        ],
        franco: [
            "7ejzet! ✅ Nshufak {{date}} sa3a {{time}}",
            "Tamm! {{date}} sa3a {{time}} — nshufak 🙌",
            "Booked for {{date}} sa3a {{time}}!",
        ],
        arabic: [
            "تم الحجز! ✅ نشوفك {{date}} الساعة {{time}}",
            "تمام! {{date}} الساعة {{time}} — نشوفك 🙌",
            "محجوز ل{{date}} الساعة {{time}}!",
        ],
    },
    greeting: {
        english: [
            "Hey! What are you looking for? 👋",
            "Hi there! What's up? 👋",
            "Hey! How can I help?",
            "What's good? How can I help you?",
            "Hey there! Looking for something specific?",
        ],
        franco: [
            "Hala! Shu baddak tdawwer 3a she? 👋",
            "Hi! Shu akhbar?",
            "Hala! Kif fiyi se3dak?",
            "Shu fee? Baddak she?",
        ],
        arabic: [
            "مرحبا! شو بدك تدور على شي؟ 👋",
            "أهلا! كيف فيني ساعدك؟",
            "مرحبا! شو الأخبار؟",
        ],
    },
    greeting_returning: {
        english: [
            "Back again? 😎 What are we getting today?",
            "Hey, welcome back! What are you after today?",
            "Good to see you again! What's up?",
        ],
        franco: [
            "Rajje3 marra tanye? 😎 Shu baddak lyom?",
            "Hala walla! Shu baddak lyom?",
        ],
        arabic: [
            "راجع مرة تانية؟ 😎 شو بدك اليوم؟",
            "أهلا من جديد! شو الأخبار؟",
        ],
    },
    loop_detected_menu: {
        english: [
            "Let's start fresh! What would you like to do?\n1. Browse products\n2. Track my order\n3. Talk to a human",
            "Hmm, let's try again. What do you need?",
            "Let's reset! What can I help with?",
        ],
        franco: [
            "Yalla mn el awal! Shu baddak ta3mel?\n1. Dawwar products\n2. Track order\n3. Haki ma3 beshar",
            "Yalla, mn el jdid! Shu baddak?",
        ],
        arabic: [
            "لنبدأ من جديد! شو بدك تعمل؟\n1. تصفح المنتجات\n2. تتبع طلبي\n3. التحدث مع إنسان",
            "من الأول! شو بدك؟",
        ],
    },
};

/**
 * Get a random variant of a template for natural response variety.
 * Falls back to the standard template if no variants exist.
 */
export function getTemplateVariant(
    templateId: string,
    languageScript: LanguageScript,
    variables: Record<string, string> = {}
): string | null {
    const variants = TEMPLATE_VARIANTS[templateId];
    if (!variants) return getTemplate(templateId, languageScript, variables);

    let script: string = languageScript;
    if (script === 'arabizi') script = 'franco';
    if (script === 'mixed') script = 'franco';

    // Try exact script match
    let scriptVariants = variants[script];

    // Fallback chain
    if (!scriptVariants && script === 'franco') scriptVariants = variants['mixed'];
    if (!scriptVariants) scriptVariants = variants['english'];
    if (!scriptVariants || scriptVariants.length === 0) {
        return getTemplate(templateId, languageScript, variables);
    }

    // Random selection
    const text = scriptVariants[Math.floor(Math.random() * scriptVariants.length)];

    // Replace variables
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) =>
        variables[key] !== undefined ? variables[key] : match
    );
}

export { TEMPLATE_VARIANTS };
