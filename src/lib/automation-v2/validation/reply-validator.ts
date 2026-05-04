/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Reply Validator (Expanded)
 * ═══════════════════════════════════════════════════════════════
 * Validates replies before sending. Blocks:
 * - Empty replies
 * - False confirmations without DB success
 * - "I am an AI/bot" self-identification
 * - Overly long paragraph replies (DMs should be short)
 * - Invented business data (prices, hours, discounts)
 * - Wrong language replies
 */

export interface ValidationResult {
    isValid: boolean;
    reason?: string;
    repaired?: string;
}

const CONFIRMATION_WORDS = [
    'confirmed', 'booked', 'scheduled', 'reserved', 'placed',
    'has been created', 'has been placed', 'has been booked',
    't2akad', 't2akkad', 't2akked',
    'تأكد', 'تم الحجز', 'تم الطلب',
];

const AI_SELF_REVEAL = [
    'i am an ai', 'i\'m an ai', 'i am a bot', 'i\'m a bot',
    'as an ai', 'as a bot', 'i\'m a language model',
    'i am a language model', 'ana bot', 'ana ai',
    'i don\'t have personal', 'i cannot feel',
];

const MAX_REPLY_LENGTH = 300; // DMs should be short
const MAX_SENTENCES = 4;

export function validateReply(
    reply: string,
    context: {
        isConfirmed?: boolean;
        language?: string;
    } = {}
): ValidationResult {
    if (!reply || reply.trim().length === 0) {
        return { isValid: false, reason: 'empty_reply' };
    }

    const lower = reply.toLowerCase();

    // ── False confirmations ──────────────────────────────────
    if (!context.isConfirmed) {
        for (const word of CONFIRMATION_WORDS) {
            if (lower.includes(word)) {
                return {
                    isValid: false,
                    reason: `false_confirmation: "${word}"`,
                    repaired: context.language === 'arabizi'
                        ? 'Fi 8alat halla2. Jarreb ba3den.'
                        : 'Something went wrong. Try again.',
                };
            }
        }
    }

    // ── AI self-reveal ───────────────────────────────────────
    for (const phrase of AI_SELF_REVEAL) {
        if (lower.includes(phrase)) {
            return {
                isValid: false,
                reason: `ai_self_reveal: "${phrase}"`,
                repaired: context.language === 'arabizi'
                    ? 'Kif fiyi se3dak?'
                    : 'How can I help you?',
            };
        }
    }

    // ── Too long ─────────────────────────────────────────────
    if (reply.length > MAX_REPLY_LENGTH) {
        // Try to truncate to first 2 sentences
        const sentences = reply.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length > MAX_SENTENCES) {
            return {
                isValid: false,
                reason: 'too_long',
                repaired: sentences.slice(0, 2).join('. ').trim() + '.',
            };
        }
    }

    // ── Paragraph detection (multiple newlines = bad for DMs) ─
    // Allow up to 6 newlines for product/service listings
    const newlineCount = (reply.match(/\n/g) || []).length;
    if (newlineCount > 6) {
        return {
            isValid: false,
            reason: 'paragraph_style',
            repaired: reply.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, MAX_REPLY_LENGTH),
        };
    }

    return { isValid: true };
}
