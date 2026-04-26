/**
 * ============================================================
 * Arabizi Language Module — Regression Tests
 * ============================================================
 * Standalone runner — no test framework required.
 * Run with:  npx ts-node src/lib/automation/language/arabizi.test.ts
 *
 * If you have Jest set up, add /// <reference types="jest" />
 * at the top and this file works as a Jest spec too.
 * ============================================================
 */

import { normalizeArabizi, detectLanguageStyle, ARABIZI_APPOINTMENT_REPLIES, ARABIZI_LLM_HINT } from './arabizi';

// ── Tiny assertion helper (works without any test framework) ──
let passed = 0;
let failed = 0;
const results: string[] = [];

function assert(label: string, condition: boolean): void {
  if (condition) {
    passed++;
    results.push(`  ✅ ${label}`);
  } else {
    failed++;
    results.push(`  ❌ FAIL: ${label}`);
  }
}

function suite(name: string, fn: () => void): void {
  results.push(`\n📋 ${name}`);
  fn();
}

// ── Language Detection ────────────────────────────────────────

suite('detectLanguageStyle', () => {
  assert(
    '"Bde e5od maw3ed" → lebanese_arabizi',
    detectLanguageStyle('Bde e5od maw3ed') === 'lebanese_arabizi',
  );
  assert(
    '"Baddi 7ajez" → lebanese_arabizi',
    detectLanguageStyle('Baddi 7ajez') === 'lebanese_arabizi',
  );
  assert(
    '"Emta btefta7o?" → lebanese_arabizi',
    detectLanguageStyle('Emta btefta7o?') === 'lebanese_arabizi',
  );
  assert(
    '"Fet7in l a7ad?" → lebanese_arabizi',
    detectLanguageStyle('Fet7in l a7ad?') === 'lebanese_arabizi',
  );
  assert(
    'Arabic script → arabic',
    detectLanguageStyle('أريد موعد') === 'arabic',
  );
  assert(
    'English → english',
    detectLanguageStyle('I want to book an appointment') === 'english',
  );
  assert(
    'Mixed Arabic + Latin → mixed',
    detectLanguageStyle('بدي maw3ed bukra') === 'mixed',
  );
});

// ── Appointment Intent Hints ──────────────────────────────────

suite('normalizeArabizi — appointment hints', () => {
  const r1 = normalizeArabizi('Bde e5od maw3ed');
  assert('"Bde e5od maw3ed" → wantsAppointment', !!r1.hints.wantsAppointment);
  assert('"Bde e5od maw3ed" → NOT wantsToBuy', !r1.hints.wantsToBuy);
  assert('"Bde e5od maw3ed" → NOT asksBusinessHours', !r1.hints.asksBusinessHours);

  const r2 = normalizeArabizi('Baddi 7ajez');
  assert('"Baddi 7ajez" → wantsAppointment', !!r2.hints.wantsAppointment);

  const r3 = normalizeArabizi('Bde maw3ed bukra se3a 4');
  assert('"Bde maw3ed bukra se3a 4" → wantsAppointment', !!r3.hints.wantsAppointment);
  assert('"Bde maw3ed bukra se3a 4" → tomorrow', !!r3.hints.tomorrow);
  assert('"Bde maw3ed bukra se3a 4" → timeText = 04:00', r3.hints.timeText === '04:00');

  const r4 = normalizeArabizi('Bde maw3ed bukra 4pm');
  assert('"bukra 4pm" → tomorrow', !!r4.hints.tomorrow);
  assert('"bukra 4pm" → timeText = 16:00', r4.hints.timeText === '16:00');

  const r5 = normalizeArabizi('Bde maw3ed lyom 10am');
  assert('"lyom 10am" → today', !!r5.hints.today);
  assert('"lyom 10am" → timeText = 10:00', r5.hints.timeText === '10:00');

  const r6 = normalizeArabizi('maw3ed 4 l masa');
  assert('"4 l masa" → timeText = 16:00 (PM)', r6.hints.timeText === '16:00');

  const r7 = normalizeArabizi('maw3ed 10 l sobo7');
  assert('"10 l sobo7" → timeText = 10:00 (AM)', r7.hints.timeText === '10:00');
});

// ── Business Hours Hints ─────────────────────────────────────

