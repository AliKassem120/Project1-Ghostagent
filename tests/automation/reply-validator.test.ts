import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReply } from '../../src/lib/automation/reply-validator';

test('blocks unsafe confirmation', () => {
  const res = validateReply({ userMessage: 'ok', reply: 'Perfect — your order is confirmed.', templateReply: 'Send your details.' });
  assert.equal(res.ok, false);
});

test('blocks parroting', () => {
  const res = validateReply({ userMessage: 'I want a haircut', reply: 'I want a haircut what times are available', templateReply: 'Sure — what day and time would you like?' });
  assert.equal(res.ok, false);
  assert.equal(res.safeReply, 'Sure — what day and time would you like?');
});
