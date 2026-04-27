/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Model Layer
 * ═══════════════════════════════════════════════════════════════
 * Centralized LLM calls. Uses generateText + safe JSON parse
 * instead of generateObject to avoid Groq json_schema errors.
 *
 * Responsibilities:
 * - Centralize model names
 * - Safe JSON extraction from text
 * - Zod validation on parsed result
 * - Deterministic fallback when parse fails
 */

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { z } from 'zod';
import { v2log } from './logger';

// ── Model Configuration ──────────────────────────────────────

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

function getGroqClient() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;
    return createGroq({ apiKey });
}

// ── Safe JSON Extraction ─────────────────────────────────────

function extractJsonFromText(text: string): string | null {
    // Try to find JSON object in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return jsonMatch[0];

    // Try to find JSON array
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) return arrayMatch[0];

    return null;
}

function safeJsonParse(text: string): any | null {
    const jsonStr = extractJsonFromText(text);
    if (!jsonStr) return null;

    try {
        return JSON.parse(jsonStr);
    } catch {
        return null;
    }
}

// ── Typed LLM Call ───────────────────────────────────────────

/**
 * Calls the LLM and extracts structured data using Zod validation.
 * Uses generateText (not generateObject) to avoid json_schema errors.
 *
 * Returns the validated object, or null if parsing/validation fails.
 */
export async function classifyWithLLM<T extends z.ZodTypeAny>(args: {
    systemPrompt: string;
    userPrompt: string;
    schema: T;
    modelName?: string;
    temperature?: number;
}): Promise<z.infer<T> | null> {
    const { systemPrompt, userPrompt, schema, modelName = DEFAULT_MODEL, temperature = 0 } = args;

    const groq = getGroqClient();
    if (!groq) {
        v2log.warn('V2_MODEL', 'No GROQ_API_KEY — skipping LLM classification');
        return null;
    }

    try {
        const result = await generateText({
            model: groq(modelName),
            system: `${systemPrompt}\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation, no code fences.`,
            prompt: userPrompt,
            temperature,
        });

        const parsed = safeJsonParse(result.text);
        if (!parsed) {
            v2log.warn('V2_MODEL', 'Failed to extract JSON from LLM response', {
                responseLength: result.text.length,
                responsePreview: result.text.slice(0, 200),
            });
            return null;
        }

        const validated = schema.safeParse(parsed);
        if (!validated.success) {
            v2log.warn('V2_MODEL', 'LLM response failed Zod validation', {
                errors: validated.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`),
            });
            return null;
        }

        return validated.data;

    } catch (err: any) {
        v2log.error('V2_MODEL', 'LLM call failed', {
            model: modelName,
            error: err?.message || String(err),
        });

        // Retry with fallback model if primary fails
        if (modelName !== FALLBACK_MODEL) {
            v2log.info('V2_MODEL', `Retrying with fallback model: ${FALLBACK_MODEL}`);
            return classifyWithLLM({ ...args, modelName: FALLBACK_MODEL });
        }

        return null;
    }
}

import { ARABIZI_DICTIONARY } from './dictionaries';

/**
 * Translate/polish a template reply into the target language.
 * Uses a manual dictionary for Arabizi to ensure quality.
 */
export async function translateReply(args: {
    reply: string;
    targetLanguage: string;
    tone?: string;
}): Promise<string> {
    const { reply, targetLanguage, tone = 'Professional' } = args;

    // 1. Skip if already English
    if (targetLanguage === 'english' || targetLanguage === 'English' || targetLanguage === 'Auto-Detect') {
        return reply;
    }

    // 2. Dictionary Lookup for Arabizi
    if (targetLanguage.toLowerCase() === 'arabizi') {
        // Try exact match first
        if (ARABIZI_DICTIONARY[reply]) return ARABIZI_DICTIONARY[reply];

        // Try fuzzy/pattern match for templates with placeholders
        for (const [english, arabizi] of Object.entries(ARABIZI_DICTIONARY)) {
            // Convert template like "Perfect — your {serviceName}..." 
            // into regex "Perfect — your (.*)..."
            const pattern = english.replace(/\{[a-zA-Z_]+\}/g, '(.*?)');
            const regex = new RegExp(`^${pattern}$`, 'i');
            const match = reply.match(regex);

            if (match) {
                // If we found a match, we need to extract the values from the English string
                // and inject them into the Arabizi string.
                let result = arabizi;
                const placeholders = english.match(/\{[a-zA-Z_]+\}/g) || [];
                
                placeholders.forEach((placeholder, index) => {
                    const value = match[index + 1];
                    result = result.replace(placeholder, value || '');
                });
                
                return result;
            }
        }
    }

    // 3. LLM Fallback (for non-dictionary items or other languages)
    const groq = getGroqClient();
    if (!groq) return reply;

    try {
        const result = await generateText({
            model: groq(FALLBACK_MODEL),
            system: `You are a translation assistant. Translate the following DM reply into ${targetLanguage}. 
Keep it short (1-2 sentences max), natural, and DM-appropriate. 
Tone: ${tone}. 
If the target is Arabizi, use Lebanese dialect with Latin characters and numbers (3, 7, 5, etc.).
Return ONLY the translated text, nothing else.`,
            prompt: reply,
            temperature: 0.1,
        });

        const translated = result.text.trim();
        if (translated && translated.length > 0 && translated.length < 400) {
            return translated;
        }
        return reply;
    } catch {
        return reply;
    }
}
