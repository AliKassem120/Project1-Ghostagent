import { createGroq } from '@ai-sdk/groq';
import { generateObject } from 'ai';
import { z } from 'zod';

export const AppointmentIntentNameSchema = z.enum([
    'greeting',
    'business_hours',
    'appointment_availability',
    'book_appointment',
    'service_question',
    'price_question',
    'duration_question',
    'location_question',
    'cancel_appointment',
    'reschedule_appointment',
    'late_arrival',
    'gratitude_goodbye',
    'human_handoff',
    'unknown',
]);

export const AppointmentIntentSchema = z.object({
    intent: AppointmentIntentNameSchema,
    language_style: z.enum(['english', 'arabic_script', 'lebanese_franco', 'mixed', 'other']),
    day: z.string().nullable().describe('Day name or relative day, e.g. monday, sunday, today, tomorrow, tanen, a7ad.'),
    date: z.string().nullable().describe('ISO date YYYY-MM-DD if clear. Null otherwise.'),
    time: z.string().nullable().describe('Time if clear, e.g. 16:00, 4pm, se3a 4.'),
    service_name: z.string().nullable(),
    customer_name: z.string().nullable(),
    customer_phone: z.string().nullable(),
    should_handoff: z.boolean(),
    confidence: z.number().min(0).max(1),
});

export type AppointmentIntentName = z.infer<typeof AppointmentIntentNameSchema>;
export type AppointmentIntent = z.infer<typeof AppointmentIntentSchema>;

const EMPTY_INTENT: AppointmentIntent = {
    intent: 'unknown',
    language_style: 'other',
    day: null,
    date: null,
    time: null,
    service_name: null,
    customer_name: null,
    customer_phone: null,
    should_handoff: false,
    confidence: 0.35,
};

function normalize(input: string): string {
    return input
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s:.-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function detectLanguageStyle(message: string): AppointmentIntent['language_style'] {
    const hasArabic = /[\u0600-\u06FF]/.test(message);
    const text = normalize(message);
    const hasFranco = ['bde', 'bade', 'ade', 'se3a', 'maw3ed', 'tanen', 'a7ad', 'btefta7', 'btfta7', 'l tnen', 'l a7ad'].some((w) => text.includes(w));
    const hasEnglish = /[a-z]/i.test(message);

    if (hasArabic && hasEnglish) return 'mixed';
    if (hasArabic) return 'arabic_script';
    if (hasFranco) return 'lebanese_franco';
    if (hasEnglish) return 'english';
    return 'other';
}

function hasAny(text: string, words: string[]) {
    return words.some((w) => text.includes(w));
}

function fallbackClassify(message: string): AppointmentIntent {
    const text = normalize(message);
    const lang = detectLanguageStyle(message);
    const base: AppointmentIntent = { ...EMPTY_INTENT, language_style: lang };

    if (hasAny(text, ['manager', 'human', 'employee', 'mwazaf', 'موظف'])) {
        return { ...base, intent: 'human_handoff', should_handoff: true, confidence: 0.8 };
    }

    if (hasAny(text, ['thanks', 'thank you', 'shokran', 'شكرا', 'يسلمو', 'ok bye'])) {
        return { ...base, intent: 'gratitude_goodbye', confidence: 0.75 };
    }

    if (['hi', 'hello', 'hey', 'hala', 'marhaba', 'مرحبا', 'اهلا'].includes(text)) {
        return { ...base, intent: 'greeting', confidence: 0.7 };
    }

    if (hasAny(text, ['open', 'close', 'opening', 'closing', 'hours', 'btefta7', 'btfta7', 'bt2aflo', 'aya se3a', 'اي ساعة', 'بتفتح', 'متى بتفتح'])) {
        return { ...base, intent: 'business_hours', confidence: 0.8 };
    }

    if (hasAny(text, ['available', 'availability', 'slot', 'appointment', 'maw3ed', 'ma3ed', 'fi mahal', 'في محل', 'موعد'])) {
        return { ...base, intent: 'appointment_availability', confidence: 0.75 };
    }

    if (hasAny(text, ['book', 'reserve', 'confirm', 'b7ajez', 'حجز', 'احجز'])) {
        return { ...base, intent: 'book_appointment', confidence: 0.75 };
    }

    if (hasAny(text, ['price', 'cost', 'how much', 'ade', 'قديش', 'كم'])) {
        return { ...base, intent: 'price_question', confidence: 0.7 };
    }

    if (hasAny(text, ['how long', 'duration', 'takes', 'adde btekhod', 'قديش بتاخد'])) {
        return { ...base, intent: 'duration_question', confidence: 0.7 };
    }

    if (hasAny(text, ['where', 'location', 'address', 'wen', 'وين', 'عنوان'])) {
        return { ...base, intent: 'location_question', confidence: 0.7 };
    }

    return base;
}

export async function classifyAppointmentIntent(args: {
    message: string;
    historyContext?: string;
    contextSummary?: string | null;
    businessLanguage?: string;
    modelName?: string;
}): Promise<AppointmentIntent> {
    const { message, historyContext = '', contextSummary = '', businessLanguage = 'Auto-Detect', modelName = 'llama-3.3-70b-versatile' } = args;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return fallbackClassify(message);

    try {
        const groq = createGroq({ apiKey });
        const result = await generateObject({
            model: groq(modelName),
            schema: AppointmentIntentSchema,
            temperature: 0,
            system: `You classify customer DMs for an appointment-based business. Return only structured data.

Critical distinction:
- business_hours means the customer asks when the business opens/closes or whether it is open on a day. Examples: "do you open Sunday", "aya se3a btefta7o l tanen", "كل يوم؟", "اي ساعة بتفتح؟".
- appointment_availability means the customer asks whether a booking slot is available. Examples: "fi mahal se3a 4", "do you have an appointment tomorrow", "available at 5?".
- book_appointment means customer is choosing/confirming a concrete service/date/time.
- service_question asks what services exist.
- price_question asks service cost.
- duration_question asks how long service takes.
- location_question asks address/location.

Never classify an opening-time question as appointment_availability. Never classify a slot question as business_hours.
Understand English, Arabic script, and Lebanese Franco/Arabizi.`, 
            prompt: `Business language setting: ${businessLanguage}

Conversation summary:
${contextSummary || 'None'}

Recent conversation:
${historyContext || 'None'}

Latest customer message:
${message}`,
        });

        return result.object;
    } catch (error) {
        console.warn('[AppointmentIntent] Classifier failed, using fallback:', error);
        return fallbackClassify(message);
    }
}
