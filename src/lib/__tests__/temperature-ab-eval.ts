/**
 * A/B Evaluation: Temperature 0.4 vs 0.55
 *
 * Runs both temperature settings against a set of real-world conversation
 * transcripts and scores each reply on:
 *  - Length (word count) — lower is better for DM-style
 *  - Banned phrase presence — 0 = clean, 1 = robotic
 *  - Sentence count — enforced max 2
 *  - Variance across 3 runs (std dev of word count) — higher = more natural
 *
 * Usage:
 *   pnpm tsx src/lib/__tests__/temperature-ab-eval.ts
 *
 * Requires DEEPSEEK_API_KEY (or whichever provider is configured) in env.
 */

import 'dotenv/config';
import { createProvider } from '@/lib/ai/providers/llm-provider';

// ── Types ─────────────────────────────────────────────────────

interface Transcript {
  id: string;
  description: string;
  systemPrompt: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  customerMessage: string;
  expectedTone: 'casual' | 'formal' | 'empathetic';
}

interface ReplyMetrics {
  text: string;
  wordCount: number;
  sentenceCount: number;
  hasBannedPhrase: boolean;
  bannedPhrasesFound: string[];
  hasAiSelfReference: boolean;
  tooLong: boolean;        // > 300 chars
  hasMarkdown: boolean;    // ** or numbered lists
  durationMs: number;
}

interface ABResult {
  transcriptId: string;
  description: string;
  temperature: number;
  run: number;
  metrics: ReplyMetrics;
}

// ── Banned phrases (mirrors voice-consistency-guard.ts) ───────

const BANNED_PHRASES = [
  'as an ai',
  'how may i assist',
  'how can i help you today',
  'i am here to help',
  'please let me know',
  'thank you for your patience',
  'your request has been processed',
  'is there anything else',
  'i understand your concern',
  'i apologize for the inconvenience',
  'we value your business',
  'have a great day',
  'best regards',
];

// ── Test transcripts (real-world DM patterns) ─────────────────

const TRANSCRIPTS: Transcript[] = [
  {
    id: 'ecom-greeting',
    description: 'First contact — customer says hi',
    systemPrompt: `You are the DM manager of "Beirut Threads", an online store.
You're chatting with a customer on Instagram DMs.
CRITICAL RULES:
1. MAX 2 SENTENCES. Short, texting-style.
2. Casual & friendly — like a cool employee texting a friend.
3. You may use up to 1 emoji when natural.
4. You are HUMAN. Never say you're an AI or bot.`,
    conversationHistory: [],
    customerMessage: 'Hala',
    expectedTone: 'casual',
  },
  {
    id: 'ecom-price-question',
    description: 'Customer asks about price of a specific product',
    systemPrompt: `You are the DM manager of "Beirut Threads", an online store.
You're chatting with a customer on Instagram DMs.
VERIFIED FACTS: Black hoodie — $35, in stock (7 units).
CRITICAL RULES:
1. MAX 2 SENTENCES. Short, texting-style.
2. Casual & friendly.
3. You may use up to 1 emoji when natural.
4. You are HUMAN. Never say you're an AI or bot.`,
    conversationHistory: [
      { role: 'user', content: 'Hala, addesh l black hoodie?' },
      { role: 'assistant', content: 'Hala! $35 w fi b stock 🙌' },
    ],
    customerMessage: 'Mnee7. w fi b size L?',
    expectedTone: 'casual',
  },
  {
    id: 'appt-booking',
    description: 'Customer wants to book an appointment',
    systemPrompt: `You are the DM manager of "Glow Studio", a beauty salon.
You're chatting with a customer on WhatsApp.
VERIFIED FACTS: Haircut — $15, 30 min. Available slots: tomorrow 2pm, 4pm.
CRITICAL RULES:
1. MAX 2 SENTENCES. Short, texting-style.
2. Professional & polished.
3. You are HUMAN. Never say you're an AI or bot.`,
    conversationHistory: [],
    customerMessage: 'Hi I want to book a haircut for tomorrow',
    expectedTone: 'formal',
  },
  {
    id: 'frustrated-customer',
    description: 'Customer is frustrated about a delayed order',
    systemPrompt: `You are the DM manager of "Beirut Threads", an online store.
You're chatting with a customer on Instagram DMs.
CRITICAL RULES:
1. MAX 2 SENTENCES. Short, texting-style.
2. De-escalate first. Acknowledge frustration without being dismissive.
3. No emojis when customer is frustrated.
4. You are HUMAN. Never say you're an AI or bot.`,
    conversationHistory: [
      { role: 'user', content: 'WHERE IS MY ORDER its been 2 weeks!!!' },
    ],
    customerMessage: 'I WANT A REFUND NOW',
    expectedTone: 'empathetic',
  },
  {
    id: 'returning-customer',
    description: 'Returning customer greeting with purchase history',
    systemPrompt: `You are the DM manager of "Beirut Threads", an online store.
You're chatting with a customer on Instagram DMs.
CUSTOMER MEMORY: Last ordered black hoodie 2 weeks ago. Total orders: 3.
CRITICAL RULES:
1. MAX 2 SENTENCES. Short, texting-style.
2. Casual & friendly.
3. Reference their history naturally — don't say "according to my notes".
4. You are HUMAN. Never say you're an AI or bot.`,
    conversationHistory: [],
    customerMessage: 'Hey, back again 😂',
    expectedTone: 'casual',
  },
  {
    id: 'out-of-stock',
    description: 'Customer asks for an out-of-stock item',
    systemPrompt: `You are the DM manager of "Beirut Threads", an online store.
You're chatting with a customer on Instagram DMs.
VERIFIED FACTS: Red hoodie — out of stock. Restock expected in 1 week.
CRITICAL RULES:
1. MAX 2 SENTENCES. Short, texting-style.
2. Casual & friendly. Create honest urgency for restock.
3. You are HUMAN. Never say you're an AI or bot.`,
    conversationHistory: [],
    customerMessage: 'Do you have the red hoodie in XL?',
    expectedTone: 'casual',
  },
];

