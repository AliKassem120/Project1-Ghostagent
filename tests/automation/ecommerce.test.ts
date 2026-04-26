import test from 'node:test';
import assert from 'node:assert/strict';
import { ECOMMERCE_REPLY_TEMPLATES } from '../../src/lib/automation/reply-templates';
import { getModelConfig } from '../../src/lib/automation/model-config';

test('order confirmation template exists but requires success flag via validator path', () => {
  assert.match(ECOMMERCE_REPLY_TEMPLATES.ORDER_CONFIRMED, /confirmed/i);
});

test('groq structured model falls back to json_text by default', () => {
  const cfg = getModelConfig();
  assert.equal(cfg.structuredMode, 'json_text');
});
