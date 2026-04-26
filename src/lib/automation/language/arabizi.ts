/**
 * ============================================================
 * GhostAgent — Lebanese Arabizi / Franco Language Module
 * ============================================================
 * This module provides intent signals and language detection
 * for Lebanese Franco (Arabizi) messages.
 *
 * IMPORTANT: This file contains ONLY:
 *   - language detection logic
 *   - intent signal words (generic)
 *   - date/time/day token normalization
 *   - yes/no detection
 *   - reply-style templates (no business facts)
 *
 * FORBIDDEN in this file:
 *   - Hardcoded business hours
 *   - Hardcoded prices
 *   - Hardcoded service names
 *   - Hardcoded stock levels
 *   - Phone numbers / addresses
 * ============================================================
 */

export type DetectedLanguageStyle =
  | 'english'
  | 'arabic'
  | 'lebanese_arabizi'
  | 'mixed';

// ── Normalize raw input for token matching ──────────────────
function norm(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Arabic Unicode range detector ──────────────────────────
function hasArabicScript(msg: string): boolean {
  return /[\u0600-\u06FF]/.test(msg);
}

// ── Lebanese Franco / Arabizi signal words ──────────────────
const ARABIZI_SIGNALS = [
  // Booking / appointment
  'maw3ed', 'mawed', 'ma3ed', 'bde', 'bade', 'baddi', 'badde',
  'e5od', 'e5ud', 'ekhod', 'ekhed', '7ajez', 'hajiz', 'hajez',
  'se3a', 'seaa', 'sa3a',
  // Time / day
  'nhar', 'bukra', 'bokra', 'lyom', 'elyoum', 'sobo7', 'masa',
  'ba3ed', 'halla2', 'hala2', 'dohor',
  // Business hours
  'btefta7', 'btfta7', 'betsakro', 'msakrin', 'fet7in', 'fethin',
  // General Lebanese
  'shu', 'shi', 'ade', 'adde', 'addesh', 'wen', 'wain',
  'tamem', 'tayeb', 'akid', 'tfaddal', 'yalla', 'tekram',
  'mish', 'la2', 'eh', 'ee', 'fi', 'ma fi',
  // E-commerce
  'se3r', 'se3ro', 'ra2m', '3nwen', 'towsil', 'mawjud', 'mawjoud',
];

// ── Language Style Detection ─────────────────────────────────
export function detectLanguageStyle(message: string): DetectedLanguageStyle {
  const hasArabic = hasArabicScript(message);
  const normalized = norm(message);
  const hasFranco = ARABIZI_SIGNALS.some((w) => normalized.includes(w));
  const hasLatin = /[a-z]/i.test(message);

  if (hasArabic && hasLatin) return 'mixed';
  if (hasArabic && !hasLatin) return 'arabic';
  if (hasFranco) return 'lebanese_arabizi';
  if (hasLatin) return 'english';
  return 'english';
}

// ── Day name token resolution ────────────────────────────────
const DAY_TOKENS: Record<string, number> = {
  // Sunday
  a7ad: 0, ahad: 0, 'l a7ad': 0, 'l ahad': 0, 'الأحد': 0, 'الاحد': 0,
  // Monday
  tnen: 1, itnen: 1, tanen: 1, 'l tnen': 1, 'l tanen': 1, 'الإثنين': 1, 'الاثنين': 1, lundi: 1,
  // Tuesday
  tleta: 2, taleta: 2, 'l tleta': 2, 'الثلاثاء': 2,
  // Wednesday
  arba3a: 3, 'arb3a': 3, 'l arba3a': 3, 'الأربعاء': 3, 'الاربعاء': 3,
  // Thursday
  khamis: 4, '5amis': 4, 'l khamis': 4, 'الخميس': 4,
  // Friday
  jem3a: 5, jom3a: 5, juma: 5, 'l jem3a': 5, 'الجمعة': 5,
  // Saturday
  sabet: 6, sebet: 6, 'l sabet': 6, 'السبت': 6,
};

function extractDayToken(normalized: string): string | null {
  // Check multi-word tokens first (longest first)
  const sorted = Object.keys(DAY_TOKENS).sort((a, b) => b.length - a.length);
  for (const token of sorted) {
    if (normalized.includes(token)) return token;
  }
  return null;
}

// ── Time token extraction ────────────────────────────────────
// Handles: "se3a 4", "3al 4", "aal 4", "4 l masa", "10 l sobo7", "4pm", "10am"
function extractTimeToken(normalized: string): string | null {
  // "4pm" / "10am"
  const ampm = normalized.match(/\b(\d{1,2})(am|pm)\b/);
  if (ampm) {
    const h = parseInt(ampm[1], 10);
    const isPM = ampm[2] === 'pm';
    const hour = isPM && h < 12 ? h + 12 : !isPM && h === 12 ? 0 : h;
    return `${String(hour).padStart(2, '0')}:00`;
  }

  // "4 l masa" → PM; "10 l sobo7" → AM
  const masa = normalized.match(/\b(\d{1,2})\s*(?:l\s*)?masa\b/);
  if (masa) {
    const h = parseInt(masa[1], 10);
    return `${String(h < 12 ? h + 12 : h).padStart(2, '0')}:00`;
  }

  const sobo7 = normalized.match(/\b(\d{1,2})\s*(?:l\s*)?sobo7\b/);
  if (sobo7) {
    return `${String(parseInt(sobo7[1], 10)).padStart(2, '0')}:00`;
  }

  // "se3a 4" / "3al 4" / "aal 4"
  const seaa = normalized.match(/(?:se3a|sa3a|3al|aal|al)\s+(\d{1,2})(?::(\d{2}))?/);
  if (seaa) {
    const h = parseInt(seaa[1], 10);
    const m = seaa[2] || '00';
    return `${String(h).padStart(2, '0')}:${m}`;
  }

  // Plain HH:MM
  const hhmm = normalized.match(/\b(\d{1,2}):(\d{2})\b/);
  if (hhmm) return `${String(parseInt(hhmm[1], 10)).padStart(2, '0')}:${hhmm[2]}`;

  return null;
}

// ── Main export ──────────────────────────────────────────────
export interface ArabiziResult {
  original: string;
  normalized: string;
  tokens: string[];
  detectedStyle: DetectedLanguageStyle;
  hints: {
    wantsAppointment?: boolean;
    asksBusinessHours?: boolean;
    asksAvailability?: boolean;
    asksPrice?: boolean;
    asksLocation?: boolean;
    yes?: boolean;
    no?: boolean;
    today?: boolean;
    tomorrow?: boolean;
    dayAfterTomorrow?: boolean;
    dayName?: string | null;
    dayOfWeek?: number | null;
    timeText?: string | null;
    wantsToBuy?: boolean;
    asksStock?: boolean;
    asksService?: boolean;
  };
}

export function normalizeArabizi(message: string): ArabiziResult {
  const normalized = norm(message);
  const tokens = normalized.split(' ').filter(Boolean);
  const detectedStyle = detectLanguageStyle(message);
  const has = (...words: string[]) => words.some((w) => normalized.includes(w));

  const dayToken = extractDayToken(normalized);
  const dayOfWeek = dayToken !== null ? (DAY_TOKENS[dayToken] ?? null) : null;
  const timeText = extractTimeToken(normalized);

  const hints: ArabiziResult['hints'] = {
    // Appointment intent signals
    wantsAppointment: has(
      'maw3ed', 'mawed', 'ma3ed', 'e5od', 'e5ud', 'ekhod',
      'hajez', 'hajiz', '7ajez', 'baddi maw3ed', 'bde e5od',
      'appointment', 'book', 'reserve', 'احجز', 'موعد', 'حجز',
    ),

    // Business hours signals
    asksBusinessHours: has(
      'btefta7', 'btfta7', 'emta btefta7', 'betsakro', 'emta betsakro',
      'msakrin', 'fet7in', 'fethin',
      'open', 'close', 'closing', 'opening', 'hours', 'working hours',
      'بتفتح', 'بتسكر', 'ساعات', 'متى تفتح',
    ),

    // Availability (slot check, not hours)
    asksAvailability: has(
      'fi mahal', 'fi slot', 'available', 'availability',
      'fi maw3ed', 'fi mawed', 'في موعد',
    ),

    // Price signals
    asksPrice: has(
      'ade', 'adde', 'addesh', 'se3r', 'se3ro', 'price', 'cost', 'how much',
      'كم', 'قديش', 'سعر',
    ),

    // Location signals
    asksLocation: has('wen', 'wain', 'where', 'location', 'address', 'وين', 'عنوان'),

    // Confirmation
    yes: has(
      'eh', ' ee ', 'yes', 'yeah', 'ok', 'okay', 'akid', 'tamem', 'tayeb',
      'yalla', 'confirm', 'mazbout', 'bonjour lak',
      'اي', 'ايه', 'نعم', 'تمام', 'أكيد', 'صح',
    ),

    // Rejection
    no: has('la', 'la2', 'no', 'nope', 'mish', 'msh', 'لا', 'مش'),

    // Relative day tokens
    today: has('lyom', 'elyoum', 'اليوم', 'today'),
    tomorrow: has('bukra', 'bokra', 'بكرا', 'غدا', 'غداً', 'tomorrow'),
    dayAfterTomorrow: has('ba3ed bukra', 'ba3d bukra', 'بعد بكرا'),

    // Day of week
    dayName: dayToken,
    dayOfWeek,

    // Time
    timeText,

    // E-commerce
    wantsToBuy: has(
      'bde', 'bade', 'baddi', 'bde yeha', 'bde yehon',
      'i want', 'buy', 'order', 'purchase', 'بدي', 'بطلب',
    ),
    asksStock: has(
      'fi meno', 'mawjud', 'mawjoud', 'in stock', 'available',
      'في', 'موجود',
    ),
    asksService: has(
      'shu l services', 'shu l service', 'services', 'what services',
      'شو الخدمات', 'ايش الخدمات',
    ),
  };

  return { original: message, normalized, tokens, detectedStyle, hints };
}

// ── Reply Style Templates (NO business facts) ────────────────
// These are short natural Lebanese Franco reply templates.
// All dynamic values ({serviceName}, {dateLabel}, etc.) must be
// filled from DB data at reply time — never hardcoded here.
export const ARABIZI_APPOINTMENT_REPLIES = {
  ASK_SERVICE_AND_TIME: 'Akid, shu l service w ayya wa2et baddak?',
  ASK_DATE_AND_TIME: 'Akid, la ay nhar w aya se3a?',
  ASK_SERVICE: 'Shu l service li baddak yeha?',
  ASK_DATE: 'La ay nhar baddak l maw3ed?',
  ASK_NAME_PHONE: 'B3at esmak w ra2mak la sabbet l maw3ed.',
  CONFIRMED: 'Tamem, maw3edak lal {serviceName} {dateLabel} se3a {timeLabel} confirmed ✅',
  CLOSED: 'La2, msakrin {dayLabel}.',
  OUTSIDE_HOURS: 'Mensakker se3a {closeTime}, fina na3tik {suggestedTime} iza byemshe ma3ak.',
  BUSINESS_HOURS: 'Mnefta7 {summary}.',
  SLOT_AVAILABLE_NEED_DETAILS: '{dateLabel} se3a {timeLabel} available. B3at esmak w ra2mak la sabbet l maw3ed.',
  REJECT_ACK: 'Tamem, ana hon iza baddak shi tene.',
  GREETING: 'Tamem 👋 kif fine se3dak?',
  THANK_YOU: 'Tekram.',
};

export const ARABIZI_ECOM_REPLIES = {
  GREETING: 'Ah, shu baddak? 👋',
  ASK_VARIANT: 'Shu l size w l color li baddak?',
  ASK_ORDER_DETAILS: 'B3at esmak, ra2mak, w 3nwanak la nasbet l order.',
  PRODUCT_AVAILABLE: 'Eh, {productName} {variantLabel} mawjud ✅',
  PRODUCT_UNAVAILABLE: '{variantLabel} mish mawjud. {availableOptions} available.',
  ASK_PRICE: 'Se3ro {price}.',
  THANK_YOU: 'Tekram, yeslamo! 🙏',
};

// ── Language hint for LLM prompts ────────────────────────────
// Inject this into the system prompt when Lebanese Franco is detected.
export const ARABIZI_LLM_HINT = `
LANGUAGE CONTEXT: The customer is writing in Lebanese Arabizi/Franco (mixed Latin and Arabic).
Understand these expressions as follows:
  "bde e5od maw3ed" = I want to book an appointment
  "bde / baddi / badde" = I want
  "e5od / ekhod" = to take / to get
  "maw3ed / mawed" = appointment
  "7ajez / hajez" = book / reserve
  "se3a X" = at X o'clock
  "3al X / aal X" = at X
  "bukra / bokra" = tomorrow
  "lyom / elyoum" = today
  "sobo7" = morning, "masa" = evening, "dohor" = noon
  "btefta7o / btefta7" = do you open
  "betsakro" = do you close
  "msakrin" = closed, "fet7in" = open
  "ade / adde / addesh" = how much
  "shu" = what, "wen / wain" = where
  "eh / ee / akid / tamem" = yes
  "la / la2 / mish" = no
  "fi" = there is / do you have
  Day names: a7ad=Sun, tnen=Mon, tleta=Tue, arba3a=Wed, khamis=Thu, jem3a=Fri, sabet=Sat

Reply STYLE rules when customer writes Arabizi/Franco:
  - Reply in short, natural Lebanese Franco (not formal Arabic, not "Aywa")
  - 1 sentence by default, max 2
  - Preferred phrases: "Akid", "Tamem", "La2", "Tekram", "Yalla"
  - NEVER say "Aywa", "aykun maw3ed 3layna", or formal Fusha phrases
  - Match the casual, direct tone of Lebanese DM communication
`.trim();
