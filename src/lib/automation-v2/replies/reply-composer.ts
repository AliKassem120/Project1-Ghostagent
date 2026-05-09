import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { v2log } from '../logger';

const MODEL = 'llama-3.3-70b-versatile';

function getGroq() {
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    return createGroq({ apiKey: key });
}

export interface ReplyComposerInput {
    baselineReply: string;
    language: string;
    workspaceType: 'ecommerce' | 'appointments' | 'saas_support';
    actions: string[];
    dbWriteAttempted: boolean;
    dbWriteSuccess: boolean;
    tone?: string;
}

/**
 * Transforms deterministic handler output (baselineReply) into natural language.
 * Enforces strict factual consistency and handles language differences.
 */
export async function composeNaturalReply(input: ReplyComposerInput): Promise<string> {
    const { baselineReply, language, tone = 'Professional', actions } = input;

    if (!baselineReply) return '';

    // Pass 1: Handle Arabizi
    // The FSM already applies the ARABIZI_DICTIONARY string via the t() function.
    // The user requested we use the interpolated template strictly for Arabizi.
    // We return it exactly as-is to prevent hallucinated grammar.
    const isArabizi = language === 'arabizi' || language === 'arabic' || language === 'mixed' || language === 'lebanese franco';
    if (isArabizi) {
        v2log.info('REPLY_COMPOSER', 'Using deterministic Arabizi dictionary reply', { baselineReply });
        return baselineReply;
    }

    // Pass 2: Handle non-transactional or generic fallback
    // If it's just a routing action or unknown, we don't need heavy composition.
    if (actions.length === 0 || actions.includes('greeting') || actions.includes('handoff')) {
        return baselineReply;
    }

    // Pass 3: English / Spanish / French LLM Naturalization
    const groq = getGroq();
    if (!groq) return baselineReply; // Fallback to safe baseline

    const systemPrompt = `You are a ${tone} customer service agent.
Your ONLY job is to rephrase the factual baseline reply below so it sounds natural and human.
Rules:
1. Do NOT invent or change any facts (prices, quantities, statuses, requirements).
2. Do NOT add new requirements (if it asks for name and phone, do not ask for email).
3. Do NOT claim an order or appointment succeeded unless the baseline says it did.
4. Keep it short, concise, and fit for an Instagram DM.
5. You must reply in the user's language: ${language}.
6. Output ONLY the final reply string. No quotes, no markdown.`;

    try {
        const { text } = await generateText({
            model: groq(MODEL),
            system: systemPrompt,
            prompt: `Baseline Reply: "${baselineReply}"\n\nNaturalized Reply:`,
            temperature: 0.2, // Low temp for factual safety
            maxOutputTokens: 150,
        });

        const naturalReply = text.trim();
        
        // Safety fallback: if LLM output is empty or went rogue, use baseline
        if (!naturalReply || naturalReply.length > baselineReply.length * 3) {
            v2log.warn('REPLY_COMPOSER', 'LLM output rejected (too long or empty)', { naturalReply });
            return baselineReply;
        }

        v2log.info('REPLY_COMPOSER', 'Composed natural reply', { 
            baseline: baselineReply, 
            natural: naturalReply 
        });
        return naturalReply;

    } catch (err) {
        v2log.warn('REPLY_COMPOSER', 'LLM generation failed, using baseline', { error: err });
        return baselineReply; // Always fallback safely
    }
}
