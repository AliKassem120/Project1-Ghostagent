/**
 * ═══════════════════════════════════════════════════════════════
 * Tests — Should-Reply Gate
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { shouldReplyToMessage } from '../should-reply';

describe('shouldReplyToMessage', () => {
    // ── Normal messages ──────────────────────────────────────
    it('allows normal text messages', () => {
        const r = shouldReplyToMessage('I want to buy a hoodie');
        expect(r.shouldReply).toBe(true);
        expect(r.reason).toBe('normal_message');
    });

    // ── Emoji-only ───────────────────────────────────────────
    it('blocks emoji-only messages', () => {
        expect(shouldReplyToMessage('👍').shouldReply).toBe(false);
        expect(shouldReplyToMessage('😂🔥').shouldReply).toBe(false);
        expect(shouldReplyToMessage('❤️').shouldReply).toBe(false);
    });

    it('allows text with emojis', () => {
        expect(shouldReplyToMessage('nice 👍').shouldReply).toBe(true);
    });

    // ── Reactions ────────────────────────────────────────────
    it('blocks reaction events', () => {
        const r = shouldReplyToMessage('', { isReaction: true });
        expect(r.shouldReply).toBe(false);
        expect(r.reason).toBe('reaction_event');
    });

    it('blocks reaction message types', () => {
        const r = shouldReplyToMessage('❤️', { messageType: 'reaction' });
        expect(r.shouldReply).toBe(false);
    });

    // ── Voice notes ──────────────────────────────────────────
    it('returns static reply for voice notes', () => {
        const r = shouldReplyToMessage('', { mediaType: 'audio' });
        expect(r.shouldReply).toBe(true);
        expect(r.staticReply).toBeTruthy();
        expect(r.reason).toBe('voice_note_unsupported');
    });

    it('returns static reply for ptt (push to talk)', () => {
        const r = shouldReplyToMessage('', { mediaType: 'ptt' });
        expect(r.shouldReply).toBe(true);
        expect(r.staticReply).toContain('voice');
    });

    // ── Image without text ───────────────────────────────────
    it('returns static reply for image without text', () => {
        const r = shouldReplyToMessage('', { hasMedia: true, mediaType: 'image' });
        expect(r.shouldReply).toBe(true);
        expect(r.staticReply).toContain('image');
    });

    it('processes image with text normally', () => {
        const r = shouldReplyToMessage('is this available?', { hasMedia: true, mediaType: 'image' });
        expect(r.shouldReply).toBe(true);
        expect(r.staticReply).toBeUndefined();
    });

    // ── Empty messages ───────────────────────────────────────
    it('blocks empty messages', () => {
        expect(shouldReplyToMessage('').shouldReply).toBe(false);
        expect(shouldReplyToMessage('   ').shouldReply).toBe(false);
    });

    // ── Bot loop detection ───────────────────────────────────
    it('detects bot loop', () => {
        const r = shouldReplyToMessage('Order confirmed! ✅', { lastBotReply: 'Order confirmed! ✅' });
        expect(r.shouldReply).toBe(false);
        expect(r.reason).toBe('bot_loop_detected');
    });

    // ── Spam detection ───────────────────────────────────────
    it('blocks spam (high message count)', () => {
        const r = shouldReplyToMessage('hello', { recentMessageCount: 15 });
        expect(r.shouldReply).toBe(false);
        expect(r.reason).toBe('spam_detected');
    });

    // ── Human takeover ───────────────────────────────────────
    it('blocks when muted and not expired', () => {
        const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const r = shouldReplyToMessage('hello', { isMuted: true, mutedUntil: future });
        expect(r.shouldReply).toBe(false);
        expect(r.reason).toBe('human_takeover_active');
    });

    it('allows when mute expired', () => {
        const past = new Date(Date.now() - 1000).toISOString();
        const r = shouldReplyToMessage('hello', { isMuted: true, mutedUntil: past });
        expect(r.shouldReply).toBe(true);
    });

    // ── Post-completion thanks ───────────────────────────────
    it('replies to thanks after order completion', () => {
        const r = shouldReplyToMessage('thanks!', { isPostCompletion: true });
        expect(r.shouldReply).toBe(true);
        expect(r.staticReply).toContain('welcome');
    });

    it('does not use static reply for thanks without post-completion flag', () => {
        const r = shouldReplyToMessage('thanks!');
        expect(r.shouldReply).toBe(true);
        expect(r.staticReply).toBeUndefined();
    });

    // ── Unsupported media ────────────────────────────────────
    it('blocks stickers', () => {
        const r = shouldReplyToMessage('', { mediaType: 'sticker' });
        expect(r.shouldReply).toBe(false);
    });

    it('blocks documents', () => {
        const r = shouldReplyToMessage('', { mediaType: 'document' });
        expect(r.shouldReply).toBe(false);
    });
});
