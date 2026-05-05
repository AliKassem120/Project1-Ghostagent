/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Intent Classifier (Regex Fallbacks)
 * ═══════════════════════════════════════════════════════════════
 * Cheap deterministic regex patterns that run BEFORE any LLM call.
 * Catches obvious intents like greetings, confirmations, cancellations,
 * handoff requests, and common Arabizi phrases.
 */

export type Intent =
    | 'greeting'
    | 'faq_question'
    | 'product_question'
    | 'product_availability'
    | 'purchase_intent'
    | 'order_status'
    | 'cancel_order'
    | 'cancel_status'
    | 'modify_order'
    | 'service_question'
    | 'price_question'
    | 'booking_intent'
    | 'cancel_appointment'
    | 'modify_appointment'
    | 'reschedule_appointment'
    | 'business_hours'
    | 'location_question'
    | 'shipping_question'
    | 'discount_question'
    | 'complaint'
    | 'correction'
    | 'human_handoff'
    | 'frustration_stop'
    | 'confirmation'
    | 'rejection'
    | 'pricing_question'
    | 'feature_question'
    | 'setup_question'
    | 'integration_question'
    | 'arabizi_question'
    | 'demo_request'
    | 'support_request'
    | 'refund_question'
    | 'unknown';

export interface RegexClassification {
    intent: Intent;
    confidence: number;
}

/**
 * Try to classify a message using regex patterns.
 * Returns null if no pattern matches with sufficient confidence.
 */
