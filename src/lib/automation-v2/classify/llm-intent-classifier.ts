/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Structured LLM Intent Classifier
 * ═══════════════════════════════════════════════════════════════
 * Semantic understanding layer for complex/ambiguous messages.
 *
 * Architecture:
 *   LLM understands → Code acts → Database proves → Guard protects
 *
 * The LLM ONLY returns structured NormalizedIntent JSON.
 * It does NOT:
 *   - create/cancel/update orders
 *   - book/cancel/reschedule appointments
 *   - generate customer-facing replies
 *   - claim any action succeeded
 *
 * Uses Groq's llama-3.3-70b-versatile with strict JSON mode.
 * Validated with Zod — invalid output returns safe unknown fallback.
 */

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { z } from 'zod';
import type { NormalizedIntent, CanonicalIntent, IntentScope, IntentOrdinal } from './normalized-intent';
import { isTransactionalIntent } from './normalized-intent';
import { v2log } from '../logger';

// ── Zod Schema ──────────────────────────────────────────────

const EntitiesSchema = z.object({
    // Product / service identifiers
    product: z.string().optional(),
    productId: z.string().optional(),
    service: z.string().optional(),
    serviceId: z.string().optional(),
    // Product attributes
    quantity: z.number().optional(),
    color: z.string().optional(),
    size: z.string().optional(),
    variant: z.string().optional(),
    // Customer info
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    address: z.string().optional(),
    // Scheduling
    date: z.string().optional(),
    time: z.string().optional(),
    // Reference IDs
    orderId: z.string().optional(),
    appointmentId: z.string().optional(),
    // Reuse flags (repeat order / same-customer flows)
    reuseName: z.boolean().optional(),
    reusePhone: z.boolean().optional(),
    reuseAddress: z.boolean().optional(),
    // Changed fields (repeat with modifications)
    changedAddress: z.string().optional(),
    changedPhone: z.string().optional(),
    changedQuantity: z.number().optional(),
    changedVariant: z.string().optional(),
    // Context references
    replyToMessageId: z.string().optional(),
    mediaType: z.enum(['voice', 'image', 'video', 'post', 'reel', 'story']).optional(),
}).passthrough();

const LLMIntentSchema = z.object({
    intent: z.string(),
    confidence: z.number().min(0).max(1),
    target: z.string().optional(),
    action: z.string().optional(),
    scope: z.string().optional(),
    count: z.number().optional(),
    ordinal: z.string().optional(),
    entities: EntitiesSchema.optional(),
    isTransactional: z.boolean(),
    needsClarification: z.boolean(),
    language: z.string(),
    source: z.literal('llm').optional(),
});

// ── Model Config ────────────────────────────────────────────

const CLASSIFIER_MODEL = 'llama-3.3-70b-versatile';
const MAX_TOKENS = 300;

function getGroq() {
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    return createGroq({ apiKey: key });
}

// ── Safe Fallback ───────────────────────────────────────────

export function safeFallbackIntent(): NormalizedIntent {
    return {
        intent: 'unknown',
        confidence: 0,
        entities: {},
        isTransactional: false,
        needsClarification: true,
        language: 'unknown',
        source: 'llm',
    };
}

// ── Prompt Builder ──────────────────────────────────────────

