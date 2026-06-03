import OpenAI from 'openai';
import { v2log } from '@/lib/ai/logger';

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY || 'mock-key',
});

/** Default number of recent turns to keep verbatim. */
const DEFAULT_MAX_RECENT_TURNS = 4;

/**
 * Compress conversation history by summarizing older turns
 * and keeping only the most recent `maxRecentTurns` verbatim.
 *
 * If the history is short enough, returns it unchanged.
 */
export async function compressConversationHistory(
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
  const summary = await summarizeTurns(oldMessages);

  if (!summary) {
    // If summarization fails, just return the recent turns
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
 * using the deepseek-chat model.
 */
async function summarizeTurns(
  turns: Array<{ role: string; content: string }>
): Promise<string> {
  if (turns.length === 0) return '';

  const transcript = turns
    .map(t => `${t.role === 'user' ? 'Customer' : 'Agent'}: ${t.content}`)
    .join('\n');

  try {
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'Summarize this customer service conversation in 1-2 sentences. Focus on: what the customer wanted, what was discussed, and the outcome or current state. Do NOT include greetings or filler. Be extremely concise.'
        },
        {
          role: 'user',
          content: transcript
        }
      ],
      temperature: 0,
      max_tokens: 80,
    });

    return response.choices[0].message.content?.trim() || '';
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
