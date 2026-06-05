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

// Factory for easy switching:
export function createProvider(): LlmProvider {
  const provider = process.env.LLM_PROVIDER || 'deepseek';
  switch (provider) {
    case 'deepseek':
      return new DeepSeekProvider();
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