suite('normalizeArabizi — business hours hints', () => {
  const r1 = normalizeArabizi('Emta btefta7o?');
  assert('"Emta btefta7o?" → asksBusinessHours', !!r1.hints.asksBusinessHours);
  assert('"Emta btefta7o?" → NOT wantsAppointment', !r1.hints.wantsAppointment);

  const r2 = normalizeArabizi('Fet7in l a7ad?');
  assert('"Fet7in l a7ad?" → asksBusinessHours', !!r2.hints.asksBusinessHours);
  assert('"Fet7in l a7ad?" → dayOfWeek = 0 (Sunday)', r2.hints.dayOfWeek === 0);

  const r3 = normalizeArabizi('aya se3a btefta7o l tnen');
  assert('"...l tnen" → asksBusinessHours', !!r3.hints.asksBusinessHours);
  assert('"...l tnen" → dayOfWeek = 1 (Monday)', r3.hints.dayOfWeek === 1);
});

// ── Yes/No Hints ─────────────────────────────────────────────

suite('normalizeArabizi — yes/no hints', () => {
  assert('"Eh" → yes', !!normalizeArabizi('Eh').hints.yes);
  assert('"Eh" → NOT no', !normalizeArabizi('Eh').hints.no);
  assert('"Akid" → yes', !!normalizeArabizi('Akid').hints.yes);
  assert('"Tamem" → yes', !!normalizeArabizi('Tamem').hints.yes);
  assert('"okay" → yes (triggers yes list)', !!normalizeArabizi('okay').hints.yes);
  assert('"La2" → no', !!normalizeArabizi('La2').hints.no);
  assert('"La2" → NOT yes', !normalizeArabizi('La2').hints.yes);
  assert('"Mish" → no', !!normalizeArabizi('Mish, mish hayda').hints.no);
});

// ── Day Name Resolution ───────────────────────────────────────

suite('normalizeArabizi — day name resolution', () => {
  const cases: [string, number][] = [
    ['l a7ad', 0],
    ['l tnen', 1],
    ['l tleta', 2],
    ['l arba3a', 3],
    ['l khamis', 4],
    ['l jem3a', 5],
    ['l sabet', 6],
  ];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  cases.forEach(([token, dow]) => {
    const { hints } = normalizeArabizi(`maw3ed ${token}`);
    assert(`"${token}" → dayOfWeek = ${dow} (${dayNames[dow]})`, hints.dayOfWeek === dow);
  });
});

// ── E-Commerce Hints ─────────────────────────────────────────

suite('normalizeArabizi — e-commerce hints', () => {
  assert(
    '"Fi men hal hoodie medium black?" → asksStock',
    !!normalizeArabizi('Fi men hal hoodie medium black?').hints.asksStock,
  );
  assert(
    '"Fi men hal hoodie..." → NOT wantsToBuy',
    !normalizeArabizi('Fi men hal hoodie medium black?').hints.wantsToBuy,
  );
  assert('"Ade se3ro?" → asksPrice', !!normalizeArabizi('Ade se3ro?').hints.asksPrice);
  assert('"Bde yeha" → wantsToBuy', !!normalizeArabizi('Bde yeha').hints.wantsToBuy);
  assert('"Shu l services?" → asksService', !!normalizeArabizi('Shu l services?').hints.asksService);
});

// ── Anti-regression: no fake facts ───────────────────────────

suite('arabizi module — no hardcoded business facts', () => {
  const allReplies = Object.values(ARABIZI_APPOINTMENT_REPLIES).join(' ');

  // No hardcoded times like "9:00 AM", "7pm", "18:00"
  const hasHardcodedTime = /\b\d{1,2}:\d{2}\s*(AM|PM|am|pm)?\b/.test(
    allReplies.replace(/\{[^}]+\}/g, ''), // strip {placeholders}
  );
  assert('ARABIZI_APPOINTMENT_REPLIES has no hardcoded clock times', !hasHardcodedTime);

  // No hardcoded Mon-Fri / Mon-Sat patterns
  assert(
    'ARABIZI_APPOINTMENT_REPLIES has no hardcoded day ranges',
    !/Mon(day)?[-–]Fri(day)?/i.test(allReplies),
  );

  // No dollar amounts
  assert(
    'ARABIZI_APPOINTMENT_REPLIES has no hardcoded prices',
    !/\$\d+/.test(allReplies),
  );

  // ARABIZI_LLM_HINT has no phone numbers
  assert(
    'ARABIZI_LLM_HINT has no hardcoded phone numbers',
    !/\b\d{8,}\b/.test(ARABIZI_LLM_HINT),
  );

  // ARABIZI_LLM_HINT has no dollar amounts
  assert(
    'ARABIZI_LLM_HINT has no hardcoded prices',
    !/\$\d+/.test(ARABIZI_LLM_HINT),
  );
});

// ── Summary ───────────────────────────────────────────────────

console.log('\n' + results.join('\n'));
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);

if (failed > 0) {
  console.error('\nSome tests failed.');
  process.exit(1);
} else {
  console.log('\nAll tests passed.');
}