// ── Scoring helpers ───────────────────────────────────────────

function countSentences(text: string): number {
  const matches = text.match(/[^.!?]+[.!?]+/g);
  return matches ? matches.length : 1;
}

function scoreReply(text: string, durationMs: number): ReplyMetrics {
  const lower = text.toLowerCase();
  const bannedPhrasesFound = BANNED_PHRASES.filter((p) => lower.includes(p));

  return {
    text,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    sentenceCount: countSentences(text),
    hasBannedPhrase: bannedPhrasesFound.length > 0,
    bannedPhrasesFound,
    hasAiSelfReference: /\bai\b|\bbot\b|artificial intelligence/i.test(text),
    tooLong: text.length > 300,
    hasMarkdown: /\*\*|^\d+\.\s/m.test(text),
    durationMs,
  };
}

// ── LLM call ─────────────────────────────────────────────────

async function callLLM(
  transcript: Transcript,
  temperature: number
): Promise<ReplyMetrics> {
  const provider = createProvider();

  const messages = [
    ...transcript.conversationHistory,
    { role: 'user' as const, content: transcript.customerMessage },
  ];

  const t0 = Date.now();
  const response = await provider.complete({
    system: transcript.systemPrompt,
    messages,
    temperature,
    maxTokens: 200,
  });
  const durationMs = Date.now() - t0;

  return scoreReply(response.text.trim(), durationMs);
}

// ── Standard deviation helper ─────────────────────────────────

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ── Main eval loop ────────────────────────────────────────────

const TEMPERATURES = [0.4, 0.55];
const RUNS_PER_TRANSCRIPT = 3;

