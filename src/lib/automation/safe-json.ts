import { z } from 'zod';

export function safeJsonParse<T = unknown>(raw: string): { ok: true; value: T } | { ok: false; error: string } {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || trimmed).trim();

  try {
    return { ok: true, value: JSON.parse(candidate) as T };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'invalid_json' };
  }
}

export function parseAndValidateJson<T>(raw: string, schema: z.ZodSchema<T>): { ok: true; value: T } | { ok: false; error: string } {
  const parsed = safeJsonParse(raw);
  if (!parsed.ok) return parsed;
  const validated = schema.safeParse(parsed.value);
  if (!validated.success) {
    return { ok: false, error: validated.error.message };
  }
  return { ok: true, value: validated.data };
}
