import { DeepSeekProvider } from './deepseek-provider';

export interface CompletionOptions {
  system?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  temperature: number;
  maxTokens: number;
  responseFormat?: 'json' | 'text';
}

export interface CompletionResult {
  text: string;
  usage?: { prompt: number; completion: number };
  latencyMs: number;
}

export interface LlmProvider {
  complete(options: CompletionOptions): Promise<CompletionResult>;
  name: string;
}

/**
 * Static fallback provider — used when all LLM APIs are unreachable.
 * Returns safe, non-hallucinating fallback responses.
 */
class StaticFallbackProvider implements LlmProvider {
  name = 'static-fallback';

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const lastMsg = options.messages[options.messages.length - 1]?.content || '';

    // Determine if this is a thinking-layer call or a response-gen call
    if (options.responseFormat === 'json') {
      // Thinking layer / intent classifier — return safe JSON
      return {
        text: JSON.stringify({
          intent: 'unknown',
          entities: {},
          confidence: 0,
          languageScript: 'english',
          needsClarification: true,
          sentimentScore: 0,
          urgencyLevel: 'low',
          // Thinking layer fallback
          intentAnalysis: 'Fallback — API unreachable',
          emotion: 'neutral',
          goal: 'gather_info',
          toolsNeeded: [],
          suggestedNextState: 'idle',
          customStrategy: 'Reply naturally and ask the customer what they need.',
        }),
        usage: { prompt: 0, completion: 0 },
        latencyMs: 0,
      };
    }

    // Response generation — safe fallback message
    return {
      text: "I'm having a small issue. One moment while I connect you to our staff.",
      usage: { prompt: 0, completion: 0 },
      latencyMs: 0,
    };
  }
}

// Factory with fallback chain:
export function createProvider(): LlmProvider {
  const provider = process.env.LLM_PROVIDER || 'deepseek';

  // If explicitly set to fallback, use it
  if (provider === 'fallback' || provider === 'static') {
    return new StaticFallbackProvider();
  }

  // Try DeepSeek (default)
  if (provider === 'deepseek') {
    // If no API key, return static fallback instead of crashing
    if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'mock-key') {
      if (process.env.NODE_ENV === 'test') {
        // In tests, return DeepSeekProvider anyway (it will be mocked)
        return new DeepSeekProvider();
      }
      console.warn('⚠️ [Provider] DEEPSEEK_API_KEY not set — using static fallback');
      return new StaticFallbackProvider();
    }
    return new DeepSeekProvider();
  }

  // Unknown provider — safe fallback
  console.warn(`⚠️ [Provider] Unknown provider "${provider}" — using static fallback`);
  return new StaticFallbackProvider();
}
