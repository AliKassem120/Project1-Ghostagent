/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — LLM Entity Extraction (Fallback)
 * ═══════════════════════════════════════════════════════════════
 * Lightweight LLM calls for entity extraction ONLY when
 * deterministic matching (regex, fuzzy) fails.
 *
 * The LLM extracts meaning; the DB remains source of truth.
 * Every LLM candidate is verified against the database.
 *
 * Uses Groq's llama-3.3-70b-versatile with JSON mode for
 * fast, structured extraction.
 */

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { v2log } from './logger';

// ── Types ────────────────────────────────────────────────────

export interface ProductExtraction {
    intent: 'purchase_intent' | 'browse' | 'unknown';
    product_candidate: string;
    quantity: number;
    variant: string | null;
    confidence: number;
}

export interface AppointmentExtraction {
    intent: 'booking_intent' | 'inquiry' | 'unknown';
    service_candidate: string;
    date_text: string | null;
    time_text: string | null;
    confidence: number;
}

// ── Model Config ─────────────────────────────────────────────

const EXTRACTION_MODEL = 'llama-3.3-70b-versatile';
const MAX_TOKENS = 150; // Keep it fast — structured output only

function getGroq() {
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    return createGroq({ apiKey: key });
}

// ── Product Extraction ───────────────────────────────────────

/**
 * Use LLM to extract product intent from a messy message.
 * Only called when deterministic extraction + fuzzy matching fail.
 */
export async function llmExtractProduct(
    message: string,
    productNames: string[]
): Promise<ProductExtraction | null> {
    const groq = getGroq();
    if (!groq) return null;

    const productList = productNames.slice(0, 20).join(', ');

    const prompt = `You are a product entity extractor for an e-commerce chatbot.

The user sent this message: "${message}"

Available products: [${productList}]

Extract the product the user wants. Reply with ONLY valid JSON, no markdown:
{
  "intent": "purchase_intent" or "browse" or "unknown",
  "product_candidate": "exact product name from the list above, or best guess",
  "quantity": number (default 1),
  "variant": "size/color if mentioned, or null",
  "confidence": 0.0 to 1.0
}

Rules:
- product_candidate MUST be one of the available products if possible
- If the message is clearly about buying, intent = "purchase_intent"
- If asking about availability/price, intent = "browse"
- If you cannot determine the product at all, set confidence below 0.3
- Understand Arabic, Arabizi (Lebanese Franco-Arabic), English, and mixed languages
- "bade" = "I want", "wa7ad" = "one", "tnen" = "two", "tleta" = "three"`;

    try {
        const { text } = await generateText({
            model: groq(EXTRACTION_MODEL),
            prompt,
            maxOutputTokens: MAX_TOKENS,
            temperature: 0.1, // Low temp for deterministic extraction
        });

        const parsed = parseJsonResponse<ProductExtraction>(text);
        if (!parsed) return null;

        // Sanitize
        parsed.quantity = Math.max(1, Math.min(parsed.quantity || 1, 99));
        parsed.confidence = Math.max(0, Math.min(parsed.confidence || 0, 1));
        parsed.product_candidate = parsed.product_candidate?.trim() || '';
        parsed.variant = parsed.variant?.trim() || null;

        v2log.info('LLM_EXTRACT', 'Product extraction', {
            message: message.slice(0, 80),
            result: parsed,
        });

        return parsed;
    } catch (err) {
        v2log.error('LLM_EXTRACT', 'Product extraction failed', { err });
        return null;
    }
}

// ── Appointment Extraction ───────────────────────────────────

/**
 * Use LLM to extract appointment intent from a messy message.
 * Only called when deterministic service matching fails.
 */
export async function llmExtractAppointment(
    message: string,
    serviceNames: string[]
): Promise<AppointmentExtraction | null> {
    const groq = getGroq();
    if (!groq) return null;

    const serviceList = serviceNames.slice(0, 15).join(', ');

    const prompt = `You are a service/appointment entity extractor for a booking chatbot.

The user sent this message: "${message}"

Available services: [${serviceList}]

Extract the service and scheduling info. Reply with ONLY valid JSON, no markdown:
{
  "intent": "booking_intent" or "inquiry" or "unknown",
  "service_candidate": "exact service name from the list above, or best guess",
  "date_text": "date reference like 'tomorrow', 'friday', 'bukra', or null",
  "time_text": "time reference like '5pm', 'se3a 3', 'ba3d l doher', or null",
  "confidence": 0.0 to 1.0
}

Rules:
- service_candidate MUST be one of the available services if possible
- Extract date/time references as raw text (don't convert them)
- If you cannot determine the service at all, set confidence below 0.3
- Understand Arabic, Arabizi (Lebanese Franco-Arabic), English, and mixed languages
- "bade e7joz" = "I want to book", "bukra" = "tomorrow", "se3a" = "hour/at"
- "7ala2a" = "haircut", "da2n" = "beard"`;

    try {
        const { text } = await generateText({
            model: groq(EXTRACTION_MODEL),
            prompt,
            maxOutputTokens: MAX_TOKENS,
            temperature: 0.1,
        });

        const parsed = parseJsonResponse<AppointmentExtraction>(text);
        if (!parsed) return null;

        // Sanitize
        parsed.confidence = Math.max(0, Math.min(parsed.confidence || 0, 1));
        parsed.service_candidate = parsed.service_candidate?.trim() || '';
        parsed.date_text = parsed.date_text?.trim() || null;
        parsed.time_text = parsed.time_text?.trim() || null;

        v2log.info('LLM_EXTRACT', 'Appointment extraction', {
            message: message.slice(0, 80),
            result: parsed,
        });

        return parsed;
    } catch (err) {
        v2log.error('LLM_EXTRACT', 'Appointment extraction failed', { err });
        return null;
    }
}

// ── JSON Parser ──────────────────────────────────────────────

function parseJsonResponse<T>(text: string): T | null {
    try {
        // Strip markdown code fences if present
        let cleaned = text.trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        }
        return JSON.parse(cleaned) as T;
    } catch {
        // Try to find JSON object in the text
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]) as T;
            } catch {
                return null;
            }
        }
        return null;
    }
}
