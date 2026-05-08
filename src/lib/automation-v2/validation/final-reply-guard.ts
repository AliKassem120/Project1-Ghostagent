import type { DetectedLanguage } from '../types';

export type GuardActionType =
    | 'order'
    | 'appointment'
    | 'cancel_order'
    | 'cancel_appointment'
    | 'update_order'
    | 'update_appointment'
    | 'general'
    | string;

export interface FinalReplyGuardInput {
    replyText?: string | null;
    language?: DetectedLanguage | string | null;
    dbWriteAttempted?: boolean;
    dbWriteSuccess?: boolean;
    actionType?: GuardActionType | null;
    sourcePath?: string | null;
    /** Count-aware cancel metadata */
    cancelMeta?: {
        requestedScope?: string;
        requestedCount?: number;
        cancelledCount?: number;
    };
}

export interface FinalReplyGuardResult {
    shouldReply: boolean;
    replyText: string | null;
    actionsToAdd: string[];
    blockedReason?: string;
}

const SUCCESS_PATTERNS = [
    /\border\s+(?:is\s+)?confirmed\b/i,
    /\border\s+(?:is\s+)?placed\b/i,
    /\bappointment\s+(?:is\s+)?booked\b/i,
    /\bappointment\s+(?:is\s+)?confirmed\b/i,
    /\bappointment\s+(?:is\s+)?scheduled\b/i,
    /\b(?:has been|was|is)\s+cancelled\b/i,
    /\b(?:has been|was|is)\s+canceled\b/i,
    /\b(?:order|appointment)\s+(?:is\s+)?cancelled\b/i,
    /\b(?:order|appointment)\s+(?:is\s+)?canceled\b/i,
    /\b(?:order|appointment)\s+(?:is\s+)?updated\b/i,
    /\b(?:order|appointment|booking)\s+(?:is\s+)?done\b/i,
    /\bwe will contact you\b/i,
    /\bt2a?kka[de]\b/i,
    /\bt2akked\b/i,
    /\bma7jouz\b/i,
    /\btenla8a\b/i,
    /\bnla8a\b/i,
    // Multi-cancel success patterns
    /\bboth\s+(?:orders?|appointments?)\s+(?:are\s+)?cancell?ed\b/i,
    /\ball\s+(?:orders?|appointments?)\s+(?:are\s+)?cancell?ed\b/i,
    /\b\d+\s+(?:orders?|appointments?)\s+(?:are\s+)?cancell?ed\b/i,
    /\borders?\s+cancell?ed\b/i,
    /\bappointments?\s+cancell?ed\b/i,
];

const STATUS_EXPLANATION_PATTERNS = [
    /\balready\s+cancelled\b/i,
    /\balready\s+canceled\b/i,
    /\border\s+is\s+already\s+cancelled\b/i,
    /\border\s+is\s+already\s+canceled\b/i,
    /\bappointment\s+is\s+already\s+cancelled\b/i,
    /\bappointment\s+is\s+already\s+canceled\b/i,
    /\bcan't\s+cancel\b/i,
    /\bcannot\s+cancel\b/i,
    /\bi\s+can't\s+cancel\b/i,
    /\bi\s+can'?t\s+cancel\b/i,
    /\bstatus\s*(?:is|:)\s*(?:cancelled|canceled|fulfilled|completed|contacted|pending|confirmed)\b/i,
    /\byour\s+order\s+status\s+is\s+(?:cancelled|canceled|fulfilled|completed|contacted|pending)\b/i,
    /\byour\s+order\s+status:\s*(?:cancelled|canceled|fulfilled|completed|contacted|pending)\b/i,
    /\byour\s+appointment\s+status\s+is\s+(?:cancelled|canceled|fulfilled|completed|contacted|pending|confirmed)\b/i,
    /\bstatus\s+el\s+(?:order|maw3ed)\s*:\s*(?:cancelled|canceled|fulfilled|completed|contacted|pending|confirmed)\b/i,
    /\bel\s+order\s+already\s+tenla8a\b/i,
    /\bel\s+maw3ed\s+already\s+tenla8a\b/i,
    /\bma\s+fiyye\s+el8e\b/i,
    // Handler results that say "only X cancelled" are explanations, not false claims
    /\bonly\s+\d+\s+(?:order|appointment)\b/i,
    /\bcouldn't cancel\b/i,
    /\bnot\s+cancellable\b/i,
];

