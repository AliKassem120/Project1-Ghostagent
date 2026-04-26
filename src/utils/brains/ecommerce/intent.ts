import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { z } from 'zod';
import { normalizeArabizi, ARABIZI_LLM_HINT } from '@/lib/automation/language/arabizi';
import { parseAndValidateJson } from '@/lib/automation/safe-json';
import { getModelConfig } from '@/lib/automation/model-config';

export const EcommerceIntentNameSchema = z.enum([
    'greeting',
    'product_availability',
    'product_price',
    'product_variants',
    'product_details',
    'shipping_question',
    'location_question',
    'payment_question',
    'return_exchange_question',
    'order_status',
    'purchase_intent',
    'checkout_info',
    'cancel_order',
    'complaint',
    'gratitude_goodbye',
    'human_handoff',
    'unknown',
]);

export const EcommerceIntentSchema = z.object({
    intent: EcommerceIntentNameSchema,
    language_style: z.enum(['english', 'arabic_script', 'lebanese_franco', 'mixed', 'other']),
    product_name: z.string().nullable().describe('The product, category, or item the customer is asking about. Null if not present.'),
    variant: z.string().nullable().describe('Color, size, model, quantity description, or option. Null if not present.'),
    quantity: z.number().int().min(1).max(100).nullable(),
    customer_name: z.string().nullable(),
    customer_phone: z.string().nullable(),
    customer_address: z.string().nullable(),
    order_lookup_name: z.string().nullable(),
    order_lookup_phone: z.string().nullable(),
    topic: z.string().nullable().describe('Short description of the topic if no product is involved.'),
    should_handoff: z.boolean(),
    confidence: z.number().min(0).max(1),
});

export type EcommerceIntentName = z.infer<typeof EcommerceIntentNameSchema>;
export type EcommerceIntent = z.infer<typeof EcommerceIntentSchema>;

const EMPTY_INTENT: EcommerceIntent = {
    intent: 'unknown',
    language_style: 'other',
    product_name: null,
    variant: null,
    quantity: null,
    customer_name: null,
    customer_phone: null,
    customer_address: null,
    order_lookup_name: null,
    order_lookup_phone: null,
    topic: null,
    should_handoff: false,
    confidence: 0.35,
};

