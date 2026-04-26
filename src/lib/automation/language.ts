export type DetectedLanguage = 'english' | 'arabic' | 'arabizi' | 'french' | 'spanish' | 'mixed';

export type LanguageHints = {
  yes: boolean;
  no: boolean;
  wantsAppointment: boolean;
  asksBusinessHours: boolean;
  asksAvailability: boolean;
  asksPrice: boolean;
  asksLocation: boolean;
  wantsProduct: boolean;
  wantsOrder: boolean;
  today: boolean;
  tomorrow: boolean;
  dayName: string | null;
  timeText: string | null;
  productHints: string[];
  serviceHints: string[];
  customerName: string | null;
  customerPhone: string | null;
  addressHint: string | null;
};

export type LanguageNormalizationResult = {
  originalMessage: string;
  detectedLanguage: DetectedLanguage;
  normalizedText: string;
  hints: LanguageHints;
};

const norm = (v: string) => v.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}\s:]/gu, ' ').replace(/\s+/g, ' ').trim();

const hasAny = (text: string, words: string[]) => words.some((w) => text.includes(w));

function detectLanguage(message: string, text: string): DetectedLanguage {
  const hasArabic = /[\u0600-\u06FF]/.test(message);
  const hasLatin = /[a-z]/i.test(message);
  const ar = ['bde', 'bukra', 'maw3ed', 'ade', 'fet7in', 'se3a'];
  const fr = ['bonjour', 'rendez', 'prix', 'disponible', 'demain'];
  const es = ['hola', 'precio', 'manana', 'mañana', 'disponible', 'direccion'];
  const isArabizi = hasAny(text, ar);
  const isFrench = hasAny(text, fr);
  const isSpanish = hasAny(text, es);

  if ((hasArabic && hasLatin) || ([isArabizi, isFrench, isSpanish].filter(Boolean).length > 1)) return 'mixed';
  if (hasArabic) return 'arabic';
  if (isArabizi) return 'arabizi';
  if (isFrench) return 'french';
  if (isSpanish) return 'spanish';
  return 'english';
}

export function normalizeLanguage(message: string): LanguageNormalizationResult {
  const normalizedText = norm(message);
  const detectedLanguage = detectLanguage(message, normalizedText);
  const phone = message.match(/(?:\+?\d[\d\s().-]{6,}\d)/)?.[0]?.trim() || null;
  const commaParts = message.split(',').map((p) => p.trim()).filter(Boolean);

  const tokens = normalizedText.split(' ').filter(Boolean);
  const productHintWords = ['size', 'color', 'colour', 'variant', 'sku', 'stock', 'available', 'product', 'item'];
  const serviceHintWords = ['service', 'appointment', 'book', 'reservation', 'موعد', 'service'];
  const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'to', 'de', 'la', 'el', 'al']);
  const inferredAddress = commaParts.length >= 3 ? commaParts.slice(2).join(', ') : null;

  return {
    originalMessage: message,
    detectedLanguage,
    normalizedText,
    hints: {
      yes: hasAny(normalizedText, ['yes', 'ok', 'okay', 'eh', 'tamam', 'oui', 'si', 'أكيد', 'نعم']),
      no: hasAny(normalizedText, ['no', 'la2', 'non', 'cancel', 'لا']),
      wantsAppointment: hasAny(normalizedText, ['appointment', 'book', 'maw3ed', 'موعد', 'rendez', 'cita']),
      asksBusinessHours: hasAny(normalizedText, ['open', 'close', 'hours', 'fet7in', 'بتفتح', 'horaire', 'horario']),
      asksAvailability: hasAny(normalizedText, ['available', 'availability', 'fi mahal', 'disponible']),
      asksPrice: hasAny(normalizedText, ['price', 'cost', 'ade', 'prix', 'precio', 'سعر']),
      asksLocation: hasAny(normalizedText, ['where', 'address', 'wen', 'عنوان', 'adresse', 'direccion']),
      wantsProduct: hasAny(normalizedText, ['product', 'item', 'producto', 'produit', 'منتج', 'سلعة']),
      wantsOrder: hasAny(normalizedText, ['order', 'buy', 'checkout', 'bde', 'طلب', 'commander']),
      today: hasAny(normalizedText, ['today', 'lyom', 'اليوم', 'aujourd', 'hoy']),
      tomorrow: hasAny(normalizedText, ['tomorrow', 'bukra', 'بكرا', 'demain', 'mañana', 'manana']),
      dayName: (normalizedText.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/) || [])[1] || null,
      timeText: (normalizedText.match(/\b\d{1,2}(?::\d{2})?\s?(?:am|pm)?\b/) || [])[0] || null,
      productHints: tokens.filter((w) => productHintWords.includes(w) || /^[a-z0-9_-]{2,20}$/i.test(w)).filter((w) => !stopwords.has(w)).slice(0, 6),
      serviceHints: tokens.filter((w) => serviceHintWords.includes(w)).slice(0, 6),
      customerName: commaParts.length > 0 ? commaParts[0] : null,
      customerPhone: phone,
      addressHint: inferredAddress || (hasAny(normalizedText, ['street', 'st', 'road', 'avenue', 'building', 'floor', 'near']) ? message : null),
    },
  };
}

export function chooseReplyLanguage(setting: string | null | undefined, detected: DetectedLanguage): DetectedLanguage {
  if (!setting || setting.toLowerCase() === 'auto-detect') return detected;
  const key = setting.toLowerCase();
  if (key.includes('arab')) return 'arabic';
  if (key.includes('french')) return 'french';
  if (key.includes('spanish')) return 'spanish';
  if (key.includes('arabizi') || key.includes('franco')) return 'arabizi';
  return 'english';
}
