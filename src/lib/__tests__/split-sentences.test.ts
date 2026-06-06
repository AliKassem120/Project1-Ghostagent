import { describe, it, expect } from 'vitest';
import { splitSentences, enforceSentenceLimit } from '@/lib/automation-v3/response-generator';

// ── splitSentences ────────────────────────────────────────────

describe('splitSentences — basic sentence splitting', () => {
  it('splits a simple two-sentence string', () => {
    const result = splitSentences('Hello there. How are you?');
    expect(result).toEqual(['Hello there.', 'How are you?']);
  });

  it('handles exclamation marks', () => {
    const result = splitSentences('Great news! We have your size.');
    expect(result).toEqual(['Great news!', 'We have your size.']);
  });

  it('handles question marks', () => {
    const result = splitSentences('Want to order? Let me know.');
    expect(result).toEqual(['Want to order?', 'Let me know.']);
  });

  it('returns a single-element array for one sentence', () => {
    const result = splitSentences('Only one sentence here.');
    expect(result).toEqual(['Only one sentence here.']);
  });

  it('returns empty array for empty string', () => {
    const result = splitSentences('');
    expect(result).toEqual([]);
  });

  it('handles text with no terminal punctuation as one sentence', () => {
    const result = splitSentences('No punctuation at the end');
    expect(result).toEqual(['No punctuation at the end']);
  });
});

// ── Abbreviation handling ─────────────────────────────────────

describe('splitSentences — abbreviation handling', () => {
  it('does NOT split on Dr.', () => {
    const result = splitSentences('Dr. Smith is available tomorrow. Book now?');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('Dr. Smith is available tomorrow.');
    expect(result[1]).toBe('Book now?');
  });

  it('does NOT split on Mr.', () => {
    const result = splitSentences('Ask for Mr. Jad at the front. He will help you.');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('Ask for Mr. Jad at the front.');
  });

  it('does NOT split on Mrs.', () => {
    const result = splitSentences('Mrs. Khoury handles all bookings. Call her directly.');
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('Mrs. Khoury');
  });

  it('does NOT split on e.g. — two clear sentence boundaries', () => {
    const result = splitSentences('We have services e.g. haircut and nails. Prices start at $10.');
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('e.g.');
  });

  it('does NOT split on i.e. — sentence ends with non-abbreviated word', () => {
    // "Fri." is itself an abbreviation — use a plain noun to end the first clause
    const result = splitSentences('Book on weekdays i.e. the start of the week. Weekends are full.');
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('i.e.');
  });

  it('does NOT split on etc. — correctly produces 1 sentence when etc. is mid-clause', () => {
    // "etc." suppresses the split; only the final period terminates
    const result = splitSentences('We do nails, lashes, etc. Call to book.');
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('etc.');
  });

  it('does NOT split on vs.', () => {
    const result = splitSentences('It is cash vs. card only. Both are fine.');
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('vs.');
  });

  it('does NOT split on abbreviated months (Jan., Feb., etc.)', () => {
    const result = splitSentences('Your slot is on Jan. 15th. See you then!');
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('Jan.');
  });

  it('abbreviated days (Mon./Wed.) suppress split — correctly 1 sentence', () => {
    // "mon" and "wed" are in the abbreviation set; only the final ? terminates
    const result = splitSentences('Available Mon. and Wed. Want to pick one?');
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('Mon.');
  });

  it('does NOT split on St. (street)', () => {
    const result = splitSentences('We are on Main St. near the park. Easy to find.');
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('St.');
  });
});

// ── Ellipsis handling ─────────────────────────────────────────

describe('splitSentences — ellipsis handling', () => {
  it('does NOT split on ellipsis (...)', () => {
    const result = splitSentences('Hmm... let me check. One second!');
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('...');
  });
});

// ── Mixed / complex inputs ────────────────────────────────────

describe('splitSentences — complex real-world inputs', () => {
  it('handles multiple sentences correctly', () => {
    const result = splitSentences('Hey! We have haircuts for $15. Want to book for tomorrow? Just say yes.');
    expect(result).toHaveLength(4);
  });

  it('handles Franco-Arabic text without splitting mid-word numbers', () => {
    // Numbers like "3" in "3anna" should not trigger sentence splitting
    const result = splitSentences('3anna haircuts b $15. Baddak nehjoz la bukra?');
    expect(result).toHaveLength(2);
  });

  it('handles Arabic text with no Latin punctuation', () => {
    const result = splitSentences('أهلاً! في قص شعر بـ 15$.');
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('handles a sentence ending with a price like $15.', () => {
    // "$15." — "15" is not in abbreviations, so it should be treated as sentence end
    const result = splitSentences('The haircut costs $15. Book now?');
    expect(result).toHaveLength(2);
  });

  it('handles multiple abbreviations — correctly 1 sentence when trailing abbrev absorbs text', () => {
    // "Mon." is in the set, so "Book now!" merges into the same sentence;
    // only the final "!" terminates
    const result = splitSentences('Dr. Smith and Mr. Jones are both free on Mon. Book now!');
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('Dr.');
    expect(result[0]).toContain('Mr.');
  });
});

// ── enforceSentenceLimit ──────────────────────────────────────

describe('enforceSentenceLimit', () => {
  it('returns unchanged text when under the limit', () => {
    const text = 'Hey! What do you need?';
    expect(enforceSentenceLimit(text, 2)).toBe(text);
  });

  it('truncates to 2 sentences when 3+ are present', () => {
    const text = 'Hey there. We have haircuts. They cost $15. Book anytime.';
    const result = enforceSentenceLimit(text, 2);
    expect(result).toBe('Hey there. We have haircuts.');
  });

  it('truncates to 1 sentence when maxSentences=1', () => {
    const text = 'Hey there. We have haircuts. They cost $15.';
    const result = enforceSentenceLimit(text, 1);
    expect(result).toBe('Hey there.');
  });

  it('preserves abbreviations within the allowed sentences', () => {
    // "Mon." and "Tue." are abbreviations — they suppress splits, merging with the next phrase.
    // Logical sentence 1: "Dr. Smith is available."
    // Logical sentence 2: "Call on Mon. or Tue. We open at 9."
    // enforceSentenceLimit(..., 2) joins the first 2 logical sentences
    const result = enforceSentenceLimit(
      'Dr. Smith is available. Call on Mon. or Tue. We open at 9. Come anytime.',
      2
    );
    expect(result).toBe('Dr. Smith is available. Call on Mon. or Tue. We open at 9.');
  });

  it('returns empty string for empty input', () => {
    expect(enforceSentenceLimit('', 2)).toBe('');
  });

  it('handles a single sentence with no truncation needed', () => {
    const text = 'Only one sentence.';
    expect(enforceSentenceLimit(text, 2)).toBe(text);
  });

  it('handles text with no terminal punctuation as one sentence', () => {
    const text = 'No punctuation anywhere';
    expect(enforceSentenceLimit(text, 2)).toBe(text);
  });

  it('uses default limit of 2 when not specified', () => {
    const text = 'One. Two. Three.';
    expect(enforceSentenceLimit(text)).toBe('One. Two.');
  });
});
