/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Reply Validator
 * ═══════════════════════════════════════════════════════════════
 * Lightweight safety net. Only blocks dangerous replies:
 * - Empty replies
 * - Confirmation words without actual DB success
 */

export interface ValidationResult {
    isValid: boolean;
    reason?: string;
}

const CONFIRMATION_WORDS = [
    'confirmed', 'booked', 'scheduled', 'reserved', 'placed',
    'has been created', 'has been placed', 'has been booked',
    't2akad', 't2akkad',
];

export function validateReply(
    reply: string,
    context: { isConfirmed?: boolean } = {}
): ValidationResult {
    if (!reply || reply.trim().length === 0) {
        return { isValid: false, reason: 'Empty reply' };
    }

    // Block false confirmations
    if (!context.isConfirmed) {
        const lower = reply.toLowerCase();
        for (const word of CONFIRMATION_WORDS) {
            if (lower.includes(word)) {
                return { isValid: false, reason: `Contains "${word}" but no DB success` };
            }
        }
    }

    return { isValid: true };
}