function isArabizi(language?: string | null): boolean {
    return language === 'arabizi' || language === 'lebanese franco' || language === 'arabic' || language === 'mixed';
}

export function safeErrorReply(language?: string | null): string {
    return isArabizi(language) ? 'Fi 8alat. Jarreb kamen.' : 'Something went wrong. Please try again.';
}

function hasFalseSuccessClaim(reply: string): boolean {
    if (STATUS_EXPLANATION_PATTERNS.some((pattern) => pattern.test(reply))) {
        return false;
    }
    return SUCCESS_PATTERNS.some((pattern) => pattern.test(reply));
}

/**
 * Check if a multi-cancel reply is count-accurate.
 * Returns false (claim is ok) if counts match, true (false claim) if they don't.
 */
function hasCountMismatch(reply: string, cancelMeta?: FinalReplyGuardInput['cancelMeta']): boolean {
    if (!cancelMeta) return false;

    const { requestedScope, requestedCount, cancelledCount } = cancelMeta;
    if (cancelledCount === undefined) return false;

    // "both" in reply requires cancelledCount >= 2
    if (/\bboth\b/i.test(reply) && cancelledCount < 2) return true;

    // "all" in reply requires cancelledCount >= 1 (and scope was all_pending)
    if (/\ball\s+(?:orders?|appointments?)\b/i.test(reply) && requestedScope === 'all_pending' && cancelledCount < 1) return true;

    // Number in reply (e.g., "2 orders cancelled") requires matching cancelledCount
    const numMatch = reply.match(/\b(\d+)\s+(?:orders?|appointments?)\s+cancell?ed\b/i);
    if (numMatch) {
        const claimed = parseInt(numMatch[1], 10);
        if (claimed > cancelledCount) return true;
    }

    // scope=count with requested count requires cancelledCount >= requestedCount
    if (requestedScope === 'count' && requestedCount && cancelledCount < requestedCount) {
        // Only a mismatch if the reply claims the full count
        if (reply.match(new RegExp(`\\b${requestedCount}\\b`))) return true;
    }

    return false;
}

export function guardFinalReply(input: FinalReplyGuardInput): FinalReplyGuardResult {
    const replyText = input.replyText?.trim() || '';

    if (!replyText) {
        return {
            shouldReply: false,
            replyText: null,
            actionsToAdd: ['empty_reply_blocked'],
            blockedReason: 'empty_reply',
        };
    }

    if (replyText.includes('[HANDOFF]')) {
        return {
            shouldReply: false,
            replyText: null,
            actionsToAdd: ['handoff_token_blocked'],
            blockedReason: 'handoff_token',
        };
    }

    // Count-aware cancel guard — must be before general false success check
    if (hasCountMismatch(replyText, input.cancelMeta)) {
        return {
            shouldReply: true,
            replyText: safeErrorReply(input.language),
            actionsToAdd: ['cancel_count_mismatch_blocked'],
            blockedReason: 'cancel_count_mismatch',
        };
    }

    if (hasFalseSuccessClaim(replyText) && input.dbWriteSuccess !== true) {
        return {
            shouldReply: true,
            replyText: safeErrorReply(input.language),
            actionsToAdd: ['false_success_blocked'],
            blockedReason: 'false_success_claim',
        };
    }

    return {
        shouldReply: true,
        replyText,
        actionsToAdd: [],
    };
}
