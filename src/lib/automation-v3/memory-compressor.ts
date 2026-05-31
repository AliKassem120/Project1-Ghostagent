/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent V3 — Memory Compressor
 * ═══════════════════════════════════════════════════════════════
 * Instead of sending full conversation history to the LLM (expensive
 * and slow), compress older turns into a single summary sentence.
 * Only the most recent N turns are kept verbatim.
 *
 * This dramatically reduces token usage while preserving context:
 *   20 turns × ~50 tokens = 1,000 tokens → compressed to ~60 tokens
 *   + 4 recent turns × ~50 tokens = 200 tokens
 *   Total: ~260 tokens vs ~1,000 tokens (74% reduction)
 */

import { generateText } from 'ai';
import { v2log } from '@/lib/ai/logger';

/** Default number of recent turns to keep verbatim. */
const DEFAULT_MAX_RECENT_TURNS = 4;

/**
 * Compress conversation history by summarizing older turns
 * and keeping only the most recent `maxRecentTurns` verbatim.
 *
 * If the history is short enough, returns it unchanged.
 */
export async function compressConversationHistory(
  groqInstance: (modelId: string) => any,
  messages: Array<{ role: string; content: string }>,
  maxRecentTurns: number = DEFAULT_MAX_RECENT_TURNS
): Promise<Array<{ role: string; content: string }>> {
  // If the history is already short, no compression needed
  if (messages.length <= maxRecentTurns) {
    return messages;
  }

  // Split into old (to summarize) and recent (to keep)
  const oldMessages = messages.slice(0, -maxRecentTurns);
  const recentMessages = messages.slice(-maxRecentTurns);

  // Summarize the older messages
  const summary = await summarizeTurns(groqInstance, oldMessages);

  if (!summary) {
    // If summarization fails, just return the recent turns
    // (still better than sending the full history)
    v2log.warn('MEMORY_COMPRESSOR', 'Summarization failed, returning recent turns only');
    return recentMessages;
  }

  v2log.info('MEMORY_COMPRESSOR', 'Compressed conversation history', {
    originalTurns: messages.length,
    compressedTurns: recentMessages.length + 1,
    summaryLength: summary.length,
  });

  return [
    { role: 'system', content: `[Earlier conversation summary: ${summary}]` },
    ...recentMessages,
  ];
}

/**
 * Summarize a block of conversation turns into 1–2 sentences
 * using the cheap fast model (Groq llama-3.1-8b-instant).
 */
async function summarizeTurns(
  groqInstance: (modelId: string) => any,
  turns: Array<{ role: string; content: string }>
): Promise<string> {
  if (turns.length === 0) return '';

  const transcript = turns
    .map(t => `${t.role === 'user' ? 'Customer' : 'Agent'}: ${t.content}`)
    .join('\n');

  try {
    const result = await generateText({
      model: groqInstance('llama-3.1-8b-instant'),
      system:
        'Summarize this customer service conversation in 1-2 sentences. ' +
        'Focus on: what the customer wanted, what they discussed, and the outcome or current state. ' +
        'Do NOT include greetings or filler. Be extremely concise.',
      prompt: transcript,
      temperature: 0,
      maxTokens: 80,
    });

    return result.text?.trim() || '';
  } catch (err) {
    v2log.error('MEMORY_COMPRESSOR', 'Failed to summarize conversation turns', { error: err });
    return '';
  }
}

/**
 * Estimate the approximate token count for a set of messages.
 * Uses the rough heuristic of 1 token ≈ 4 characters.
 */
export function estimateTokenCount(
  messages: Array<{ role: string; content: string }>
): number {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return Math.ceil(totalChars / 4);
}
