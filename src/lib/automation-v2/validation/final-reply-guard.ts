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
