export type ModelConfig = {
  chatModel: string;
  structuredModel: string;
  structuredMode: 'json_schema' | 'json_text';
};

const JSON_SCHEMA_COMPATIBLE = new Set([
  'openai/gpt-4o-mini',
  'openai/gpt-4.1-mini',
]);

export function getModelConfig(): ModelConfig {
  const chatModel = process.env.GROQ_CHAT_MODEL || 'llama-3.1-70b-versatile';
  const structuredModel = process.env.GROQ_STRUCTURED_MODEL || chatModel;

  const structuredMode: ModelConfig['structuredMode'] = JSON_SCHEMA_COMPATIBLE.has(structuredModel)
    ? 'json_schema'
    : 'json_text';

  return { chatModel, structuredModel, structuredMode };
}

export function assertStructuredModelCompatibility(): void {
  const config = getModelConfig();
  if (config.structuredMode === 'json_text' && process.env.NODE_ENV !== 'production') {
    console.warn(`[MODEL_CONFIG] GROQ_STRUCTURED_MODEL (${config.structuredModel}) does not support json_schema; using JSON text fallback.`);
  }
}
