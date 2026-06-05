import OpenAI from 'openai';
import { LlmProvider, CompletionOptions, CompletionResult } from './llm-provider';

let deepseekClient: OpenAI | null = null;

export function getDeepseekClient(): OpenAI {
  if (!deepseekClient) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || (apiKey === 'mock-key' && process.env.NODE_ENV !== 'test')) {
      throw new Error(
        'DEEPSEEK_API_KEY is not configured. ' +
        'Set it in your .env file or environment variables.'
      );
    }
    deepseekClient = new OpenAI({ baseURL: 'https://api.deepseek.com/v1', apiKey });
  }
  return deepseekClient;
}

export class DeepSeekProvider implements LlmProvider {
  name = 'deepseek';

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const start = Date.now();
    
    const messages = [
      ...(options.system ? [{ role: 'system' as const, content: options.system }] : []),
      ...options.messages.map(m => ({
        role: m.role === 'system' ? ('system' as const) : m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.content
      }))
    ];

    const client = getDeepseekClient();
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      response_format: options.responseFormat === 'json'
        ? { type: 'json_object' }
        : undefined,
    });

    return {
      text: response.choices[0]?.message.content || '',
      usage: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
      },
      latencyMs: Date.now() - start,
    };
  }
}