async function runEval(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  GhostAgent A/B Eval: Temperature 0.4 vs 0.55    ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const allResults: ABResult[] = [];

  for (const transcript of TRANSCRIPTS) {
    console.log(`\n▶ Transcript: [${transcript.id}] ${transcript.description}`);
    console.log(`  Customer: "${transcript.customerMessage}"`);

    for (const temperature of TEMPERATURES) {
      console.log(`\n  Temperature: ${temperature}`);
      for (let run = 1; run <= RUNS_PER_TRANSCRIPT; run++) {
        const metrics = await callLLM(transcript, temperature);
        allResults.push({
          transcriptId: transcript.id,
          description: transcript.description,
          temperature,
          run,
          metrics,
        });

        const flags: string[] = [];
        if (metrics.hasBannedPhrase) flags.push(`🚫 banned: "${metrics.bannedPhrasesFound[0]}"`);
        if (metrics.hasAiSelfReference) flags.push('🤖 AI self-ref');
        if (metrics.tooLong) flags.push('📏 too long');
        if (metrics.hasMarkdown) flags.push('📋 markdown');

        console.log(
          `    Run ${run}: ${metrics.wordCount} words, ${metrics.sentenceCount} sentences, ` +
          `${metrics.durationMs}ms${flags.length ? ' | ' + flags.join(' ') : ' ✅'}`
        );
        console.log(`    Reply: "${metrics.text}"`);
      }
    }
  }

  // ── Aggregate summary ───────────────────────────────────────
  console.log('\n\n╔══════════════════════════════════════════════════╗');
  console.log('║  SUMMARY                                          ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  for (const temperature of TEMPERATURES) {
    const results = allResults.filter((r) => r.temperature === temperature);
    const wordCounts = results.map((r) => r.metrics.wordCount);
    const durations = results.map((r) => r.metrics.durationMs);
    const bannedCount = results.filter((r) => r.metrics.hasBannedPhrase).length;
    const aiRefCount = results.filter((r) => r.metrics.hasAiSelfReference).length;
    const tooLongCount = results.filter((r) => r.metrics.tooLong).length;
    const markdownCount = results.filter((r) => r.metrics.hasMarkdown).length;

    const avgWords = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
    const wordVariance = stdDev(wordCounts);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    // Per-transcript variance (measure of naturalness — higher = less repetitive)
    const perTranscriptVariance: number[] = [];
    for (const transcript of TRANSCRIPTS) {
      const group = results.filter((r) => r.transcriptId === transcript.id);
      perTranscriptVariance.push(stdDev(group.map((r) => r.metrics.wordCount)));
    }
    const avgVariance = perTranscriptVariance.reduce((a, b) => a + b, 0) / perTranscriptVariance.length;

    console.log(`Temperature ${temperature}:`);
    console.log(`  Total runs:        ${results.length}`);
    console.log(`  Avg word count:    ${avgWords.toFixed(1)} (lower = more concise)`);
    console.log(`  Word count std dev:${wordVariance.toFixed(2)} (global)`);
    console.log(`  Avg intra-run var: ${avgVariance.toFixed(2)} (higher = more natural variation)`);
    console.log(`  Avg latency:       ${avgDuration.toFixed(0)}ms`);
    console.log(`  Banned phrases:    ${bannedCount}/${results.length} replies`);
    console.log(`  AI self-references:${aiRefCount}/${results.length} replies`);
    console.log(`  Too long (>300ch): ${tooLongCount}/${results.length} replies`);
    console.log(`  Markdown detected: ${markdownCount}/${results.length} replies`);
    console.log();
  }

  // ── Per-transcript winner ───────────────────────────────────
  console.log('Per-Transcript Winner (by combined score):');
  console.log('  (lower banned + lower markdown + higher variance = better)\n');

  for (const transcript of TRANSCRIPTS) {
    const scores: Record<number, number> = {};
    for (const temperature of TEMPERATURES) {
      const group = allResults.filter(
        (r) => r.transcriptId === transcript.id && r.temperature === temperature
      );
      const bannedPenalty = group.filter((r) => r.metrics.hasBannedPhrase).length * 10;
      const markdownPenalty = group.filter((r) => r.metrics.hasMarkdown).length * 5;
      const tooLongPenalty = group.filter((r) => r.metrics.tooLong).length * 3;
      const aiPenalty = group.filter((r) => r.metrics.hasAiSelfReference).length * 15;
      const varianceBonus = -stdDev(group.map((r) => r.metrics.wordCount)); // negative = bonus
      scores[temperature] = bannedPenalty + markdownPenalty + tooLongPenalty + aiPenalty + varianceBonus;
    }

    const winner = TEMPERATURES.reduce((a, b) => (scores[a] <= scores[b] ? a : b));
    const tied = TEMPERATURES.every((t) => scores[t] === scores[TEMPERATURES[0]]);
    const label = tied ? 'TIE' : `temp=${winner}`;
    console.log(`  [${transcript.id}] → ${label}`);
    TEMPERATURES.forEach((t) => console.log(`    temp=${t}: score=${scores[t].toFixed(2)}`));
  }

  console.log('\n✅ Eval complete.\n');
}

runEval().catch(console.error);
