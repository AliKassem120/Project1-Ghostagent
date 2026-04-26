import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLanguage, chooseReplyLanguage } from '../../src/lib/automation/language';

test('detects arabizi appointment request', () => {
  const result = normalizeLanguage('Bde e5od maw3ed bukra se3a 11');
  assert.equal(result.detectedLanguage, 'arabizi');
  assert.equal(result.hints.wantsAppointment, true);
  assert.equal(result.hints.tomorrow, true);
});

test('detects arabic and fixed-language override', () => {
  const result = normalizeLanguage('بدي احجز موعد');
  assert.equal(result.detectedLanguage, 'arabic');
  assert.equal(chooseReplyLanguage('English', result.detectedLanguage), 'english');
});
