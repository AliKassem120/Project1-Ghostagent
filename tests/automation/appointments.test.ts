import test from 'node:test';
import assert from 'node:assert/strict';
import { APPOINTMENT_REPLY_TEMPLATES, applyTemplate } from '../../src/lib/automation/reply-templates';
import { validateReply } from '../../src/lib/automation/reply-validator';

test('ask date/time template is short', () => {
  assert.ok(APPOINTMENT_REPLY_TEMPLATES.ASK_DATE_TIME.length < 220);
});

test('slot available template stays deterministic', () => {
  const reply = applyTemplate(APPOINTMENT_REPLY_TEMPLATES.SLOT_AVAILABLE_NEED_DETAILS, { dateLabel: 'Tomorrow', timeLabel: '11:00 AM' });
  const validated = validateReply({ userMessage: 'Tomorrow at 11am', reply, templateReply: reply });
  assert.equal(validated.ok, true);
});
