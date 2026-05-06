export interface FinalReplyGuardInput {
    replyText: string | null | undefined;
    language?: string;
    dbWriteAttempted?: boolean;
    dbWriteSuccess?: boolean;
    actionType?: string;
    sourcePath?: string;
}

export interface FinalReplyGuardResult {
    shouldReply: boolean;
    replyText: string | null;
    actionsToAdd: string[];
    blockedReason?: string;
}

const SUCCESS_PATTERNS = [
    /\border\s+(placed|confirmed|is\s+confirmed)\b/i,
    /\b(appointment|booking)\s+(booked|confirmed|scheduled)\b/i,
    /\b(confirmed|booked|scheduled|placed|cancelled|canceled|updated)\b/i,
    /\bwe\s+will\s+contact\s+you\b/i,
    /\bdone\b/i,
    /\btfadal\s+order\b/i,
    /\bt2a?kka?d\b/i,
    /\bma7jouz\b/i,
    /\bt7ajaz\b/i,
    /\btenla8a\b/i,
    /\bnla8a\b/i,
];

function isArabizi(language?: string): boolean {
    const lang = (language || '').toLowerCase();
    return lang === 'arabizi' || lang === 'lebanese franco' || lang === 'arabic' || lang === 'mixed';
}

export function guardFinalReply(input: FinalReplyGuardInput): FinalReplyGuardResult {
    const replyText = input.replyText?.trim() || '';
    if (!replyText) {
        return { shouldReply: false, replyText: null, actionsToAdd: ['empty_reply_blocked'], blockedReason: 'empty_reply' };
    }

    if (replyText.includes('[HANDOFF]')) {
        return { shouldReply: false, replyText: null, actionsToAdd: ['handoff'], blockedReason: 'handoff_token' };
    }

    const hasSuccessClaim = SUCCESS_PATTERNS.some((pattern) => pattern.test(replyText));
    if (hasSuccessClaim && input.dbWriteSuccess !== true) {
        return {
            shouldReply: true,
            replyText: isArabizi(input.language) ? 'Fi 8alat. Jarreb kamen.' : 'Something went wrong. Please try again.',
            actionsToAdd: ['false_confirmation_blocked'],
            blockedReason: 'db_write_not_successful',
        };
    }

    return { shouldReply: true, replyText, actionsToAdd: [] };
}
