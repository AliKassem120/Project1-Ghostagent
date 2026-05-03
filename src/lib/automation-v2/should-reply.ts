/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Should-Reply Gate
 * ═══════════════════════════════════════════════════════════════
 * Decides whether the bot should reply AT ALL before any processing.
 * Prevents replying to noise: emoji-only, reactions, voice notes,
 * bot loops, spam, and post-completion thank-you messages.
 */

import { v2log } from './logger';

export interface ShouldReplyResult {
    shouldReply: boolean;
    reason: string;
    /** If not null, send this reply instead of processing the message */
    staticReply?: string;
}

/** Pure-emoji regex: contains nothing except emoji, whitespace, variation selectors */
const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Component}\uFE0E\uFE0F\s]+$/u;

/** Reaction event types from IG/WA webhooks */
const REACTION_TYPES = ['reaction', 'message_reaction', 'emoji_reaction'];

/** Common "thanks after completion" patterns */
const THANKS_PATTERNS = /^(thanks|thank\s*you|merci|gracias|shukran|yeslamo|mashkour|tkram|tkrame|thx|ty|👍|🙏)[\s!.]*$/i;

/** Voice note / audio indicators */
const VOICE_NOTE_TYPES = ['audio', 'voice', 'ptt'];

/** Unsupported media indicators */
const UNSUPPORTED_MEDIA = ['sticker', 'contacts', 'document', 'video_note'];

/**
 * Determine whether the bot should reply to this message.
 */
export function shouldReplyToMessage(
    message: string,
    options: {
        messageType?: string;
        isReaction?: boolean;
        hasMedia?: boolean;
        mediaType?: string;
        lastBotReply?: string;
        recentMessageCount?: number;
        isMuted?: boolean;
        mutedUntil?: string;
        isPostCompletion?: boolean;
    } = {}
): ShouldReplyResult {
    const { messageType, isReaction, hasMedia, mediaType, lastBotReply, recentMessageCount, isMuted, mutedUntil, isPostCompletion } = options;

    // ── Muted (human takeover) ───────────────────────────────
    if (isMuted) {
        if (mutedUntil && new Date(mutedUntil).getTime() > Date.now()) {
            return { shouldReply: false, reason: 'human_takeover_active' };
        }
        // Mute expired — continue
    }

    // ── Reactions ────────────────────────────────────────────
    if (isReaction || (messageType && REACTION_TYPES.includes(messageType))) {
        return { shouldReply: false, reason: 'reaction_event' };
    }

    // ── Voice notes / audio ──────────────────────────────────
    if (mediaType && VOICE_NOTE_TYPES.includes(mediaType)) {
        return {
            shouldReply: true,
            reason: 'voice_note_unsupported',
            staticReply: "I can't listen to voice notes yet! Send a text message instead 🎤➡️📝",
        };
    }

    // ── Unsupported media (stickers, contacts, documents) ────
    if (mediaType && UNSUPPORTED_MEDIA.includes(mediaType)) {
        return { shouldReply: false, reason: 'unsupported_media' };
    }

    // ── Image without text ───────────────────────────────────
    if (hasMedia && mediaType === 'image' && (!message || message.trim().length === 0)) {
        return {
            shouldReply: true,
            reason: 'image_no_text',
            staticReply: "Got the image! What would you like me to do with it? 📷",
        };
    }

    // ── Empty message ────────────────────────────────────────
    if (!message || message.trim().length === 0) {
        return { shouldReply: false, reason: 'empty_message' };
    }

    // ── Emoji-only ───────────────────────────────────────────
    if (EMOJI_ONLY.test(message.trim())) {
        return { shouldReply: false, reason: 'emoji_only' };
    }

    // ── Bot loop detection ───────────────────────────────────
    if (lastBotReply && message.trim() === lastBotReply.trim()) {
        v2log.warn('SHOULD_REPLY', 'Bot loop detected', { message: message.slice(0, 40) });
        return { shouldReply: false, reason: 'bot_loop_detected' };
    }

    // ── Spam detection (10+ messages in 30s window) ──────────
    if (recentMessageCount && recentMessageCount > 10) {
        return { shouldReply: false, reason: 'spam_detected' };
    }

    // ── Post-completion thank-you ────────────────────────────
    if (isPostCompletion && THANKS_PATTERNS.test(message.trim())) {
        return {
            shouldReply: true,
            reason: 'post_completion_thanks',
            staticReply: "You're welcome! 🙌",
        };
    }

    // ── Normal message — proceed ─────────────────────────────
    return { shouldReply: true, reason: 'normal_message' };
}
