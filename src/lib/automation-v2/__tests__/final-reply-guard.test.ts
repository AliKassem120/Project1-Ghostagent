import { describe, expect, it } from 'vitest';
import { guardFinalReply } from '../validation/final-reply-guard';

describe('guardFinalReply', () => {
    it('blocks handoff tokens', () => {
        const result = guardFinalReply({ replyText: '[HANDOFF]', language: 'english' });
        expect(result.shouldReply).toBe(false);
        expect(result.blockedReason).toBe('handoff_token');
    });

    it('replaces false order success claims', () => {
        const result = guardFinalReply({
            replyText: 'Order confirmed!',
            language: 'english',
            dbWriteSuccess: false,
        });
        expect(result.shouldReply).toBe(true);
        expect(result.replyText).toBe('Something went wrong. Please try again.');
        expect(result.actionsToAdd).toContain('false_success_blocked');
    });

    it('replaces false appointment success claims', () => {
        const result = guardFinalReply({
            replyText: 'Appointment booked!',
            language: 'english',
            dbWriteSuccess: false,
        });
        expect(result.replyText).toBe('Something went wrong. Please try again.');
    });

    it('allows success claims after DB success', () => {
        const result = guardFinalReply({
            replyText: 'Order confirmed!',
            language: 'english',
            dbWriteSuccess: true,
        });
        expect(result.shouldReply).toBe(true);
        expect(result.replyText).toBe('Order confirmed!');
    });

    it('allows cancellation status explanations', () => {
        const result = guardFinalReply({
            replyText: 'Order is already cancelled.',
            language: 'english',
            dbWriteSuccess: false,
        });
        expect(result.shouldReply).toBe(true);
        expect(result.replyText).toBe('Order is already cancelled.');
    });

    it('uses exact Arabizi fallback for false confirmations', () => {
        const result = guardFinalReply({
            replyText: 'Tmm order-ak t2akkad!',
            language: 'arabizi',
            dbWriteSuccess: false,
        });
        expect(result.replyText).toBe('Fi 8alat. Jarreb kamen.');
    });
});
