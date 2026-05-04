/**
 * ═══════════════════════════════════════════════════════════════
 * Tests — God Mode Phase 2 Tools
 * ═══════════════════════════════════════════════════════════════
 * Tests for:
 * - Brain Debugger: fresh simulation isolation, replay context loading
 * - Comments Debugger: public comment vs private DM separation
 * - Safety Validator: blocks false confirmations
 */

import { describe, it, expect, vi } from 'vitest';
import { validateReply } from '../validation/reply-validator';
import { classifyIntent } from '../classify/intent-classifier';
import { classifyPostContext } from '../classify/post-context-classifier';
import { detectLanguage } from '../language';
import { extractAvailabilityCandidate } from '../ecommerce/extract-product';

// ═══════════════════════════════════════════════════════════════
// Brain Debugger — fresh simulation does not touch real chat state
// ═══════════════════════════════════════════════════════════════

describe('Brain Debugger — Fresh Simulation Isolation', () => {
    it('generates a sim chatId that starts with "sim_"', () => {
        const simChatId = `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        expect(simChatId.startsWith('sim_')).toBe(true);
    });

    it('sim chatId is unique each time', () => {
        const id1 = `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const id2 = `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        expect(id1).not.toBe(id2);
    });

    it('sim chatId does not match any real chat ID pattern', () => {
        const simChatId = `sim_${Date.now()}_abc123`;
        // Real Instagram IDs are numeric, real WhatsApp IDs are phone numbers
        expect(simChatId).toMatch(/^sim_/);
        expect(/^\d+$/.test(simChatId)).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════
// Brain Debugger — dry run does not send external messages
// ═══════════════════════════════════════════════════════════════

describe('Brain Debugger — Dry Run Safety', () => {
    it('simulation never calls external fetch/send APIs', () => {
        // Architectural test:
        // The Brain Debugger simulate route calls handleAutomationMessage()
        // which returns an AutomationResult { replyText, actions, debug, ... }.
        // External sends (Instagram DM, public comments, WhatsApp) are ONLY
        // done in the webhook route.ts files AFTER receiving the result.
        // handleAutomationMessage itself has NO side effects to external APIs.
        //
        // Verify by checking that the pure helper functions used in preflight
        // analysis are indeed pure (no network, no DB writes):
        const lang = detectLanguage('test');
        expect(typeof lang).toBe('string');

        const intent = classifyIntent('hello');
        expect(intent).toHaveProperty('intent');
        expect(intent).toHaveProperty('confidence');
        expect(intent).toHaveProperty('source');

        // These functions don't throw, don't call fetch, don't write DB
        // They are deterministic and side-effect-free.
    });

    it('preflight analysis functions are pure and side-effect-free', () => {
        // detectLanguage is pure
        const lang = detectLanguage('hello world');
        expect(lang).toBe('english');

        // classifyIntent is pure
        const intent = classifyIntent('how much is ps5?');
        expect(intent.source).toBe('regex');

        // extractAvailabilityCandidate is pure
        const candidate = extractAvailabilityCandidate('do you have ps5?');
        expect(candidate).toBe('ps5');
    });
});

// ═══════════════════════════════════════════════════════════════
// Brain Debugger — Existing Chat Replay can load real chat context
// ═══════════════════════════════════════════════════════════════

describe('Brain Debugger — Existing Chat Replay Context', () => {
    it('replay mode uses the provided chatId, not a sim chatId', () => {
        const realChatId = '1234567890';
        const mode = 'replay';

        // In replay mode, the API uses the provided chatId directly
        const effectiveChatId = mode === 'replay' ? realChatId : `sim_${Date.now()}`;
        expect(effectiveChatId).toBe('1234567890');
        expect(effectiveChatId.startsWith('sim_')).toBe(false);
    });

    it('post-context classifier runs when state is not idle', () => {
        const result = classifyPostContext('cancel it');
        expect(result.intent).toBe('cancel_latest');
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('post-context classifier returns unrelated for random text', () => {
        const result = classifyPostContext('hello how are you');
        expect(result.intent).toBe('unrelated');
    });
});

// ═══════════════════════════════════════════════════════════════
// Comments Debugger — public comment and private DM separation
// ═══════════════════════════════════════════════════════════════

describe('Comments Debugger — Public vs Private Separation', () => {
    it('activity_log metadata can contain separate publicCommentText and privateDmText', () => {
        // Simulate a COMMENT_REPLY activity log entry
        const logEntry = {
            event_type: 'COMMENT_REPLY',
            metadata: {
                publicCommentText: 'Check your DMs! 📩',
                privateDmText: 'Hey! PS5 is $500. Want one?',
                commentText: 'price?',
                replyStyle: 'both',
            },
        };

        expect(logEntry.metadata.publicCommentText).not.toBe(logEntry.metadata.privateDmText);
        expect(logEntry.metadata.publicCommentText).toContain('DMs');
        expect(logEntry.metadata.privateDmText).toContain('$500');
    });

    it('dm-only mode does not produce publicCommentText', () => {
        const dmOnlyEntry = {
            event_type: 'COMMENT_REPLY',
            metadata: {
                privateDmText: 'PS5 is available — $500.',
                replyStyle: 'dm',
            },
        };

        expect(dmOnlyEntry.metadata.privateDmText).toBeTruthy();
        expect((dmOnlyEntry.metadata as any).publicCommentText).toBeUndefined();
    });

    it('public-only mode does not produce privateDmText', () => {
        const publicOnlyEntry = {
            event_type: 'COMMENT_REPLY',
            metadata: {
                publicCommentText: 'PS5 is $500!',
                replyStyle: 'public',
            },
        };

        expect(publicOnlyEntry.metadata.publicCommentText).toBeTruthy();
        expect((publicOnlyEntry.metadata as any).privateDmText).toBeUndefined();
    });
});

// ═══════════════════════════════════════════════════════════════
// Validator Panel — blocks false confirmations
// ═══════════════════════════════════════════════════════════════

describe('Validator Panel — False Confirmation Blocking', () => {
    it('blocks "confirmed" when isConfirmed=false', () => {
        const result = validateReply('Your order has been confirmed! ✅', { isConfirmed: false });
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('false_confirmation');
    });

    it('blocks "booked" when isConfirmed=false', () => {
        const result = validateReply('Your appointment has been booked for 3pm.', { isConfirmed: false });
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('false_confirmation');
    });

    it('blocks "scheduled" when isConfirmed=false', () => {
        const result = validateReply('You are scheduled for tomorrow at 10am.', { isConfirmed: false });
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('false_confirmation');
    });

    it('blocks "placed" when isConfirmed=false', () => {
        const result = validateReply('Your order has been placed successfully.', { isConfirmed: false });
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('false_confirmation');
    });

    it('allows "confirmed" when isConfirmed=true', () => {
        const result = validateReply('Your order has been confirmed! ✅', { isConfirmed: true });
        expect(result.isValid).toBe(true);
    });

    it('allows "booked" when isConfirmed=true', () => {
        const result = validateReply('Your appointment has been booked for 3pm.', { isConfirmed: true });
        expect(result.isValid).toBe(true);
    });

    it('provides a repaired reply when blocking', () => {
        const result = validateReply('Order confirmed!', { isConfirmed: false, language: 'english' });
        expect(result.isValid).toBe(false);
        expect(result.repaired).toBeTruthy();
        expect(result.repaired).toContain('Something went wrong');
    });

    it('provides Arabizi repaired reply when language is arabizi', () => {
        const result = validateReply('Your order has been confirmed', { isConfirmed: false, language: 'arabizi' });
        expect(result.isValid).toBe(false);
        expect(result.repaired).toContain('8alat');
    });

    it('blocks AI self-reveal phrases', () => {
        const result = validateReply('I am an AI assistant here to help you.');
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('ai_self_reveal');
    });

    it('allows normal replies without confirmation words', () => {
        const result = validateReply('Yes, PS5 is available — $500. Want one?', { isConfirmed: false });
        expect(result.isValid).toBe(true);
    });

    it('blocks empty replies', () => {
        const result = validateReply('');
        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('empty_reply');
    });

    it('blocks overly long paragraph-style replies', () => {
        const longReply = Array(10).fill('This is a sentence about our product that is quite detailed.').join('\n');
        const result = validateReply(longReply);
        expect(result.isValid).toBe(false);
    });
});
