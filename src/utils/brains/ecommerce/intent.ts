import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { z } from 'zod';
import { normalizeArabizi, ARABIZI_LLM_HINT } from '@/lib/automation/language/arabizi';

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
    product_name: z.string().nullable(),
    variant: z.string().nullable(),
    quantity: z.number().nullable(),
    customer_name: z.string().nullable(),
    customer_phone: z.string().nullable(),
    customer_address: z.string().nullable(),
    order_lookup_name: z.string().nullable(),
    order_lookup_phone: z.string().nullable(),
    topic: z.string().nullable(),
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
    const hasFranco = ['bde', 'bade', 'ade', 'fi', 'mawjud', 'ra2m', '3nwen', 'towsil'].some((w) => normalized.includes(w));
    const hasEnglish = /[a-z]/i.test(message);

    if (hasArabic && hasEnglish) return 'mixed';
    if (hasArabic) return 'arabic_script';
    if (hasFranco) return 'lebanese_franco';
    if (hasEnglish) return 'english';
    return 'other';
}

function hasAny(text: string, terms: string[]): boolean {
    return terms.some((term) => text.includes(term));
}

export function fallbackClassify(message: string): EcommerceIntent {
    const text = normalize(message);
    const lang = detectLanguageStyle(message);
    const base: EcommerceIntent = { ...EMPTY_INTENT, language_style: lang };
    const az = normalizeArabizi(message);
    const { hints } = az;

    if (!text) return { ...base, intent: 'greeting', confidence: 0.5 };

    if (hasAny(text, ['manager', 'human', 'employee', 'agent', 'mwazaf', 'موظف'])) {
        return { ...base, intent: 'human_handoff', should_handoff: true, confidence: 0.8 };
    }

    if (hasAny(text, ['thanks', 'thank you', 'merci', 'shokran', 'شكرا', 'يسلمو'])) {
        return { ...base, intent: 'gratitude_goodbye', confidence: 0.75 };
    }

    const greetings = ['hi', 'hello', 'hey', 'hala', 'marhaba', 'مرحبا', 'اهلا'];
    if (greetings.includes(text)) {
        return { ...base, intent: 'greeting', confidence: 0.7 };
    }

    if (hasAny(text, ['where', 'location', 'address', 'wen', 'wain', 'وين', 'عنوان']) || hints.asksLocation) {
        return { ...base, intent: 'location_question', confidence: 0.7 };
    }

    if (hints.wantsToBuy || hasAny(text, ['i want', 'buy', 'order', 'checkout', 'bde', 'bade', 'badi', 'بدي', 'بطلب'])) {
        return { ...base, intent: 'purchase_intent', confidence: 0.72 };
    }

    if (hints.asksPrice || hasAny(text, ['price', 'how much', 'ade', 'adde', 'addesh', 'se3r', 'كم', 'قديش'])) {
        return { ...base, intent: 'product_price', confidence: 0.7 };
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

    const az = normalizeArabizi(message);
    const isArabizi = az.detectedStyle === 'lebanese_arabizi' || az.detectedStyle === 'mixed';
    const arabiziHint = isArabizi ? "\n\n" : '';

    try {
        const groq = createGroq({ apiKey });
        const result = await generateText({
            model: groq(modelName),
            temperature: 0,
            system: "You classify customer DMs for an e-commerce business. Return ONLY valid JSON matching the requested schema. No markdown, no prose.",
            prompt: "Latest customer message: \"\"\nRecent history: \n\nReturn JSON with fields: { \"intent\": \"...\", \"language_style\": \"...\", \"product_name\": string | null, \"variant\": string | null, \"quantity\": number | null, \"customer_name\": string | null, \"customer_phone\": string | null, \"customer_address\": string | null, \"should_handoff\": boolean, \"confidence\": number }",
        });

        const parsed = JSON.parse(result.text);
        const validated = EcommerceIntentSchema.safeParse(parsed);
        
        if (validated.success) {
            return validated.data;
        } else {
            console.warn('[EcommerceIntent] Validation failed:', validated.error);
            return fallbackClassify(message);
        }
    } catch (error) {
        console.warn('[EcommerceIntent] Classifier failed, using fallback:', error);
        return fallbackClassify(message);
    }
}
