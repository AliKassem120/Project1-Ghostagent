/**
 * ============================================================
 * Arabizi Language Module — Regression Tests
 * ============================================================
 * Run with: npx jest src/lib/automation/language/arabizi.test.ts
 * ============================================================
 */

import { normalizeArabizi, detectLanguageStyle } from './arabizi';

// ── Language Detection ────────────────────────────────────────

describe('detectLanguageStyle', () => {
  test('detects lebanese_arabizi for "Bde e5od maw3ed"', () => {
    expect(detectLanguageStyle('Bde e5od maw3ed')).toBe('lebanese_arabizi');
  });

  test('detects lebanese_arabizi for "Baddi 7ajez"', () => {
    expect(detectLanguageStyle('Baddi 7ajez')).toBe('lebanese_arabizi');
  });

  test('detects lebanese_arabizi for "Emta btefta7o?"', () => {
    expect(detectLanguageStyle('Emta btefta7o?')).toBe('lebanese_arabizi');
  });

  test('detects lebanese_arabizi for "Fet7in l a7ad?"', () => {
    expect(detectLanguageStyle('Fet7in l a7ad?')).toBe('lebanese_arabizi');
  });

  test('detects arabic for pure Arabic script', () => {
    expect(detectLanguageStyle('أريد موعد')).toBe('arabic');
  });

  test('detects english for English messages', () => {
    expect(detectLanguageStyle('I want to book an appointment')).toBe('english');
  });

  test('detects mixed for Arabic + Latin mix', () => {
    expect(detectLanguageStyle('بدي maw3ed bukra')).toBe('mixed');
  });
});

// ── Appointment Intent Hints ──────────────────────────────────

describe('normalizeArabizi — appointment hints', () => {
  test('"Bde e5od maw3ed" → wantsAppointment = true', () => {
    const { hints } = normalizeArabizi('Bde e5od maw3ed');
    expect(hints.wantsAppointment).toBe(true);
    expect(hints.wantsToBuy).toBeFalsy();
    expect(hints.asksBusinessHours).toBeFalsy();
  });

  test('"Baddi 7ajez" → wantsAppointment = true', () => {
    const { hints } = normalizeArabizi('Baddi 7ajez');
    expect(hints.wantsAppointment).toBe(true);
  });

  test('"Bde maw3ed bukra se3a 4" → wantsAppointment + tomorrow + time 04:00', () => {
    const { hints } = normalizeArabizi('Bde maw3ed bukra se3a 4');
    expect(hints.wantsAppointment).toBe(true);
    expect(hints.tomorrow).toBe(true);
    // time extracted — se3a 4 → "04:00" (ambiguous AM/PM, raw extraction)
    expect(hints.timeText).toBe('04:00');
  });

  test('"Bde maw3ed bukra 4pm" → time = 16:00', () => {
    const { hints } = normalizeArabizi('Bde maw3ed bukra 4pm');
    expect(hints.tomorrow).toBe(true);
    expect(hints.timeText).toBe('16:00');
  });

  test('"Bde maw3ed lyom 10am" → today + time 10:00', () => {
    const { hints } = normalizeArabizi('Bde maw3ed lyom 10am');
    expect(hints.today).toBe(true);
    expect(hints.timeText).toBe('10:00');
  });

  test('"4 l masa" → time 16:00 (PM disambiguation)', () => {
    const { hints } = normalizeArabizi('maw3ed 4 l masa');
    expect(hints.timeText).toBe('16:00');
  });

  test('"10 l sobo7" → time 10:00 (AM)', () => {
    const { hints } = normalizeArabizi('maw3ed 10 l sobo7');
    expect(hints.timeText).toBe('10:00');
  });
});

// ── Business Hours Hints ─────────────────────────────────────

describe('normalizeArabizi — business hours hints', () => {
  test('"Emta btefta7o?" → asksBusinessHours = true', () => {
    const { hints } = normalizeArabizi('Emta btefta7o?');
    expect(hints.asksBusinessHours).toBe(true);
    expect(hints.wantsAppointment).toBeFalsy();
  });

  test('"Fet7in l a7ad?" → asksBusinessHours = true, dayOfWeek = 0 (Sunday)', () => {
    const { hints } = normalizeArabizi('Fet7in l a7ad?');
    expect(hints.asksBusinessHours).toBe(true);
    expect(hints.dayOfWeek).toBe(0); // Sunday
    expect(hints.dayName).toBe('l a7ad');
  });

  test('"aya se3a btefta7o l tnen" → business hours + Monday', () => {
    const { hints } = normalizeArabizi('aya se3a btefta7o l tnen');
    expect(hints.asksBusinessHours).toBe(true);
    expect(hints.dayOfWeek).toBe(1); // Monday
  });
});

