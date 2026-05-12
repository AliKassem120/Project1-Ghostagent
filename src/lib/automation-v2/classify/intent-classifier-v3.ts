/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Intent Classifier V3
 * ═══════════════════════════════════════════════════════════════
 * Single lightweight LLM call using llama-3.1-8b-instant for
 * combined intent + entity + language detection in one shot.
 *
 * JSON mode output: {intent, entities, confidence, language}
 * ~50ms latency, ~0.001$ per classification.
 *
 * Falls back to regex classifier if Groq fails.
 */

import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { classifyIntent, type ClassificationResult } from './intent-classifier';
import type { CanonicalIntent } from './normalized-intent';
import { v2log } from '../logger';

// ── Classification Result ────────────────────────────────────

export interface V3ClassificationResult {
    intent: CanonicalIntent;
    confidence: number;
    source: 'regex' | 'llm-8b';
    /** Extracted entities from the message */
    entities: {
        product?: string;
        service?: string;
        date?: string;
        time?: string;
        name?: string;
        phone?: string;
        address?: string;
        quantity?: number;
    };
    /** Detected language */
    language: 'english' | 'arabic' | 'arabizi' | 'french' | 'spanish' | 'mixed';
    /** Classification latency in ms */
    classificationMs: number;
}

// ── Valid Intents ────────────────────────────────────────────

const VALID_INTENTS: CanonicalIntent[] = [
    'greeting', 'purchase_intent', 'booking_intent',
    'order_status', 'appointment_status',
    'cancel_order', 'cancel_appointment', 'cancel_status',
    'product_availability', 'product_price', 'product_details',
    'service_question', 'business_hours', 'location_question',
    'shipping_question', 'human_handoff', 'frustration_stop',
    'correction', 'repeat_last_order', 'modify_order',
    'modify_appointment', 'reschedule_appointment',
    'gratitude', 'goodbye', 'unknown',
];

// ── Classify V3 ──────────────────────────────────────────────

/**
 * Classify intent using a two-stage approach:
 *   1. Regex fast-path for obvious patterns (0ms)
 *   2. LLM 8b classifier for complex/ambiguous messages (~50ms)
 *
 * Returns intent + entities + language in a single call.
 */
export async function classifyIntentV3(
    message: string,
    workspaceType: 'ecommerce' | 'appointments' | 'saas_support',
    context?: { stage?: string; hasPostContext?: boolean }
): Promise<V3ClassificationResult> {
    const startMs = Date.now();

    // ── Stage 1: Regex fast-path ─────────────────────────────
    const regexResult = classifyIntent(message);
    if (regexResult.confidence >= 0.85) {
        return {
            intent: regexResult.intent as CanonicalIntent,
            confidence: regexResult.confidence,
            source: 'regex',
            entities: {},
            language: 'english', // Will be overridden by detectLanguage in orchestrator
            classificationMs: Date.now() - startMs,
        };
    }

    // ── Stage 2: LLM 8b classifier ──────────────────────────
    try {
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });

        const anchorRule = regexResult.confidence >= 0.60 
            ? `\n- Suggested anchor intent from regex pre-filter: ${regexResult.intent} (confidence: ${regexResult.confidence})`
            : '';

        const systemPrompt = `You are a message intent classifier for a ${workspaceType} business.

Given a customer message, return JSON with:
- intent: one of [${VALID_INTENTS.join(', ')}]
- confidence: 0.0 to 1.0
- entities: extracted entities (product, service, date, time, name, phone, address, quantity)
- language: detected language (english, arabic, arabizi, french, spanish, mixed)

Rules:
- "arabizi" = Latin letters with numbers (3=ع, 7=ح, 2=ء, 5=خ, 8=غ)
- If message has Arabic script mixed with Latin, language = "mixed" or "arabizi"
- For ${workspaceType === 'appointments' ? 'booking/service' : 'purchase/product'} businesses
- Current state: ${context?.stage || 'idle'}${anchorRule}
- Return ONLY valid JSON, no explanation.`;

        const result = await generateText({
            model: groq('llama-3.1-8b-instant'),
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message },
            ],
            maxOutputTokens: 150,
            temperature: 0.1,
        });

        const classificationMs = Date.now() - startMs;

        // Parse JSON response
        const text = result.text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in response');

        const parsed = JSON.parse(jsonMatch[0]);

        // Validate intent
        const intent = VALID_INTENTS.includes(parsed.intent) ? parsed.intent : 'unknown';
        const confidence = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;

        v2log.info('CLASSIFIER_V3', `8b classified: ${intent} (${confidence})`, {
            classificationMs,
            entities: parsed.entities,
            language: parsed.language,
        });

        return {
            intent,
            confidence,
            source: 'llm-8b',
            entities: parsed.entities || {},
            language: parsed.language || 'english',
            classificationMs,
        };
    } catch (error: any) {
        v2log.warn('CLASSIFIER_V3', '8b classification failed, falling back to regex', {
            error: error.message,
        });

        // Fallback to regex result (even if low confidence)
        return {
            intent: (regexResult.intent || 'unknown') as CanonicalIntent,
            confidence: regexResult.confidence || 0,
            source: 'regex',
            entities: {},
            language: 'english',
            classificationMs: Date.now() - startMs,
        };
    }
}
