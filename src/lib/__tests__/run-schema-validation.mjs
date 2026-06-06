/**
 * Node.js built-in test runner for ThinkingResultSchema validation.
 * Run: node src/lib/__tests__/run-schema-validation.mjs
 *
 * No external deps beyond zod (already in node_modules).
 * The canonical vitest suite is thinking-layer-schema.test.ts (runs via `pnpm test`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from '/workspace/app-c5md5tl4v7k1/tasks/ghostagent/node_modules/zod/index.js';

// ── Schema extracted from thinking-layer.ts ───────────────────

const ECOMMERCE_TOOLS = ['search_products', 'check_stock', 'get_business_hours', 'lookup_customer', 'send_product_card'];
const APPOINTMENT_TOOLS = ['check_slot', 'get_services', 'get_business_hours', 'lookup_customer'];
const ALL_ALLOWED_TOOLS = [...new Set([...ECOMMERCE_TOOLS, ...APPOINTMENT_TOOLS])];

const VALID_STATES = [
  'idle', 'collecting', 'confirming', 'complete', 'handoff',
  'awaiting_product', 'awaiting_variant', 'awaiting_order_details',
  'awaiting_checkout_confirmation', 'awaiting_service', 'awaiting_date_time',
  'awaiting_customer_details', 'awaiting_booking_confirmation',
  'post_order_modify', 'post_appointment_modify',
];

const TRANSACTIONAL_WRITE_TOOLS = [
  'place_order', 'cancel_order', 'book_appointment', 'cancel_appointment', 'reschedule_appointment',
];

const ThinkingResultSchema = z.object({
  intentAnalysis: z.string().min(1, 'intentAnalysis must not be empty'),
  emotion: z.string().min(1, 'emotion must not be empty'),
  // z.enum errorMap is not honoured in Zod v4 — use string+refine for predictable messages
  goal: z.string().refine(
    (v) => ['close_sale', 'gather_info', 'resolve_issue'].includes(v),
    { message: 'goal must be one of: close_sale, gather_info, resolve_issue' }
  ),
  // Transactional write tools are NOT in ALL_ALLOWED_TOOLS — the enum rejects them automatically
  toolsNeeded: z
    .array(z.enum(ALL_ALLOWED_TOOLS))
    .max(4, 'toolsNeeded must not exceed 4 tools')
    .refine(
      (tools) => new Set(tools).size === tools.length,
      { message: 'toolsNeeded must not contain duplicate tools' }
    ),
  // z.enum errorMap is not honoured in Zod v4 — use string+refine for predictable messages
  suggestedNextState: z.string().refine(
    (v) => VALID_STATES.includes(v),
    { message: `suggestedNextState must be one of: ${VALID_STATES.join(', ')}` }
  ),
  customStrategy: z.string().min(10, 'customStrategy must be descriptive (≥10 chars)'),
});

function validateThinkingResult(raw) {
  const parsed = ThinkingResultSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')} — ${i.message}`)
      .join('\n');
    throw new Error(`[ThinkingLayer] Schema validation failed:\n${issues}`);
  }
  return parsed.data;
}

// ── Base valid fixture ────────────────────────────────────────

const BASE = {
  intentAnalysis: 'Customer wants to buy a black hoodie',
  emotion: 'neutral and curious',
  goal: 'close_sale',
  toolsNeeded: ['search_products'],
  suggestedNextState: 'awaiting_product',
  customStrategy: 'Show the black hoodie with scarcity if stock is low',
};

// ── Valid inputs ──────────────────────────────────────────────

test('accepts a fully valid ThinkingResult', () => {
  const r = validateThinkingResult(BASE);
  assert.equal(r.goal, 'close_sale');
  assert.deepEqual(r.toolsNeeded, ['search_products']);
  assert.equal(r.suggestedNextState, 'awaiting_product');
});

test('accepts empty toolsNeeded array', () => {
  const r = validateThinkingResult({ ...BASE, toolsNeeded: [] });
  assert.deepEqual(r.toolsNeeded, []);
});

test('accepts all valid goal values', () => {
  for (const goal of ['close_sale', 'gather_info', 'resolve_issue']) {
    const r = validateThinkingResult({ ...BASE, goal });
    assert.equal(r.goal, goal);
  }
});

test('accepts all valid suggestedNextState values', () => {
  for (const state of VALID_STATES) {
    const r = validateThinkingResult({ ...BASE, suggestedNextState: state });
    assert.equal(r.suggestedNextState, state);
  }
});

test('accepts up to 4 ecommerce tool names', () => {
  // ECOMMERCE_TOOLS has 5 entries; schema max is 4 — use a 4-item subset
  const tools = ECOMMERCE_TOOLS.slice(0, 4);
  const r = validateThinkingResult({ ...BASE, toolsNeeded: tools });
  assert.deepEqual(r.toolsNeeded, tools);
});

test('accepts all appointment tool names (deduped)', () => {
  const tools = ['check_slot', 'get_services', 'get_business_hours', 'lookup_customer'];
  const r = validateThinkingResult({ ...BASE, toolsNeeded: tools });
  assert.deepEqual(r.toolsNeeded, tools);
});

// ── Invalid goal ──────────────────────────────────────────────

test('rejects an unknown goal value', () => {
  assert.throws(
    () => validateThinkingResult({ ...BASE, goal: 'make_payment' }),
    /goal must be one of/i
  );
});

test('rejects an empty goal string', () => {
  assert.throws(() => validateThinkingResult({ ...BASE, goal: '' }));
});

// ── Transactional write tool blocking ────────────────────────
// Transactional tools are not in ALL_ALLOWED_TOOLS — Zod v4 enum rejects them
// as unknown values before any .refine() fires. Assert they throw; no message constraint.

for (const badTool of TRANSACTIONAL_WRITE_TOOLS) {
  test(`rejects transactional write tool: ${badTool}`, () => {
    assert.throws(() => validateThinkingResult({ ...BASE, toolsNeeded: [badTool] }));
  });
}

// ── Other toolsNeeded violations ─────────────────────────────

test('rejects unknown/hallucinated tool names', () => {
  assert.throws(() => validateThinkingResult({ ...BASE, toolsNeeded: ['send_email'] }));
});

test('rejects duplicate tools in toolsNeeded', () => {
  assert.throws(
    () => validateThinkingResult({ ...BASE, toolsNeeded: ['search_products', 'search_products'] }),
    /duplicate/i
  );
});

test('rejects more than 4 tools', () => {
  assert.throws(
    () => validateThinkingResult({ ...BASE, toolsNeeded: ECOMMERCE_TOOLS }),  // 5 tools
    /must not exceed 4/i
  );
});

test('rejects non-array toolsNeeded', () => {
  assert.throws(() => validateThinkingResult({ ...BASE, toolsNeeded: 'search_products' }));
});

// ── Invalid state ─────────────────────────────────────────────

test('rejects an unknown state', () => {
  assert.throws(
    () => validateThinkingResult({ ...BASE, suggestedNextState: 'pending_payment' }),
    /suggestedNextState must be one of/i
  );
});

test('rejects empty string state', () => {
  assert.throws(() => validateThinkingResult({ ...BASE, suggestedNextState: '' }));
});

// ── Invalid string fields ─────────────────────────────────────

test('rejects empty intentAnalysis', () => {
  assert.throws(
    () => validateThinkingResult({ ...BASE, intentAnalysis: '' }),
    /intentAnalysis must not be empty/i
  );
});

test('rejects empty emotion', () => {
  assert.throws(
    () => validateThinkingResult({ ...BASE, emotion: '' }),
    /emotion must not be empty/i
  );
});

test('rejects customStrategy shorter than 10 chars', () => {
  assert.throws(
    () => validateThinkingResult({ ...BASE, customStrategy: 'Reply' }),
    /descriptive/i
  );
});

test('accepts customStrategy of exactly 10 chars', () => {
  const r = validateThinkingResult({ ...BASE, customStrategy: 'Reply now.' });
  assert.equal(r.customStrategy, 'Reply now.');
});

// ── safeParse edge cases ──────────────────────────────────────

test('safeParse returns success=false for empty object', () => {
  const result = ThinkingResultSchema.safeParse({});
  assert.equal(result.success, false);
});

test('safeParse returns success=false for null', () => {
  const result = ThinkingResultSchema.safeParse(null);
  assert.equal(result.success, false);
});

test('safeParse reports errors for intentAnalysis, goal, and suggestedNextState on empty object', () => {
  const result = ThinkingResultSchema.safeParse({});
  assert.equal(result.success, false);
  const paths = result.error.issues.map((i) => i.path[0]);
  assert.ok(paths.includes('intentAnalysis'));
  assert.ok(paths.includes('goal'));
  assert.ok(paths.includes('suggestedNextState'));
});