function buildClassifierPrompt(
    message: string,
    workspaceType: 'ecommerce' | 'appointments',
    context?: { stage?: string; recentProduct?: string; recentService?: string }
): string {
    const contextBlock = context
        ? `\nConversation context:\n- Active stage: ${context.stage || 'idle'}\n- Recent product: ${context.recentProduct || 'none'}\n- Recent service: ${context.recentService || 'none'}`
        : '';

    return `You are NOT a chatbot reply generator.
You are an intent classifier for a business automation system.
Return ONLY valid JSON matching the schema below.
Do NOT include explanations, markdown, or customer-facing replies.
Do NOT claim any action succeeded.

Schema:
{
  "intent": string (one of the canonical intents below),
  "confidence": number 0.0-1.0,
  "target": "product" | "order" | "appointment" | "service" | "business" | "conversation" (optional),
  "action": "query" | "create" | "update" | "cancel" | "confirm" | "reject" | "repeat" | "handoff" | "clarify" (optional),
  "scope": "none" | "latest" | "all" | "all_pending" | "count" | "ordinal" | "specific_id" | "product_reference" (optional),
  "count": number (optional, when scope=count),
  "ordinal": "first" | "second" | "third" | "last" | "latest" (optional, when scope=ordinal),
  "entities": {
    "product": string, "color": string, "size": string, "variant": string,
    "quantity": number,
    "customerName": string, "customerPhone": string, "address": string,
    "date": string, "time": string,
    "reuseName": boolean, "reusePhone": boolean, "reuseAddress": boolean,
    "changedAddress": string, "changedPhone": string, "changedQuantity": number
  } (optional fields),
  "isTransactional": boolean,
  "needsClarification": boolean,
  "language": "english" | "arabizi" | "arabic" | "mixed"
}

Business type: ${workspaceType}
${workspaceType === 'ecommerce' ? 'Intents: product queries, orders, cancellations, shipping, payment, returns, discounts, business info' : 'Intents: services, availability, booking, reschedule, cancellation, policies, business info'}

Instagram and WhatsApp are channels only. Do NOT create platform-specific intents.
${contextBlock}

Canonical intents:
Universal: greeting, gratitude, goodbye, correction, clarification_request, human_handoff, frustration_stop, unsupported_message, unknown
Ecommerce: product_availability, product_price, product_details, product_variant_question, catalog_browse, product_recommendation, product_reference, purchase_intent, provide_order_details, confirm_order, reject_order, repeat_last_order, modify_order, cancel_order, cancel_status, order_status, order_summary, payment_question, delivery_question, return_refund_question, shipping_question, discount_question
Appointments: service_question, service_price, service_duration, availability_question, booking_intent, provide_datetime, provide_appointment_details, confirm_appointment, reject_appointment, reschedule_appointment, cancel_appointment, appointment_status
Business: business_hours, location_question, policy_question, payment_methods_question

Examples:
"cancel both orders" → {"intent":"cancel_order","confidence":0.95,"target":"order","action":"cancel","scope":"count","count":2,"entities":{},"isTransactional":true,"needsClarification":false,"language":"english"}
"cancel all pending orders" → {"intent":"cancel_order","confidence":0.95,"scope":"all_pending","entities":{},"isTransactional":true,"needsClarification":false,"language":"english"}
"cancel the second one not the first" → {"intent":"cancel_order","confidence":0.95,"scope":"ordinal","ordinal":"second","entities":{},"isTransactional":true,"needsClarification":false,"language":"english"}
"add one more same phone and address" → {"intent":"repeat_last_order","confidence":0.95,"target":"order","action":"repeat","scope":"latest","entities":{"reusePhone":true,"reuseAddress":true,"quantity":1},"isTransactional":true,"needsClarification":false,"language":"english"}
"same one again but to my other address in Zeleya" → {"intent":"repeat_last_order","confidence":0.92,"entities":{"changedAddress":"Zeleya"},"isTransactional":true,"needsClarification":false,"language":"english"}
"I want a crewneck black size L same name and number change address to Zeleya" → {"intent":"purchase_intent","confidence":0.95,"target":"order","action":"create","entities":{"product":"crewneck","color":"black","size":"L","reuseName":true,"reusePhone":true,"address":"Zeleya"},"isTransactional":true,"needsClarification":false,"language":"english"}
"can I pay when it arrives" → {"intent":"payment_methods_question","confidence":0.92,"target":"business","action":"query","entities":{},"isTransactional":false,"needsClarification":false,"language":"english"}
"book me like last time" → {"intent":"booking_intent","confidence":0.80,"target":"appointment","action":"create","entities":{},"isTransactional":true,"needsClarification":true,"language":"english"}
"can you move my appointment to Friday at 5" → {"intent":"reschedule_appointment","confidence":0.95,"target":"appointment","action":"update","entities":{"date":"Friday","time":"5"},"isTransactional":true,"needsClarification":false,"language":"english"}
"cancel tomorrow's appointment" → {"intent":"cancel_appointment","confidence":0.95,"target":"appointment","action":"cancel","entities":{"date":"tomorrow"},"isTransactional":true,"needsClarification":false,"language":"english"}
"ma bde yeh ba2a" → {"intent":"cancel_order","confidence":0.90,"entities":{},"isTransactional":true,"needsClarification":false,"language":"arabizi"}
"bde we7de tene same ra2em" → {"intent":"repeat_last_order","confidence":0.92,"entities":{"reusePhone":true,"quantity":1},"isTransactional":true,"needsClarification":false,"language":"arabizi"}
"that one" → {"intent":"product_reference","confidence":0.60,"entities":{},"isTransactional":false,"needsClarification":true,"language":"english"}
"where are you located" → {"intent":"location_question","confidence":0.95,"target":"business","action":"query","entities":{},"isTransactional":false,"needsClarification":false,"language":"english"}
"do you do cash on delivery" → {"intent":"payment_methods_question","confidence":0.95,"target":"business","action":"query","entities":{},"isTransactional":false,"needsClarification":false,"language":"english"}
"can u remove the two things I ordered" → {"intent":"cancel_order","confidence":0.93,"target":"order","action":"cancel","scope":"count","count":2,"entities":{},"isTransactional":true,"needsClarification":false,"language":"english"}
"what if I'm late?" → {"intent":"policy_question","confidence":0.88,"target":"business","action":"query","entities":{},"isTransactional":false,"needsClarification":false,"language":"english"}
"I meant the one from the post" → {"intent":"product_reference","confidence":0.70,"entities":{},"isTransactional":false,"needsClarification":true,"language":"english"}

Now classify this message:
"${message}"`;
}

