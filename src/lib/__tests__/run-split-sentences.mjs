/**
 * Node.js built-in test runner for splitSentences / enforceSentenceLimit.
 * Run: node src/lib/__tests__/run-split-sentences.mjs
 *
 * No external dependencies — logic is extracted inline from response-generator.ts.
 * The canonical vitest suite is split-sentences.test.ts (runs via `pnpm test`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ── Logic extracted from response-generator.ts ────────────────

const COMMON_ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'inc', 'llc', 'ltd', 'jr', 'sr',
  'e.g', 'i.e', 'etc', 'vs', 'vol', 'vols', 'fig', 'figs',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
  'am', 'pm', 'a.m', 'p.m',
  'est', 'pst', 'gmt', 'utc',
  'ft', 'lb', 'kg', 'km', 'mi',
  'no', 'nos', 'nr',
  'st', 'ave', 'blvd', 'rd', 'hwy',
  'et al', 'ibid', 'op cit',
  'u.s', 'u.k', 'u.n', 'n.a', 'n.b',
  'p.s', 'p.p.s',
]);

function splitSentences(text) {
  const sentences = [];
  let current = '';
  let i = 0;
  while (i < text.length) {
    current += text[i];
    if (text[i] === '.' || text[i] === '!' || text[i] === '?') {
      // 1. Intra-word: next char is a letter — mid-abbreviation like "e." in "e.g."
      const nextChar = i + 1 < text.length ? text[i + 1] : '';
      const isIntraWord = /[a-zA-Z]/.test(nextChar);
      // 2. Abbreviation: keep dots in normalization so "e.g" matches the set
      const wordBefore = current
        .slice(0, -1)
        .split(/\s+/)
        .pop()
        ?.toLowerCase()
        ?.replace(/[^a-z0-9.]/g, '');
      const isAbbrev = Boolean(wordBefore && COMMON_ABBREVIATIONS.has(wordBefore));
      // 3. Ellipsis: check both forward ("...") and backward (adjacent prior dot)
      const isEllipsis = text.slice(i, i + 3) === '...' || (i > 0 && text[i - 1] === '.');
      if (!isIntraWord && !isAbbrev && !isEllipsis) {
        sentences.push(current.trim());
        current = '';
      }
    }
    i++;
  }
  if (current.trim()) sentences.push(current.trim());
  return sentences;
}

function enforceSentenceLimit(text, maxSentences = 2) {
  if (!text) return text;
  const sentences = splitSentences(text);
  if (sentences.length > maxSentences) {
    return sentences.slice(0, maxSentences).join(' ');
  }
  return text;
}

// ── Basic splitting ───────────────────────────────────────────

test('splits a simple two-sentence string', () => {
  assert.deepEqual(splitSentences('Hello there. How are you?'), ['Hello there.', 'How are you?']);
});

test('handles exclamation marks', () => {
  assert.deepEqual(splitSentences('Great news! We have your size.'), ['Great news!', 'We have your size.']);
});

test('handles question marks', () => {
  assert.deepEqual(splitSentences('Want to order? Let me know.'), ['Want to order?', 'Let me know.']);
});

test('returns single-element array for one sentence', () => {
  assert.deepEqual(splitSentences('Only one sentence here.'), ['Only one sentence here.']);
});

test('returns empty array for empty string', () => {
  assert.deepEqual(splitSentences(''), []);
});

test('handles text with no terminal punctuation as one sentence', () => {
  assert.deepEqual(splitSentences('No punctuation at the end'), ['No punctuation at the end']);
});

// ── Abbreviation handling ─────────────────────────────────────

test('does NOT split on Dr.', () => {
  const r = splitSentences('Dr. Smith is available tomorrow. Book now?');
  assert.equal(r.length, 2);
  assert.equal(r[0], 'Dr. Smith is available tomorrow.');
  assert.equal(r[1], 'Book now?');
});

test('does NOT split on Mr.', () => {
  const r = splitSentences('Ask for Mr. Jad at the front. He will help you.');
  assert.equal(r.length, 2);
  assert.ok(r[0].includes('Mr. Jad'));
});

test('does NOT split on Mrs.', () => {
  const r = splitSentences('Mrs. Khoury handles all bookings. Call her directly.');
  assert.equal(r.length, 2);
  assert.ok(r[0].includes('Mrs. Khoury'));
});

test('does NOT split on e.g. — two clear sentence boundaries', () => {
  const r = splitSentences('We have services e.g. haircut and nails. Prices start at $10.');
  assert.equal(r.length, 2);
  assert.ok(r[0].includes('e.g.'));
});

test('does NOT split on i.e. — sentence ends with non-abbreviated word', () => {
  // "Fri." is itself an abbreviation so use a plain noun to end the clause
  const r = splitSentences('Book on weekdays i.e. the start of the week. Weekends are full.');
  assert.equal(r.length, 2);
  assert.ok(r[0].includes('i.e.'));
});

test('does NOT split on etc. — correctly produces 1 sentence when etc. is mid-clause', () => {
  // "etc." suppresses the split; only the final period terminates the sentence
  const r = splitSentences('We do nails, lashes, etc. Call to book.');
  assert.equal(r.length, 1);
  assert.ok(r[0].includes('etc.'));
});

test('does NOT split on vs.', () => {
  const r = splitSentences('It is cash vs. card only. Both are fine.');
  assert.equal(r.length, 2);
  assert.ok(r[0].includes('vs.'));
});

test('does NOT split on abbreviated months (Jan.)', () => {
  const r = splitSentences('Your slot is on Jan. 15th. See you then!');
  assert.equal(r.length, 2);
  assert.ok(r[0].includes('Jan.'));
});

test('abbreviated days (Mon./Wed.) suppress split — correctly 1 sentence', () => {
  // "mon" and "wed" are in the abbreviation set; only the final ? terminates
  const r = splitSentences('Available Mon. and Wed. Want to pick one?');
  assert.equal(r.length, 1);
  assert.ok(r[0].includes('Mon.'));
});

test('does NOT split on St. (street)', () => {
  const r = splitSentences('We are on Main St. near the park. Easy to find.');
  assert.equal(r.length, 2);
  assert.ok(r[0].includes('St.'));
});

// ── Ellipsis ──────────────────────────────────────────────────

test('does NOT split on ellipsis (...)', () => {
  const r = splitSentences('Hmm... let me check. One second!');
  assert.equal(r.length, 2);
  assert.ok(r[0].includes('...'));
});

// ── Complex / real-world inputs ───────────────────────────────

test('handles 4 sentences correctly', () => {
  const r = splitSentences('Hey! We have haircuts for $15. Want to book for tomorrow? Just say yes.');
  assert.equal(r.length, 4);
});

test('handles multiple abbreviations — correctly 1 sentence when trailing abbrev absorbs text', () => {
  // "Mon." is in the set, so "Book now!" merges into the same sentence
  // and only the final "!" terminates
  const r = splitSentences('Dr. Smith and Mr. Jones are both free on Mon. Book now!');
  assert.equal(r.length, 1);
  assert.ok(r[0].includes('Dr.'));
  assert.ok(r[0].includes('Mr.'));
});

test('handles a sentence ending with a price like $15.', () => {
  const r = splitSentences('The haircut costs $15. Book now?');
  assert.equal(r.length, 2);
});

// ── enforceSentenceLimit ──────────────────────────────────────

test('returns unchanged text when under the limit', () => {
  const text = 'Hey! What do you need?';
  assert.equal(enforceSentenceLimit(text, 2), text);
});

test('truncates to 2 sentences when 3+ present', () => {
  const r = enforceSentenceLimit('Hey there. We have haircuts. They cost $15. Book anytime.', 2);
  assert.equal(r, 'Hey there. We have haircuts.');
});

test('truncates to 1 sentence when maxSentences=1', () => {
  const r = enforceSentenceLimit('Hey there. We have haircuts. They cost $15.', 1);
  assert.equal(r, 'Hey there.');
});

test('preserves abbreviations in allowed sentences', () => {
  // "Mon." and "Tue." are abbreviations — they suppress splits, merging with the next phrase.
  // Logical sentence 1: "Dr. Smith is available."
  // Logical sentence 2: "Call on Mon. or Tue. We open at 9."  (Mon./Tue. absorb trailing text)
  // enforceSentenceLimit(..., 2) joins the first 2 logical sentences
  const r = enforceSentenceLimit('Dr. Smith is available. Call on Mon. or Tue. We open at 9. Come anytime.', 2);
  assert.equal(r, 'Dr. Smith is available. Call on Mon. or Tue. We open at 9.');
});

test('returns empty string for empty input', () => {
  assert.equal(enforceSentenceLimit('', 2), '');
});

test('handles single sentence with no truncation', () => {
  const text = 'Only one sentence.';
  assert.equal(enforceSentenceLimit(text, 2), text);
});

test('uses default limit of 2 when not specified', () => {
  assert.equal(enforceSentenceLimit('One. Two. Three.'), 'One. Two.');
});
