/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Post-Context Classifier
 * ═══════════════════════════════════════════════════════════════
 * When conversation state is idle but postContext exists,
 * detect if the new message refers to the recent action.
 *
 * Purely regex — no LLM cost. Supports English + Arabizi.
 */

export type PostContextIntent =
    | 'modify_order'          // "change it to medium", "baddi ghayer el size"
    | 'order_status'          // "where is my order?", "wein el order?"
    | 'cancel_latest'         // "cancel it", "el8iya", "cancel el order"
    | 'reuse_details'         // "same address", "same 3nwen"
    | 'reschedule'            // "same time next week", "change the date"
    | 'modify_appointment'    // "change it to 4pm"
    | 'unrelated';            // does not refer to recent action

export interface PostContextClassification {
    intent: PostContextIntent;
    confidence: number;
    /** Extracted modification value if any (e.g., "medium" from "change to medium") */
    extractedValue?: string;
}

// ── Patterns ─────────────────────────────────────────────────

const MODIFY_ORDER_PATTERNS = [
    // English
    /\b(change|switch|update|modify)\s*(it|the|my)?\s*(to|into)?\s+(.+)/i,
    /\b(different|another)\s+(size|color|variant|quantity)\b/i,
    /\b(can\s+i|i\s*want\s*to)\s+(change|modify|update)/i,
    // Arabizi
    /\b(baddi|bade|bde)\s+(ghayer|8ayer|ghayyir)\b/i,
    /\b(ghayer|8ayer|ghayyir)\s*(el|l)?\s*(size|loun|color|kemiye|variant)\b/i,
    /\b(baddi|bade)\s+.{0,20}(size|loun|color|medium|large|small|xl)\b/i,
];

const ORDER_STATUS_PATTERNS = [
    // English
    /\b(where|status)\s*(is|of)?\s*(my|the|el)?\s*(order|package|shipment|delivery)\b/i,
    /\b(track|tracking)\s*(my)?\s*(order|package)\b/i,
    /\bwhen\s*(will|does)\s*(it|my\s*order)\s*(arrive|come|ship|get\s*here)\b/i,
    // Arabizi
    /\b(wein|wayn|wen)\s*(el)?\s*(order|talbiye|tolbiye)\b/i,
    /\b(shu\s*(sar|3am\s*yesor))\s*(bel|b)?\s*(order|talbiye)\b/i,
    /\b(la\s*wein\s*wesle?t?)\b/i,
];

const CANCEL_LATEST_PATTERNS = [
    // English
    /\b(cancel)\s*(it|this|that|the\s*(order|appointment|booking))\b/i,
    /\b(i\s*don'?t\s*want\s*it)\b/i,
    /\b(never\s*mind)\b/i,
    // Arabizi
    /\b(el8e|el8iya|el8i|elghiya|elghi)\b/i,
    /\b(cancel)\s*(el|l)?\s*(order|talbiye|maw3ed|7ajez)\b/i,
    /\b(ma\s*(bade|badde|bde))\b/i,
];

const REUSE_DETAILS_PATTERNS = [
    // English
    /\b(same)\s*(address|phone|name|details|info|number)\b/i,
    /\b(use)\s*(the)?\s*(same|previous|last)\b/i,
    // Arabizi
    /\b(same|nefs)\s*(el)?\s*(3nwen|3enwen|adress|address|ra2em|ism)\b/i,
    /\b(nefs\s*el\s*shi)\b/i,
];

const RESCHEDULE_PATTERNS = [
    // English
    /\b(same\s*time)\s*(next|coming)\s*(week|month)\b/i,
    /\b(reschedule|move|push|change)\s*(my|the)?\s*(appointment|booking|maw3ed)\b/i,
    /\b(can\s*i\s*(reschedule|move))\b/i,
    // Arabizi
    /\b(nefs\s*el\s*wa2et)\s*(el\s*)?(jem3a|osbou3)\s*(el\s*)?(jeye|teni)\b/i,
    /\b(baddi|bade)\s+(a2jel|e2jel|ghayer)\s*(el)?\s*(maw3ed|7ajez)\b/i,
];

/**
 * Classify a message against post-context patterns.
 * Only called when postContext exists.
 */
export function classifyPostContext(message: string): PostContextClassification {
    const msg = message.trim();

    // ── Cancel (check first — short circuit) ─────────────────
    for (const p of CANCEL_LATEST_PATTERNS) {
        if (p.test(msg)) {
            return { intent: 'cancel_latest', confidence: 0.92 };
        }
    }

    // ── Order status ─────────────────────────────────────────
    for (const p of ORDER_STATUS_PATTERNS) {
        if (p.test(msg)) {
            return { intent: 'order_status', confidence: 0.90 };
        }
    }

    // ── Reschedule ───────────────────────────────────────────
    for (const p of RESCHEDULE_PATTERNS) {
        if (p.test(msg)) {
            return { intent: 'reschedule', confidence: 0.90 };
        }
    }

    // ── Modify order ─────────────────────────────────────────
    for (const p of MODIFY_ORDER_PATTERNS) {
        const match = p.exec(msg);
        if (match) {
            // Try to extract the value they want to change to
            const val = match[4]?.trim() || undefined;
            return {
                intent: 'modify_order',
                confidence: 0.88,
                extractedValue: val,
            };
        }
    }

    // ── Reuse details ────────────────────────────────────────
    for (const p of REUSE_DETAILS_PATTERNS) {
        if (p.test(msg)) {
            return { intent: 'reuse_details', confidence: 0.88 };
        }
    }

    return { intent: 'unrelated', confidence: 0 };
}
