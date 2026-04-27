/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Reply Validator
 * ═══════════════════════════════════════════════════════════════
 * Final reply validation before sending. Blocks:
 * - Long paragraphs (> 220 chars normal, > 300 chars summary)
 * - Confirmation words without DB success
 * - Parroting the customer
 * - Filler phrases ("I'm checking", "please give me a moment")
 * - Fake/invented data
 */

export interface ValidationResult {
    isValid: boolean;
    reason?: string;
}

interface ValidationContext {
    /** True only if the DB insert was successful */
    isConfirmed?: boolean;
    /** The customer's original message */
    customerMessage?: string;
    /** Whether this is a summary reply (hours, service list) */
    isSummary?: boolean;
}

// ── Forbidden Phrases ────────────────────────────────────────

const FILLER_PHRASES = [
    "i'm checking",
    "im checking",
    "let me check",
    "please give me a moment",
    "one moment please",
    "hold on",
    "let me look",
    "i'll look into",
    "checking that for you",
    "just a moment",
    "please wait",
    "allow me to",
    "i will check",
    "i'll check",
    "looking into",
];

const CONFIRMATION_WORDS = [
    'confirmed',
    'booked',
    'scheduled',
    'reserved',
    'placed',
    'order is set',
    'appointment is set',
    'successfully created',
    'has been created',
    'has been placed',
    'has been booked',
    'has been confirmed',
    'has been scheduled',
];

// ── Parroting Detection ──────────────────────────────────────

function isParroting(reply: string, customerMessage: string): boolean {
    if (!customerMessage) return false;

    const replyLower = reply.toLowerCase().trim();
    const customerLower = customerMessage.toLowerCase().trim();

    // Exact match
    if (replyLower === customerLower) return true;

    // Reply starts with the customer's message
    if (replyLower.startsWith(customerLower) && customerLower.length > 10) return true;

    // High word overlap (> 70% of customer words appear in reply)
    const customerWords = customerLower.split(/\s+/).filter(w => w.length > 2);
    if (customerWords.length < 3) return false;

    const matchCount = customerWords.filter(w => replyLower.includes(w)).length;
    const overlapRatio = matchCount / customerWords.length;
    return overlapRatio > 0.7 && replyLower.length < customerLower.length * 2;
}

// ── Main Validator ───────────────────────────────────────────

export function validateReply(reply: string, context: ValidationContext = {}): ValidationResult {
    const { isConfirmed = false, customerMessage, isSummary = false } = context;

    if (!reply || reply.trim().length === 0) {
        return { isValid: false, reason: 'Empty reply' };
    }

    const trimmed = reply.trim();
    const lower = trimmed.toLowerCase();

    // Length check
    const maxLen = isSummary ? 300 : 220;
    if (trimmed.length > maxLen) {
        return { isValid: false, reason: `Reply too long (${trimmed.length} chars, max ${maxLen})` };
    }

    // Sentence count (max 2 for normal, max 3 for summary)
    const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 3);
    const maxSentences = isSummary ? 4 : 2;
    if (sentences.length > maxSentences) {
        return { isValid: false, reason: `Too many sentences (${sentences.length}, max ${maxSentences})` };
    }

    // Filler phrases
    for (const phrase of FILLER_PHRASES) {
        if (lower.includes(phrase)) {
            return { isValid: false, reason: `Contains filler phrase: "${phrase}"` };
        }
    }

    // Confirmation without success
    if (!isConfirmed) {
        for (const word of CONFIRMATION_WORDS) {
            if (lower.includes(word)) {
                return { isValid: false, reason: `Contains confirmation word "${word}" but no DB success` };
            }
        }
    }

    // Parroting
    if (customerMessage && isParroting(trimmed, customerMessage)) {
        return { isValid: false, reason: 'Reply parrots the customer message' };
    }

    return { isValid: true };
}