// ── JSON Parser ─────────────────────────────────────────────

function parseJsonResponse(text: string): unknown | null {
    try {
        let cleaned = text.trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        }
        return JSON.parse(cleaned);
    } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch { return null; }
        }
        return null;
    }
}

// ── Main Classifier ─────────────────────────────────────────

/**
 * Classify intent using LLM. Returns NormalizedIntent.
 * On any failure (no API key, timeout, invalid JSON), returns safe unknown fallback.
 * 
 * This function is READ-ONLY. It never performs business actions.
 */
export async function classifyIntentWithLLM(
    message: string,
    workspaceType: 'ecommerce' | 'appointments',
    context?: { stage?: string; recentProduct?: string; recentService?: string }
): Promise<NormalizedIntent> {
    const groq = getGroq();
    if (!groq) {
        v2log.warn('LLM_CLASSIFIER', 'No GROQ_API_KEY — skipping LLM classification');
        return safeFallbackIntent();
    }

    const prompt = buildClassifierPrompt(message, workspaceType, context);

    try {
        const { text } = await generateText({
            model: groq(CLASSIFIER_MODEL),
            prompt,
            maxOutputTokens: MAX_TOKENS,
            temperature: 0.1,
        });

        const raw = parseJsonResponse(text);
        if (!raw) {
            v2log.warn('LLM_CLASSIFIER', 'Invalid JSON from LLM', { text: text.slice(0, 200) });
            return safeFallbackIntent();
        }

        // Validate with Zod
        const parsed = LLMIntentSchema.safeParse(raw);
        if (!parsed.success) {
            v2log.warn('LLM_CLASSIFIER', 'Zod validation failed', {
                errors: parsed.error.issues.map(i => i.message).join(', '),
                raw: JSON.stringify(raw).slice(0, 200),
            });
            return safeFallbackIntent();
        }

        const data = parsed.data;

        // Build NormalizedIntent from validated data
        const intent: NormalizedIntent = {
            intent: data.intent as CanonicalIntent,
            confidence: data.confidence,
            target: data.target as NormalizedIntent['target'],
            action: data.action as NormalizedIntent['action'],
            scope: data.scope as IntentScope,
            count: data.count,
            ordinal: data.ordinal as IntentOrdinal,
            entities: (data.entities || {}) as NormalizedIntent['entities'],
            isTransactional: data.isTransactional ?? isTransactionalIntent(data.intent as CanonicalIntent),
            needsClarification: data.confidence < 0.70 ? true : (data.needsClarification ?? false),
            language: data.language || 'unknown',
            source: 'llm',
        };

        v2log.info('LLM_CLASSIFIER', 'Classification result', {
            message: message.slice(0, 80),
            intent: intent.intent,
            confidence: intent.confidence,
            scope: intent.scope,
            entities: intent.entities,
            needsClarification: intent.needsClarification,
        });

        return intent;

    } catch (err) {
        v2log.error('LLM_CLASSIFIER', 'LLM classification failed', { error: err });
        return safeFallbackIntent();
    }
}

// ── Exported for testing ────────────────────────────────────

export { LLMIntentSchema, buildClassifierPrompt, parseJsonResponse };