export function classifyByRegex(message: string): RegexClassification | null {
    const msg = message.toLowerCase().trim();
    const words = msg.split(/\s+/);
    const wordCount = words.length;

    // ── Greetings (high confidence for short messages) ────────
    if (wordCount <= 4 && /^(hey|hi|hello|yo|sup|salam|marhaba|hala|ahla|kifak|kifik|bonjour|hola|good\s*(morning|evening|afternoon)|bonsoir)$/i.test(msg)) {
        return { intent: 'greeting', confidence: 0.98 };
    }
    if (wordCount <= 3 && /^(hey|hi|hello|salam|hala|ahla|kifak|yo)[\s!?.]*$/i.test(msg)) {
        return { intent: 'greeting', confidence: 0.95 };
    }

    // ── Human handoff ────────────────────────────────────────
    if (/\b(manager|mwazaf|human|agent|real\s*person|talk\s*to\s*someone|bade\s*e?hke\s*ma3|ma\s*3am\s*tefham)\b/i.test(msg)) {
        return { intent: 'human_handoff', confidence: 0.95 };
    }

    // ── Frustration / Stop / Leave me alone ──────────────────
    if (/\b(7el\s*3ann?e|hel\s*3ann?e|fek\s*3ann?e|rou7|ma\s*tjew[ea]b|ma\s*bde\s*shi|ma\s*bde\s*se3de)\b/i.test(msg)) {
        return { intent: 'frustration_stop', confidence: 0.93 };
    }
    if (/\b(leave\s*me\s*alone|stop\s*replying|stop\s*messaging|shut\s*up|don'?t\s*message\s*me|forget\s*it)\b/i.test(msg)) {
        return { intent: 'frustration_stop', confidence: 0.93 };
    }
    if (/^(khalas|khallas|tyb\s*meshe|meshe\s*khalas)$/i.test(msg)) {
        return { intent: 'frustration_stop', confidence: 0.90 };
    }

    // ── Cancel status check ("did you cancel it?") (MUST be before cancel patterns) ────────
    if (/\b(3melt\s*cancel|sar\s*cancel|tcancel|did\s*you\s*cancel|is\s*it\s*cancell?ed|l\s*order\s*tenla8a|maw3de?\s*tenla8a|cancel\s*sar)\b/i.test(msg)) {
        return { intent: 'cancel_status', confidence: 0.90 };
    }

    // ── Cancel appointment (MUST be BEFORE cancel_order — "el8e l maw3ed" has "el8e") ────
    if (/\b(cancel\s*(my)?\s*(appointment|booking)|i\s*can'?t\s*come|i\s*won'?t\s*come|i\s*don'?t\s*want\s*the\s*appointment|remove\s*my\s*booking)\b/i.test(msg)) {
        return { intent: 'cancel_appointment', confidence: 0.92 };
    }
    if (/\b(el8e?|elghi)\s*(el|l)\s*(maw3ed|7ajez)\b/i.test(msg)) {
        return { intent: 'cancel_appointment', confidence: 0.92 };
    }
    if (/\b(bde?|bade?|badde?)\s*(el8e?|elghi)\s*(l|el)?\s*(maw3ed|7ajez)\b/i.test(msg)) {
        return { intent: 'cancel_appointment', confidence: 0.92 };
    }
    if (/\b(ma\s*b[a2]?a?\s*bde?\s*(l|el)?\s*maw3ed|ma\s*fiy?ye?\s*eje|ma\s*rah\s*eje|ma\s*bde?\s*eje)\b/i.test(msg)) {
        return { intent: 'cancel_appointment', confidence: 0.92 };
    }
    if (/\b(cancel\s*(lal|l)\s*(maw3ed|7ajez))\b/i.test(msg)) {
        return { intent: 'cancel_appointment', confidence: 0.92 };
    }
    if (/\b(fik\s*t3mel\s*cancel)\b/i.test(msg) && /\b(maw3ed|7ajez)\b/i.test(msg)) {
        return { intent: 'cancel_appointment', confidence: 0.92 };
    }

    // ── Cancel order (MUST be before purchase_intent) ────────
    // Comprehensive Arabizi cancel patterns
    if (/\b(cancel\s*(my)?\s*order|cancel\s*(it|this)|i\s*don'?t\s*want\s*(the\s*order|it\s*anymore)|never\s*mind\s*(the\s*)?order|stop\s*the\s*order|remove\s*the\s*order)\b/i.test(msg)) {
        return { intent: 'cancel_order', confidence: 0.92 };
    }
    if (/\b(el8e?|elghi|el8iya|el8eha)\s*(el|l)?\s*(order|talbiye)?\b/i.test(msg)) {
        return { intent: 'cancel_order', confidence: 0.92 };
    }
    if (/\b(m[a3]sh?\s*bde?\s*(l|el)?\s*order|ma\s*b[a2]?a?\s*bde?\s*(l|el)?\s*order|ma\s*badd?e?\s*(l|el)?\s*order)\b/i.test(msg)) {
        return { intent: 'cancel_order', confidence: 0.92 };
    }
    if (/\b(bde?|bade?|badde?)\s*(el8e?|elghi)\s*(l|el)?\s*(order|talbiye)\b/i.test(msg)) {
        return { intent: 'cancel_order', confidence: 0.92 };
    }
    if (/\b(cancel\s*(lal|l)\s*order|order\s*cancel|3mell?e\s*cancel|fik\s*t3mel\s*cancel|ma\s*bde?\s*ye?ha)\b/i.test(msg)) {
        return { intent: 'cancel_order', confidence: 0.92 };
    }
    if (/\b(khalas\s*ma\s*bde?)\b/i.test(msg) && /\b(order|talbiye)\b/i.test(msg)) {
        return { intent: 'cancel_order', confidence: 0.90 };
    }

    // ── Order status (MUST be before purchase_intent) ────────
    if (/\b(where\s*(is)?\s*(my|el)\s*(order|package|shipment)|track\s*(my)?\s*(order|package)|wein\s*(el)?\s*(order|talbiye))\b/i.test(msg)) {
        return { intent: 'order_status', confidence: 0.92 };
    }

    // ── Modify order (MUST be before purchase_intent) ────────
    if (/\b(change|modify|update)\s*(it|the|my|el)?\s*(to|la|into)?\s*.+/i.test(msg) && /\b(size|color|variant|loun|medium|large|small|xl|address|3nwen)\b/i.test(msg)) {
        return { intent: 'modify_order', confidence: 0.88 };
    }
    if (/\b(baddi|bade|bde)\s+(ghayer|8ayer)\b/i.test(msg)) {
        return { intent: 'modify_order', confidence: 0.88 };
    }

    // ── Price question ───────────────────────────────────────
    if (/\b(price|cost|how\s*much|adde|addesh|se3r|se3ro|combien|cuanto|7a2o)\b/i.test(msg)) {
        return { intent: 'price_question', confidence: 0.85 };
    }

    // ── SaaS Specific Intents ──────────────────────────────────
    if (/\b(setup|how\s*to\s*start|how\s*to\s*use|get\s*started|create\s*account)\b/i.test(msg)) {
        return { intent: 'setup_question', confidence: 0.85 };
    }
    if (/\b(arabizi|arabic|lebanese|language|french|spanish|detect\s*language)\b/i.test(msg)) {
        return { intent: 'arabizi_question', confidence: 0.85 };
    }
    if (/\b(demo|show\s*me|try\s*it|test\s*it)\b/i.test(msg)) {
        return { intent: 'demo_request', confidence: 0.85 };
    }
    if (/\b(features?|can\s*it|does\s*it|whatsapp|instagram|channels)\b/i.test(msg)) {
        return { intent: 'feature_question', confidence: 0.85 };
    }
    if (/\b(help|support|not\s*working|bug|error)\b/i.test(msg)) {
        // "support" without other words could be help, but if it has "whatsapp" or "instagram", it matched feature_question above
        return { intent: 'support_request', confidence: 0.85 };
    }
    if (/\b(refund|money\s*back)\b/i.test(msg)) {
        return { intent: 'refund_question', confidence: 0.85 };
    }
    if (/\b(integration|shopify|api|webhook)\b/i.test(msg)) {
        return { intent: 'integration_question', confidence: 0.85 };
    }

    // ── Booking intent (Arabizi + English) ────────────────────
    if (/\b(book|reserve|appointment|maw3ed|7ajez|e7joz|bde\s*e?7joz|bade\s*e?7joz|rendez[\s-]?vous)\b/i.test(msg)) {
        return { intent: 'booking_intent', confidence: 0.90 };
    }

    // ── Purchase intent ──────────────────────────────────────
    // Explicit: buy, order, purchase, etc.
    if (/\b(buy|order|purchase|bde\s*eshtere|bade\s*eshtere|bde\s*e?5od|bade\s*e?5od|commander|acheter)\b/i.test(msg)) {
        return { intent: 'purchase_intent', confidence: 0.90 };
    }
    // Natural: "I want X", "I need X", "can I get X", "give me X", "send me X"
    // These are extremely common in DMs and indicate purchase intent when followed by a product-like word
    if (/\b(i\s*want|i\s*need|can\s*i\s*(get|have)|give\s*me|send\s*me|i('?d| would)\s*like|i('?ll| will)\s*take)\b/i.test(msg) && wordCount >= 3) {
        return { intent: 'purchase_intent', confidence: 0.85 };
    }
    // Arabizi: "badde", "bade", "3atine", "ab3atli"
    if (/\b(badde|bade|3atine|ab3atli|ab3atlii|b3atle|3ayez|3ayza|je\s*veux|je\s*voudrais)\b/i.test(msg) && wordCount >= 2) {
        return { intent: 'purchase_intent', confidence: 0.85 };
    }

    if (/\b(hours|open|close|working\s*hours|wen\s*fethin|amta\s*btfta7|btefta7|msakrin|horaire|disponib)\b/i.test(msg)) {
        return { intent: 'business_hours', confidence: 0.88 };
    }


    // ── Shipping question ────────────────────────────────────
    if (/\b(shipping|delivery|deliver|towsil|livraison|envio)\b/i.test(msg)) {
        return { intent: 'shipping_question', confidence: 0.85 };
    }

    // ── Location question ────────────────────────────────────
    if (/\b(where|location|address|wen\s*mawjud|3nwen|manta2a|adresse|direccion)\b/i.test(msg)) {
        return { intent: 'location_question', confidence: 0.85 };
    }

    // ── Discount question ────────────────────────────────────
    if (/\b(discount|promo|offer|takhfid|sale|reduction|descuento)\b/i.test(msg)) {
        return { intent: 'discount_question', confidence: 0.85 };
    }

    // ── Product / Service availability ────────────────────────
    if (/\b(available|in\s*stock|do\s*you\s*have|fi\s*(meno|3andkon)?|mawjud|mawjoud|what.*(?:sell|offer|provide)|menu|catalog)\b/i.test(msg)) {
        return { intent: 'product_availability', confidence: 0.82 };
    }
    // ── Service question ─────────────────────────────────────
    if (/\b(services?|what\s*do\s*you\s*do|treatments?|packages?|khedamet|khedme)\b/i.test(msg)) {
        return { intent: 'service_question', confidence: 0.82 };
    }

    // ── Complaint ────────────────────────────────────────────
    if (/\b(complaint|problem|issue|broken|wrong|t2a5arto|ma\s*woselne|8alat|terrible|awful)\b/i.test(msg)) {
        return { intent: 'complaint', confidence: 0.80 };
    }

    // ── Correction / Misunderstanding ────────────────────────────
    if (/\b(didn'?t\s*ask|not\s*what\s*i\s*(asked|meant|said)|you\s*misunderstood|wdym|what\s*do\s*you\s*mean|that'?s\s*not|wrong\s*answer|ma\s*hek|msh\s*hek|ma\s*fhemet|ma\s*fhemte|ma\s*fhmt|msh\s*ha2|msh\s*hek\s*2sde)\b/i.test(msg)) {
        return { intent: 'correction', confidence: 0.88 };
    }

    return null;
}
