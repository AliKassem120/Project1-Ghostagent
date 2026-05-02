/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Model Layer
 * ═══════════════════════════════════════════════════════════════
 * Centralized LLM helper. Used for structured classification
 * when needed (e.g., future features). The main agent uses
 * generateText directly — no wrapper needed.
 */

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { z } from 'zod';
import { v2log } from './logger';

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

function getGroqClient() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;
    return createGroq({ apiKey });
}

// ── Safe JSON Extraction ─────────────────────────────────────

function extractJsonFromText(text: string): string | null {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return jsonMatch[0];
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) return arrayMatch[0];
    return null;
}

function safeJsonParse(text: string): any | null {
    const jsonStr = extractJsonFromText(text);
    if (!jsonStr) return null;
    try { return JSON.parse(jsonStr); } catch { return null; }
}

// ── Typed LLM Call ───────────────────────────────────────────

export async function classifyWithLLM<T extends z.ZodTypeAny>(args: {
    systemPrompt: string;
    userPrompt: string;
    schema: T;
    modelName?: string;
    temperature?: number;
}): Promise<z.infer<T> | null> {
    const { systemPrompt, userPrompt, schema, modelName = DEFAULT_MODEL, temperature = 0 } = args;

    const groq = getGroqClient();
    if (!groq) return null;

    try {
        const result = await generateText({
            model: groq(modelName),
            system: `${systemPrompt}\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation.`,
            prompt: userPrompt,
            temperature,
        });

        const parsed = safeJsonParse(result.text);
        if (!parsed) {
            v2log.warn('MODEL', 'Failed to extract JSON', { preview: result.text.slice(0, 200) });
            return null;
        }

        const validated = schema.safeParse(parsed);
        if (!validated.success) {
            v2log.warn('MODEL', 'Zod validation failed', { errors: validated.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`) });
            return null;
        }

        return validated.data;
    } catch (err: any) {
        v2log.error('MODEL', 'LLM call failed', { model: modelName, error: err?.message || String(err) });
        if (modelName !== FALLBACK_MODEL) {
            return classifyWithLLM({ ...args, modelName: FALLBACK_MODEL });
        }
        return null;
    }
}
