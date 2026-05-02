import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { V3DecisionSchema, type V3Decision, type V3BusinessContext } from './schema';
import { buildV3SystemPrompt } from './prompt';

const MODEL = 'llama-3.3-70b-versatile';
const FALLBACK: V3Decision = {
    reply: "I couldn't check that properly. Can you send it again?",
    intent: 'general',
    memoryPatch: { mode: 'browse' },
    action: null,
};

function getGroqClient() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;
    return createGroq({ apiKey });
}

function extractJson(text: string): unknown | null {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
        return JSON.parse(match[0]);
    } catch {
        return null;
    }
}

export async function decideV3(args: {
    ctx: V3BusinessContext;
    customerMessage: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<V3Decision> {
    const groq = getGroqClient();
    if (!groq) return FALLBACK;

    try {
        const result = await generateText({
            model: groq(MODEL),
            system: buildV3SystemPrompt(args.ctx),
            messages: [
                ...args.history.slice(-12),
                { role: 'user' as const, content: args.customerMessage },
            ],
            temperature: 0.35,
        });

        const parsed = extractJson(result.text);
        const validated = V3DecisionSchema.safeParse(parsed);
        if (!validated.success) return FALLBACK;

        return validated.data;
    } catch {
        return FALLBACK;
    }
}
