/**
 * GhostAgent classifier
 *
 * This classifier only decides broad routing. It should NOT force every
 * sales-related message into checkout. Browsing/inquiry comes first;
 * checkout only starts when the customer clearly wants to buy/book.
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

const PRODUCT_INQUIRY_PATTERNS = /\b(do\s*you\s*(have|sell|carry)|what\s*do\s*you\s*(sell|have|offer)|what\s*products|show\s*me|catalog|menu|price|how\s*much|cost|stock|available|in\s*stock|ade|adde|addesh|ade\s*7a2o|kam|bikam|bkam|fi\s*3andkon|3andkon|shu\s*3andkon|mawjud|mawjoud|fi\s*meno|se3r|se3ro)\b/i;
const CLEAR_ORDER_PATTERNS = /\b(i\s*(want|wanna)\s*(to\s*)?(buy|order)|i('ll|\s*will)\s*(take|buy|get|order)|reserve\s*(it|one|this)|add\s*to\s*cart|buy\s*(it|this|that|one)|order\s*(it|this|that|one)|take\s*(it|this|that|one)|deal|bde\s+.*\b(ps5|tv|iphone|samsung|console|phone|headphones?)\b|badde\s+.*\b(ps5|tv|iphone|samsung|console|phone|headphones?)\b)\b/i;

const SERVICE_INQUIRY_PATTERNS = /\b(services?|what\s*do\s*you\s*(do|offer)|treatments?|packages?|menu|list|options|how\s*much|price|shu\s*btaaemlo|shu\s*bt3amlo|shu\s*3andkon|shu\s*l\s*services|what\s*can\s*you\s*do)\b/i;
const CLEAR_BOOKING_PATTERNS = /\b(book|reserve|appointment|schedule|booking|slot|maw3ed|mawed|ma3ed|bade\s*e7joz|bade\s*a7joz|badde\s*e7jez|bde\s*e5od|bde\s*ekhod|7ajez|hajez|hajiz|reserve\s*(a\s*)?spot)\b/i;

function isArabiziStyle(style: string): boolean {
    return style === 'lebanese_arabizi' || style === 'mixed';
}

function isVagueOneRequest(msg: string): boolean {
    return /\b(bde|bade|badde|baddi|bedde)\s+(wahad|wa7ad|we7de|wehde|wa7de|wahde)\b/i.test(msg)
        && msg.trim().split(/\s+/).length <= 3;
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
        if (businessType === 'appointments' && (arabizi.hints.wantsAppointment || arabizi.hints.asksAvailability)) return { intent: 'booking_intent', language: detected, confidence: 'regex' };
        if (businessType === 'appointments' && arabizi.hints.asksService) return { intent: 'service_inquiry', language: detected, confidence: 'regex' };
        if (businessType === 'ecommerce' && isVagueOneRequest(msg)) return { intent: 'product_inquiry', language: detected, confidence: 'regex' };
        if (businessType === 'ecommerce' && (arabizi.hints.asksStock || arabizi.hints.asksPrice)) return { intent: 'product_inquiry', language: detected, confidence: 'regex' };
        if (businessType === 'ecommerce' && arabizi.hints.wantsToBuy) return { intent: 'order_intent', language: detected, confidence: 'regex' };
    }

    if (handoffKeywords.length > 0 && handoffKeywords.some(kw => msgLower.includes(kw.toLowerCase()))) return { intent: 'handoff_request', language, confidence: 'regex' };
    if (GREETING_PATTERNS.test(msg)) return { intent: 'greeting', language, confidence: 'regex' };
    if (COMPLAINT_PATTERNS.test(msg)) return { intent: 'complaint', language, confidence: 'regex' };
    if (HANDOFF_PATTERNS.test(msg)) return { intent: 'handoff_request', language, confidence: 'regex' };
    if (CANCEL_PATTERNS.test(msg)) return { intent: 'cancel_request', language, confidence: 'regex' };
    if (HOURS_PATTERNS.test(msg)) return { intent: 'hours_inquiry', language, confidence: 'regex' };

    if (businessType === 'ecommerce') {
        if (PRODUCT_INQUIRY_PATTERNS.test(msg)) return { intent: 'product_inquiry', language, confidence: 'regex' };
        if (CLEAR_ORDER_PATTERNS.test(msg)) return { intent: 'order_intent', language, confidence: 'regex' };
        if (msg.split(/\s+/).length <= 4 && !msg.includes('?')) return { intent: 'product_inquiry', language, confidence: 'regex', subject: msg };
    } else {
        if (SERVICE_INQUIRY_PATTERNS.test(msg)) return { intent: 'service_inquiry', language, confidence: 'regex' };
        if (CLEAR_BOOKING_PATTERNS.test(msg)) return { intent: 'booking_intent', language, confidence: 'regex' };
        if (msg.split(/\s+/).length <= 4 && !msg.includes('?')) return { intent: 'service_inquiry', language, confidence: 'regex', subject: msg };
    }

    return { intent: 'general_chat', language, confidence: 'regex' };
}
