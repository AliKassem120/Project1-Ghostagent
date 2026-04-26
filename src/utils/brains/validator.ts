import { FORBIDDEN_PHRASES } from './templates';

export type ValidationResult = {
    isValid: boolean;
    reason?: string;
};

export function validateDMResponse(response: string, context: { 
    isBusinessHours?: boolean; 
    isActuallyConfirmed?: boolean;
}): ValidationResult {
    const trimmed = response.trim();
    const sentenceCount = trimmed.split(/[.!?]+/).filter(Boolean).length;
    const charLimit = context.isBusinessHours ? 300 : 220;

    // 1. Length check
    if (trimmed.length > charLimit) {
        return { isValid: false, reason: `Response too long (${trimmed.length} > ${charLimit})` };
    }

    // 2. Sentence count check
    if (sentenceCount > 2) {
        return { isValid: false, reason: `Too many sentences (${sentenceCount} > 2)` };
    }

    // 3. Forbidden phrases check
    for (const phrase of FORBIDDEN_PHRASES) {
        if (trimmed.toLowerCase().includes(phrase.toLowerCase())) {
            return { isValid: false, reason: `Contains forbidden phrase: "${phrase}"` };
        }
    }

    // 4. Confirmation guard
    const confirmationWords = ['confirmed', 'booked', 'scheduled', 'appointment is set', 'order placed', 'order confirmed'];
    if (!context.isActuallyConfirmed) {
        for (const word of confirmationWords) {
            if (trimmed.toLowerCase().includes(word)) {
                return { isValid: false, reason: `Used confirmation word "${word}" without DB success.` };
            }
        }
    }

    // 5. Tool/Database language check
    if (/tool_call|function|database|classified|intent|json|payload/i.test(trimmed)) {
        return { isValid: false, reason: "Contains technical/internal language." };
    }

    return { isValid: true };
}
