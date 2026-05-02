/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — V4 Classifier: Intent Detection
 * ═══════════════════════════════════════════════════════════════
 * FAST intent classification that runs BEFORE any tool-calling
 * agent. Uses regex-first (zero tokens) with LLM fallback.
 */

import type { DetectedLanguage } from './types';
import { detectLanguage } from './language';
import { normalizeArabizi } from '../automation/language/arabizi';

export type Intent =
    | 'greeting'
    | 'product_inquiry'
    | 'order_intent'
    | 'cancel_request'
    | 'hours_inquiry'
    | 'service_inquiry'
    | 'booking_intent'
    | 'complaint'
    | 'handoff_request'
    | 'general_chat';

export interface ClassificationResult {
    intent: Intent;
    language: DetectedLanguage;
    confidence: 'regex' | 'llm';
    subject?: string;
}

const GREETING_PATTERNS = /^(hey|hi|hello|yo|sup|hola|bonjour|salam|marhaba|hala|ahla|kifak|kifik|keefak|keefik|hi there|good\s*(morning|evening|afternoon|night)|sabah\s*el\s*kheir|masa\s*el\s*kheir|ciao)[\s!?.]*$/i;
const COMPLAINT_PATTERNS = /\b(fuck|shit|scam|horrible|worst|terrible|disgusting|trash|garbage|ripoff|rip.off|late|broken|wrong\s*item|damaged|never\s*(arrived|came|received)|refund|money\s*back|t2a5arto|ta2a5arto|ma\s*woselne|ma\s*wesil|5arab|gharab)\b/i;
const HANDOFF_PATTERNS = /\b(human|real\s*person|manager|speak\s*to\s*someone|talk\s*to\s*someone|operator|agent|representative|live\s*chat|bade\s*7ake\s*7ada|bade\s*hake\s*hada|mwazaf)\b/i;
const HOURS_PATTERNS = /\b(open|close[ds]?|hours|working\s*hours|business\s*hours|when\s*(are\s*you|do\s*you)\s*open|what\s*time|schedule|aimta|emta\s*(bteftah|btesakro|bteft7o|btsakro)|wain\s*el\s*ma7al)\b/i;
const CANCEL_PATTERNS = /\b(cancel|refund|return|undo|remove\s*(my\s*)?(order|appointment|booking)|ilghe|ilghi|lghiya|badde\s*ilghi|bade\s*cancel|bde\s*el8e|el8iya)\b/i;
const PRODUCT_PATTERNS = /\b(price|how\s*much|cost|stock|available|in\s*stock|do\s*you\s*(have|sell|carry)|what\s*do\s*you\s*(have|sell|offer)|ade|adde|addesh|ade\s*7a2o|kam|bikam|bkam|fi\s*3andkon|3andkon|shu\s*3andkon|show\s*me|what\s*products|catalog|menu|mawjud|mawjoud|fi\s*meno|se3r|se3ro)\b/i;
const ORDER_PATTERNS = /\b(i\s*want|i('ll|\s*will)\s*(take|buy|get|order)|deal|add\s*to\s*cart|buy\s*(it|this|that)|order\s*(it|this|that)|bade|badde|bde|baddi|bedde|bdee|bdak|bdek|baddna|we7de|wehde|wa7de|wahde|take\s*it|i('m|\s*am)\s*interested|yes\s*(i\s*want|please|deal))\b/i;
const SERVICE_PATTERNS = /\b(services?|what\s*do\s*you\s*(do|offer)|treatments?|packages?|menu|list|options|shu\s*btaaemlo|shu\s*bt3amlo|shu\s*3andkon|shu\s*l\s*services|what\s*can\s*you\s*do)\b/i;
const BOOKING_PATTERNS = /\b(book|reserve|appointment|schedule|booking|slot|maw3ed|mawed|ma3ed|bade\s*e7joz|bade\s*a7joz|badde\s*e7jez|bde\s*e5od|bde\s*ekhod|7ajez|hajez|hajiz|reserve\s*(a\s*)?spot|i\s*want|i\s*need|can\s*i\s*(get|have)|bade|badde|bde|baddi|bedde|bdee)\b/i;

function isArabiziStyle(style: string): boolean {
    return style === 'lebanese_arabizi' || style === 'mixed';
}

export function classifyIntent(
    message: string,
    businessType: 'appointments' | 'ecommerce',
    handoffKeywords: string[] = []
): ClassificationResult {
    const language = detectLanguage(message);
    const msg = message.trim();
    const msgLower = msg.toLowerCase();

    const arabizi = normalizeArabizi(message);
    if (isArabiziStyle(arabizi.detectedStyle)) {
        const detected: DetectedLanguage = arabizi.detectedStyle === 'mixed' ? 'mixed' : 'arabizi';

        if (arabizi.hints.asksBusinessHours) return { intent: 'hours_inquiry', language: detected, confidence: 'regex' };
        if (arabizi.hints.wantsAppointment || arabizi.hints.asksAvailability) {
            return { intent: businessType === 'appointments' ? 'booking_intent' : 'general_chat', language: detected, confidence: 'regex' };
        }
        if (arabizi.hints.asksService) {
            return { intent: businessType === 'appointments' ? 'service_inquiry' : 'general_chat', language: detected, confidence: 'regex' };
        }
        if (arabizi.hints.wantsToBuy || arabizi.hints.asksStock || arabizi.hints.asksPrice) {
            return { intent: businessType === 'ecommerce' ? 'order_intent' : 'general_chat', language: detected, confidence: 'regex' };
        }
    }

    if (handoffKeywords.length > 0) {
        if (handoffKeywords.some(kw => msgLower.includes(kw.toLowerCase()))) {
            return { intent: 'handoff_request', language, confidence: 'regex' };
        }
    }

    // Do not classify short messages as greetings. Product names like PS5/TV/AC are short.
    if (GREETING_PATTERNS.test(msg)) {
        return { intent: 'greeting', language, confidence: 'regex' };
    }

    if (COMPLAINT_PATTERNS.test(msg)) return { intent: 'complaint', language, confidence: 'regex' };
    if (HANDOFF_PATTERNS.test(msg)) return { intent: 'handoff_request', language, confidence: 'regex' };
    if (CANCEL_PATTERNS.test(msg)) return { intent: 'cancel_request', language, confidence: 'regex' };
    if (HOURS_PATTERNS.test(msg)) return { intent: 'hours_inquiry', language, confidence: 'regex' };

    if (businessType === 'ecommerce') {
        if (ORDER_PATTERNS.test(msg)) return { intent: 'order_intent', language, confidence: 'regex' };
        if (PRODUCT_PATTERNS.test(msg)) return { intent: 'product_inquiry', language, confidence: 'regex' };
    } else {
        if (BOOKING_PATTERNS.test(msg)) return { intent: 'booking_intent', language, confidence: 'regex' };
        if (SERVICE_PATTERNS.test(msg)) return { intent: 'service_inquiry', language, confidence: 'regex' };
    }

    if (msg.split(/\s+/).length <= 4 && !msg.includes('?')) {
        if (businessType === 'ecommerce') {
            return { intent: 'product_inquiry', language, confidence: 'regex', subject: msg };
        } else {
            return { intent: 'service_inquiry', language, confidence: 'regex', subject: msg };
        }
    }

    return { intent: 'general_chat', language, confidence: 'regex' };
}
