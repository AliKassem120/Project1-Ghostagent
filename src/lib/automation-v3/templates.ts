export type LanguageScript = 'english' | 'arabic' | 'franco' | 'mixed' | 'unknown' | 'arabizi';

const TEMPLATES: Record<string, Record<string, string>> = {
  // === GREETINGS ===
  greeting: {
    english: "Hey! What are you looking for? 👋",
    arabic: "مرحبا! شو بدك تدور على شي؟ 👋",
    franco: "Hala! Shu baddak tdawwer 3a she? 👋",
    mixed: "Hey! Shu baddak? 👋"
  },
  greeting_returning: {
    english: "Back again? 😎 What are we getting today?",
    arabic: "راجع مرة تانية؟ 😎 شو بدك اليوم؟",
    franco: "Rajje3 marra tanye? 😎 Shu baddak lyom?",
    mixed: "Back again? 😎 Shu baddak lyom?"
  },
  greeting_vip: {
    english: "Hey {{name}}! Good to see you again 🙌",
    arabic: "{{name}}! منيح شوفك مرة تانية 🙌",
    franco: "{{name}}! Mnay7 shefik marra tanye 🙌",
    mixed: "Hey {{name}}! Mnay7 shefik 🙌"
  },

  // === SCARCITY / URGENCY ===
  scarcity_urgent: {
    english: "Only {{stock}} left in {{variant}} — want me to hold one? ${{price}}",
    arabic: "تبقت {{stock}} فقط من {{variant}} — بدك احجزلك واحد؟ ${{price}}",
    franco: "Badda {{stock}} bas mn {{variant}} — baddak 7ajezlak wahad? ${{price}}",
    mixed: "Only {{stock}} left mn {{variant}} — baddak 7ajezlak wahad? ${{price}}"
  },
  scarcity_last_one: {
    english: "That's the last one 😬 Want it?",
    arabic: "هاد آخر وحدة 😬 بدك ياها؟",
    franco: "Hayda akher wahde 😬 Baddak yaha?",
    mixed: "That's the last one 😬 Baddak yaha?"
  },

  // === RETURNING CUSTOMER ===
  returning_customer: {
    english: "Back for more? 😎 You got the {{lastProduct}} last time — same again or something new?",
    arabic: "راجع للمزيد؟ 😎 أخذت {{lastProduct}} المرة الماضية — نفس الشيء أو جديد؟",
    franco: "Rajje3 lal mazid? 😎 Akhadet {{lastProduct}} marra lal warra — nafs she aw jdid?",
    mixed: "Back for more? 😎 Akhadet {{lastProduct}} marra lal warra — nafs she aw jdid?"
  },
  returning_customer_suggestion: {
    english: "Since you liked the {{lastProduct}}, this new drop might be your thing 🔥",
    arabic: "بما إنك حبيت {{lastProduct}}، هالقطعة الجديدة رح تعجبك 🔥",
    franco: "Bema ennak 7ebet {{lastProduct}}, hal jdeede ra7 tejebak 🔥",
    mixed: "Since you liked {{lastProduct}}, hal jdeede ra7 tejebak 🔥"
  },

  // === FRUSTRATION / DE-ESCALATION ===
  frustration_acknowledge: {
    english: "ugh yeah that's annoying — let me fix this for you",
    arabic: "والله مزعج — خليني حللك ياه",
    franco: "walla m2ayyaj — khalini 7ellak yeh",
    mixed: "ugh walla m2ayyaj — khalini 7ellak yeh"
  },
  frustration_sorry: {
    english: "my bad — that's on us. here's what i can do:",
    arabic: "غلطتنا — سامحنا. هاد اللي بقدر اعملو:",
    franco: "ghaltetna — same7na. Hayda li b2dar a3mlo:",
    mixed: "my bad — ghaltetna. Hayda li b2dar a3mlo:"
  },
  frustration_compensation: {
    english: "not cool — i'm throwing in free shipping for you",
    arabic: "مو منيح — بعطيك شحن مجاني",
    franco: "mesh mnay7 — ba3tik shipping majani",
    mixed: "not cool — ba3tik shipping majani"
  },

  // === HESITANT / NURTURE ===
  hesitant_nudge: {
    english: "no pressure — but this one's moving fast. want me to save your spot?",
    arabic: "ما في ضغط — بس هاد عم بروح بسرعة. بدك احجزلك؟",
    franco: "ma fe deghat — bas had 3am yrou7 besur3a. baddak 7ajezlak?",
    mixed: "no pressure — bas had 3am yrou7 besur3a. baddak 7ajezlak?"
  },
  hesitant_social_proof: {
    english: "3 people grabbed this today — just saying 😏",
    arabic: "٣ أشخاص أخدوه اليوم — بس قايل 😏",
    franco: "3 nass akhadu lyom — bas 2ayel 😏",
    mixed: "3 people akhadu lyom — bas 2ayel 😏"
  },
  hesitant_guarantee: {
    english: "if it doesn't work out, returns are easy — no stress",
    arabic: "إذا ما زبط، التبديل سهل — بدون توتر",
    franco: "iza ma zabet, el tabdil sahl — bdon tawattor",
    mixed: "if it doesn't work out, el tabdil sahl — no stress"
  },

  // === ORDER / BOOKING FLOW ===
  awaiting_order_details: {
    english: "{{productName}} — ${{price}}. Send your name, phone, and delivery address.",
    arabic: "{{productName}} — ${{price}}. أرسل اسمك ورقمك والعنوان.",
    franco: "{{productName}} — ${{price}}. B3atle ismak, ra2mak w el 3nwen.",
    mixed: "{{productName}} — ${{price}}. B3atle ismak, ra2mak w el 3nwen."
  },
  order_confirmed: {
    english: "Locked in! ✅ Tracking link coming soon",
    arabic: "تمام! ✅ رابط التتبع جاي قريباً",
    franco: "Tmm! ✅ Tracking link jaye 2ariban",
    mixed: "Locked in! ✅ Tracking link jaye 2ariban"
  },
  booking_confirmed: {
    english: "You're booked! ✅ See you {{date}} at {{time}}",
    arabic: "تم الحجز! ✅ نشوفك {{date}} الساعة {{time}}",
    franco: "7ejzet! ✅ Nshufak {{date}} sa3a {{time}}",
    mixed: "You're booked! ✅ Nshufak {{date}} sa3a {{time}}"
  },

  // === LOOP DETECTION / RESET ===
  loop_detected_menu: {
    english: "Let's start fresh! What would you like to do?\n1. Browse products\n2. Track my order\n3. Talk to a human",
    arabic: "لنبدأ من جديد! شو بدك تعمل؟\n1. تصفح المنتجات\n2. تتبع طلبي\n3. التحدث مع إنسان",
    franco: "Yalla mn el awal! Shu baddak ta3mel?\n1. Dawwar products\n2. Track order\n3. Haki ma3 beshar",
    mixed: "Yalla mn el awal! Shu baddak ta3mel?\n1. Browse products\n2. Track order\n3. Talk to human"
  },
  loop_detected_simple: {
    english: "i think i'm confused — can you tell me what you need in one message?",
    arabic: "بعتقد مش فاهم — فيك تحكيلي شو بدك بجملة وحدة؟",
    franco: "ba3tef mesh fahham — fik 7akili shu baddak b-jumle wahde?",
    mixed: "i think mesh fahham — fik 7akili shu baddak?"
  },

  // === HUMAN HANDOFF ===
  handoff_requested: {
    english: "Connecting you with the team now — one sec",
    arabic: "جارٍ توصيلك بالفريق — لحظة",
    franco: "3am wasselak ma3 el fere2 — la7ze",
    mixed: "Connecting you ma3 el fere2 — one sec"
  },
  handoff_complex: {
    english: "This one's above my pay grade 😅 Let me get someone who knows this better",
    arabic: "هاد فوق مستواي 😅 خليني جيبلك حدا يفهم فيه أكتر",
    franco: "Hayda faw2 mostawa2e 😅 Khalini jiblik 7ada yefham fiy aktar",
    mixed: "This one's faw2 mostawa2e 😅 Khalini jiblik 7ada yefham aktar"
  },

  // === CULTURAL / LEBANESE SPECIFIC ===
  lebanese_casual_close: {
    english: "Say hi to the fam from us 🙌",
    arabic: "سلم لأهلك من عندنا 🙌",
    franco: "Sallem l-ahlak men 3andna 🙌",
    mixed: "Sallem l-ahlak men 3andna 🙌"
  },
  lebanese_ramadan: {
    english: "Ramadan Kareem! 🌙 We have special evening delivery slots",
    arabic: "رمضان كريم! 🌙 عنا توصيل مسائي خاص",
    franco: "Ramadan Kareem! 🌙 3anna delivery mas2e khas",
    mixed: "Ramadan Kareem! 🌙 3anna delivery mas2e khas"
  },

  // === PROACTIVE ===
  proactive_abandoned_cart: {
    english: "Still thinking about the {{productName}}? It's waiting for you 👀",
    arabic: "لسا عم تفكر بـ{{productName}}؟ عم ينتظرك 👀",
    franco: "Lessa 3am tfakkar b-{{productName}}? 3am yentorak 👀",
    mixed: "Still thinking about {{productName}}? 3am yentorak 👀"
  },
  proactive_restock: {
    english: "Good news — the {{productName}} you wanted is back! 🔥",
    arabic: "خبر حلو — {{productName}} يلي بدك يا رجع! 🔥",
    franco: "Khabar 7elo — {{productName}} elli baddak yeh raja3! 🔥",
    mixed: "Good news — {{productName}} elli baddak yeh raja3! 🔥"
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
