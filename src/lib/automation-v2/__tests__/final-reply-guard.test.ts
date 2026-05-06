import { describe, expect, it } from 'vitest';
import { guardFinalReply } from '../validation/final-reply-guard';

describe('guardFinalReply', () => {
  it('blocks handoff control tokens from customer-visible replies', () => {
    const result = guardFinalReply({ replyText: '[HANDOFF]', sourcePath: 'test' });
    expect(result.shouldReply).toBe(false);
    expect(result.blockedReason).toBe('handoff_token');
  });

  it('blocks false order confirmations without DB success', () => {
    const result = guardFinalReply({ replyText: 'Order confirmed!', dbWriteAttempted: true, dbWriteSuccess: false, sourcePath: 'test' });
    expect(result.shouldReply).toBe(true);
    expect(result.replyText).toBe('Something went wrong. Please try again.');
    expect(result.blockedReason).toBe('db_write_not_successful');
  });

  it('allows confirmations when DB success is true', () => {
    const result = guardFinalReply({ replyText: 'Order confirmed!', dbWriteAttempted: true, dbWriteSuccess: true, sourcePath: 'test' });
    expect(result.shouldReply).toBe(true);
    expect(result.replyText).toBe('Order confirmed!');
  });

  it('uses Arabizi safe error for Arabizi false confirmations', () => {
    const result = guardFinalReply({ replyText: 'Tmm order-ak t2akkad!', language: 'arabizi', dbWriteAttempted: true, dbWriteSuccess: false, sourcePath: 'test' });
    expect(result.replyText).toBe('Fi 8alat. Jarreb kamen.');
  });
});