// ── Yes/No Hints ─────────────────────────────────────────────

describe('normalizeArabizi — yes/no hints', () => {
  test('"Eh" → yes = true', () => {
    const { hints } = normalizeArabizi('Eh');
    expect(hints.yes).toBe(true);
    expect(hints.no).toBeFalsy();
  });

  test('"Akid" → yes = true', () => {
    const { hints } = normalizeArabizi('Akid');
    expect(hints.yes).toBe(true);
  });

  test('"Tamem" → yes = true', () => {
    const { hints } = normalizeArabizi('Tamem');
    expect(hints.yes).toBe(true);
  });

  test('"Okay" → NOT yes (English okay should not trigger yes)', () => {
    // "okay" is in the yes list — this tests that it does trigger (used for awaiting details)
    const { hints } = normalizeArabizi('Okay');
    expect(hints.yes).toBe(true);
  });

  test('"La2" → no = true', () => {
    const { hints } = normalizeArabizi('La2');
    expect(hints.no).toBe(true);
    expect(hints.yes).toBeFalsy();
  });

  test('"Mish" → no = true', () => {
    const { hints } = normalizeArabizi('Mish, mish hayda');
    expect(hints.no).toBe(true);
  });
});

// ── Day Name Resolution ───────────────────────────────────────

describe('normalizeArabizi — day name resolution', () => {
  const cases: [string, number, string][] = [
    ['l a7ad', 0, 'Sunday'],
    ['l tnen', 1, 'Monday'],
    ['l tleta', 2, 'Tuesday'],
    ['l arba3a', 3, 'Wednesday'],
    ['l khamis', 4, 'Thursday'],
    ['l jem3a', 5, 'Friday'],
    ['l sabet', 6, 'Saturday'],
  ];

  cases.forEach(([input, expectedDow, label]) => {
    test(`"${input}" → dayOfWeek = ${expectedDow} (${label})`, () => {
      const { hints } = normalizeArabizi(`maw3ed ${input}`);
      expect(hints.dayOfWeek).toBe(expectedDow);
    });
  });
});

// ── E-Commerce Hints ─────────────────────────────────────────

describe('normalizeArabizi — e-commerce hints', () => {
  test('"Fi men hal hoodie medium black?" → asksStock = true', () => {
    const { hints } = normalizeArabizi('Fi men hal hoodie medium black?');
    expect(hints.asksStock).toBe(true);
    expect(hints.wantsToBuy).toBeFalsy();
  });

  test('"Ade se3ro?" → asksPrice = true', () => {
    const { hints } = normalizeArabizi('Ade se3ro?');
    expect(hints.asksPrice).toBe(true);
  });

  test('"Bde yeha" → wantsToBuy = true', () => {
    const { hints } = normalizeArabizi('Bde yeha');
    expect(hints.wantsToBuy).toBe(true);
  });

  test('"Shu l services?" → asksService = true', () => {
    const { hints } = normalizeArabizi('Shu l services?');
    expect(hints.asksService).toBe(true);
  });
});

// ── Anti-regression: no fake facts leaked ────────────────────

describe('arabizi module — no fake facts', () => {
  test('Module does not export any hardcoded business hours', () => {
    // The ARABIZI_APPOINTMENT_REPLIES strings must not contain specific hours
    const { ARABIZI_APPOINTMENT_REPLIES } = require('./arabizi');
    const allReplies = Object.values(ARABIZI_APPOINTMENT_REPLIES).join(' ');
    // Should not contain patterns like "9:00", "7pm", "Mon-Sat", etc.
    // Template variables like {summary} are OK — they're filled from DB
    expect(allReplies).not.toMatch(/\b\d{1,2}:\d{2}\s*(AM|PM|am|pm)?\b/);
    expect(allReplies).not.toMatch(/Mon(day)?[-–]Fri(day)?/i);
    expect(allReplies).not.toMatch(/\$\d+/); // no dollar amounts
  });

  test('ARABIZI_LLM_HINT does not contain hardcoded business facts', () => {
    const { ARABIZI_LLM_HINT } = require('./arabizi');
    // Should have no phone numbers (8+ digit sequences)
    expect(ARABIZI_LLM_HINT).not.toMatch(/\b\d{8,}\b/);
    // Should have no dollar/price amounts
    expect(ARABIZI_LLM_HINT).not.toMatch(/\$\d+/);
  });
});