function normalize(input: string): string {
    return input
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s$+@._-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function detectLanguageStyle(message: string): EcommerceIntent['language_style'] {
    const hasArabic = /[\u0600-\u06FF]/.test(message);
    const normalized = normalize(message);
    const francoSignals = ['bde', 'bade', 'ade', 'fi', 'mawjud', 'mawjoud', 'ra2m', '3nwen', 'towsil', 'se3r', 'hbb', 'shu'];
    const hasFranco = francoSignals.some((w) => normalized.includes(w));
    const hasEnglishLetters = /[a-z]/i.test(message);

    if (hasArabic && hasEnglishLetters) return 'mixed';
    if (hasArabic) return 'arabic_script';
    if (hasFranco) return 'lebanese_franco';
    if (hasEnglishLetters) return 'english';
    return 'other';
}

function hasAny(text: string, terms: string[]): boolean {
    return terms.some((term) => text.includes(term));
}

function fallbackClassify(message: string): EcommerceIntent {
    const text = normalize(message);
    const lang = detectLanguageStyle(message);
    const base: EcommerceIntent = { ...EMPTY_INTENT, language_style: lang };

    // Pull Arabizi hints for richer classification
    const az = normalizeArabizi(message);
    const { hints } = az;

    if (!text) return { ...base, intent: 'greeting', confidence: 0.5 };

    if (hasAny(text, ['manager', 'human', 'employee', 'agent', 'mwazaf', 'mouazaf', 'حدا', 'موظف'])) {
        return { ...base, intent: 'human_handoff', should_handoff: true, confidence: 0.8 };
    }

    if (hasAny(text, ['thanks', 'thank you', 'thx', 'merci', 'shokran', 'شكرا', 'يسلمو', 'yeslamo', 'ok bye', 'tekram'])) {
        return { ...base, intent: 'gratitude_goodbye', confidence: 0.75 };
    }

    const greetingOnly = ['hi', 'hello', 'hey', 'hii', 'hala', 'marhaba', 'مرحبا', 'اهلا', 'السلام عليكم'];
    if (greetingOnly.includes(text) || greetingOnly.some((g) => text === g)) {
        return { ...base, intent: 'greeting', confidence: 0.7 };
    }

    if (hasAny(text, ['where', 'location', 'address', 'wen', 'wein', 'mahal', 'ma7al', 'وين', 'عنوان']) || hints.asksLocation) {
        return { ...base, intent: 'location_question', confidence: 0.7 };
    }

    if (hasAny(text, ['delivery', 'deliver', 'shipping', 'ship', 'towsil', 'توصيل', 'دليفري'])) {
        return { ...base, intent: 'shipping_question', confidence: 0.7 };
    }

    if (hasAny(text, ['card', 'cash', 'payment', 'pay', 'cod', 'visa', 'mastercard', 'كاش', 'بطاقة'])) {
        return { ...base, intent: 'payment_question', confidence: 0.7 };
    }

    if (hasAny(text, ['return', 'exchange', 'replace', 'badela', 'badel', 'رجع', 'بدل'])) {
        return { ...base, intent: 'return_exchange_question', confidence: 0.7 };
    }

    if (hasAny(text, ['cancel', 'el8e', 'لغاء', 'الغي'])) {
        return { ...base, intent: 'cancel_order', confidence: 0.7 };
    }

    if (hasAny(text, ['status', 'arrived', 'arrive', 'coming', 'where is my order', 'wosel', 'wesel', 'وصل', 'طلبي'])) {
        return { ...base, intent: 'order_status', confidence: 0.65 };
    }

    if (hasAny(text, ['damaged', 'wrong', 'broken', '8alat', 'ghalat', 'mshkle', 'مشكلة', 'غلط'])) {
        return { ...base, intent: 'complaint', confidence: 0.7 };
    }

    // Purchase intent — now also catches Arabizi buy signals
    if (hints.wantsToBuy || hasAny(text, [
        'i want', 'ill take', "i'll take", 'buy', 'order', 'checkout',
        'bde', 'bade', 'badi', 'bde yeha', 'bde yehon', 'bdk ttlob', 'بدي', 'بطلب',
    ])) {
        return { ...base, intent: 'purchase_intent', confidence: 0.72 };
    }

    // Price — also catches Arabizi price words
    if (hints.asksPrice || hasAny(text, ['price', 'how much', 'cost', 'ade', 'adde', 'addesh', 'se3r', 'se3ro', 'كم', 'قديش'])) {
        return { ...base, intent: 'product_price', confidence: 0.7 };
    }

    // Stock / availability
    if (hints.asksStock || hasAny(text, [
        'available', 'in stock', 'still have', 'fi meno', 'mawjud', 'mawjoud', 'موجود', 'في منو',
        'fi men hal', // "fi men hal hoodie"
    ])) {
        return { ...base, intent: 'product_availability', confidence: 0.7 };
    }

    if (hasAny(text, ['size', 'color', 'colour', 'model', 'لون', 'قياس', '2yes', 'lon'])) {
        return { ...base, intent: 'product_variants', confidence: 0.65 };
    }

    return base;
}

export async function classifyEcommerceIntent(args: {
    message: string;
    historyContext?: string;
    contextSummary?: string | null;
    businessLanguage?: string;
    modelName?: string;
}): Promise<EcommerceIntent> {
    const { message, historyContext = '', contextSummary = '', businessLanguage = 'Auto-Detect', modelName = 'llama-3.1-70b-versatile' } = args;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return fallbackClassify(message);

    // Pre-process with Arabizi module
    const az = normalizeArabizi(message);
    const isArabizi = az.detectedStyle === 'lebanese_arabizi' || az.detectedStyle === 'mixed';
    const arabiziHint = isArabizi ? `\n\n${ARABIZI_LLM_HINT}` : '';

    try {
        const groq = createGroq({ apiKey });
        const modelConfig = getModelConfig();
        const result = await generateText({
            model: groq(modelConfig.structuredModel || modelName),
            temperature: 0,
            system: `You are a deterministic e-commerce intent classifier. Return JSON only matching this schema: ${EcommerceIntentSchema.toString()}${arabiziHint}`,
            prompt: `Business language setting: ${businessLanguage}
Conversation summary: ${contextSummary || 'None'}
Recent conversation: ${historyContext || 'None'}
Latest customer message: ${message}
Arabizi hints: ${JSON.stringify({ detectedStyle: az.detectedStyle, hints: az.hints })}`,
        });

        const parsed = parseAndValidateJson(result.text, EcommerceIntentSchema);
        if (!parsed.ok) {
            console.warn('[EcommerceIntent] Invalid JSON output, using fallback:', parsed.error);
            return fallbackClassify(message);
        }

        return parsed.value;
    } catch (error) {
        console.warn('[EcommerceIntent] Classifier failed, using fallback:', error);
        return fallbackClassify(message);
    }
}
