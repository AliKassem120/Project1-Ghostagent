import { describe, it, expect } from 'vitest';
import { validateThinkingResult, ThinkingResultSchema } from '@/lib/automation-v3/thinking-layer';

// ── validateThinkingResult ────────────────────────────────────

describe('validateThinkingResult — valid inputs', () => {
  const base = {
    intentAnalysis: 'Customer wants to buy a black hoodie',
    emotion: 'neutral and curious',
    goal: 'close_sale' as const,
    toolsNeeded: ['search_products'],
    suggestedNextState: 'awaiting_product',
    customStrategy: 'Show the black hoodie with scarcity if stock is low',
  };

  it('accepts a fully valid ThinkingResult', () => {
    const result = validateThinkingResult(base);
    expect(result.goal).toBe('close_sale');
    expect(result.toolsNeeded).toEqual(['search_products']);
    expect(result.suggestedNextState).toBe('awaiting_product');
  });

  it('accepts empty toolsNeeded array', () => {
    const result = validateThinkingResult({ ...base, toolsNeeded: [] });
    expect(result.toolsNeeded).toEqual([]);
  });

  it('accepts all valid goal values', () => {
    for (const goal of ['close_sale', 'gather_info', 'resolve_issue'] as const) {
      const result = validateThinkingResult({ ...base, goal });
      expect(result.goal).toBe(goal);
    }
  });

  it('accepts all valid suggestedNextState values', () => {
    const validStates = [
      'idle', 'collecting', 'confirming', 'complete', 'handoff',
      'awaiting_product', 'awaiting_variant', 'awaiting_order_details',
      'awaiting_checkout_confirmation', 'awaiting_service', 'awaiting_date_time',
      'awaiting_customer_details', 'awaiting_booking_confirmation',
      'post_order_modify', 'post_appointment_modify',
    ];
    for (const state of validStates) {
      const result = validateThinkingResult({ ...base, suggestedNextState: state });
      expect(result.suggestedNextState).toBe(state);
    }
  });

  it('accepts up to 4 valid tool names for ecommerce', () => {
    // ECOMMERCE_TOOLS has 5 entries; schema max is 4 — use a 4-item subset
    const tools = ['search_products', 'check_stock', 'get_business_hours', 'lookup_customer'];
    const result = validateThinkingResult({ ...base, toolsNeeded: tools });
    expect(result.toolsNeeded).toEqual(tools);
  });

  it('accepts all valid tool names for appointments', () => {
    const tools = ['check_slot', 'get_services', 'get_business_hours', 'lookup_customer'];
    const result = validateThinkingResult({ ...base, toolsNeeded: tools });
    expect(result.toolsNeeded).toEqual(tools);
  });
});

// ── Invalid goal ──────────────────────────────────────────────

describe('validateThinkingResult — invalid goal', () => {
  const base = {
    intentAnalysis: 'some intent',
    emotion: 'neutral',
    goal: 'gather_info' as const,
    toolsNeeded: [],
    suggestedNextState: 'idle',
    customStrategy: 'Reply naturally and helpfully',
  };

  it('rejects an unknown goal value', () => {
    expect(() =>
      validateThinkingResult({ ...base, goal: 'make_payment' as any })
    ).toThrow(/goal must be one of/i);
  });

  it('rejects an empty goal string', () => {
    expect(() =>
      validateThinkingResult({ ...base, goal: '' as any })
    ).toThrow();
  });
});

// ── Invalid toolsNeeded ───────────────────────────────────────

describe('validateThinkingResult — invalid toolsNeeded', () => {
  const base = {
    intentAnalysis: 'some intent',
    emotion: 'neutral',
    goal: 'gather_info' as const,
    toolsNeeded: [] as string[],
    suggestedNextState: 'idle',
    customStrategy: 'Reply naturally and helpfully',
  };

  it('rejects transactional write tool: place_order', () => {
    expect(() =>
      validateThinkingResult({ ...base, toolsNeeded: ['place_order'] })
    ).toThrow();
  });

  it('rejects transactional write tool: cancel_order', () => {
    expect(() =>
      validateThinkingResult({ ...base, toolsNeeded: ['cancel_order'] })
    ).toThrow();
  });

  it('rejects transactional write tool: book_appointment', () => {
    expect(() =>
      validateThinkingResult({ ...base, toolsNeeded: ['book_appointment'] })
    ).toThrow();
  });

  it('rejects transactional write tool: cancel_appointment', () => {
    expect(() =>
      validateThinkingResult({ ...base, toolsNeeded: ['cancel_appointment'] })
    ).toThrow();
  });

  it('rejects transactional write tool: reschedule_appointment', () => {
    expect(() =>
      validateThinkingResult({ ...base, toolsNeeded: ['reschedule_appointment'] })
    ).toThrow();
  });

  it('rejects unknown/hallucinated tool names', () => {
    expect(() =>
      validateThinkingResult({ ...base, toolsNeeded: ['send_email'] })
    ).toThrow();
  });

  it('rejects duplicate tools in toolsNeeded', () => {
    expect(() =>
      validateThinkingResult({ ...base, toolsNeeded: ['search_products', 'search_products'] })
    ).toThrow(/duplicate/i);
  });

  it('rejects more than 4 tools', () => {
    expect(() =>
      validateThinkingResult({
        ...base,
        toolsNeeded: ['search_products', 'check_stock', 'get_business_hours', 'lookup_customer', 'send_product_card'],
      })
    ).toThrow(/must not exceed 4/i);
  });

  it('rejects non-array toolsNeeded', () => {
    expect(() =>
      validateThinkingResult({ ...base, toolsNeeded: 'search_products' as any })
    ).toThrow();
  });
});

// ── Invalid suggestedNextState ────────────────────────────────

describe('validateThinkingResult — invalid suggestedNextState', () => {
  const base = {
    intentAnalysis: 'some intent',
    emotion: 'neutral',
    goal: 'gather_info' as const,
    toolsNeeded: [],
    suggestedNextState: 'idle',
    customStrategy: 'Reply naturally and helpfully',
  };

  it('rejects an unknown state', () => {
    expect(() =>
      validateThinkingResult({ ...base, suggestedNextState: 'pending_payment' })
    ).toThrow(/suggestedNextState must be one of/i);
  });

  it('rejects empty string state', () => {
    expect(() =>
      validateThinkingResult({ ...base, suggestedNextState: '' })
    ).toThrow();
  });
});

// ── Invalid string fields ─────────────────────────────────────

describe('validateThinkingResult — invalid string fields', () => {
  const base = {
    intentAnalysis: 'Customer wants info',
    emotion: 'neutral',
    goal: 'gather_info' as const,
    toolsNeeded: [],
    suggestedNextState: 'idle',
    customStrategy: 'Reply naturally and helpfully',
  };

  it('rejects empty intentAnalysis', () => {
    expect(() =>
      validateThinkingResult({ ...base, intentAnalysis: '' })
    ).toThrow(/intentAnalysis must not be empty/i);
  });

  it('rejects empty emotion', () => {
    expect(() =>
      validateThinkingResult({ ...base, emotion: '' })
    ).toThrow(/emotion must not be empty/i);
  });

  it('rejects customStrategy shorter than 10 chars', () => {
    expect(() =>
      validateThinkingResult({ ...base, customStrategy: 'Reply' })
    ).toThrow(/descriptive/i);
  });

  it('accepts customStrategy of exactly 10 chars', () => {
    const result = validateThinkingResult({ ...base, customStrategy: 'Reply now.' });
    expect(result.customStrategy).toBe('Reply now.');
  });
});

// ── Schema direct parse (edge cases) ─────────────────────────

describe('ThinkingResultSchema — direct parse', () => {
  it('safeParse returns success=false for completely empty object', () => {
    const result = ThinkingResultSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('safeParse returns success=false for null input', () => {
    const result = ThinkingResultSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('safeParse returns all field errors for empty object', () => {
    const result = ThinkingResultSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain('intentAnalysis');
      expect(paths).toContain('goal');
      expect(paths).toContain('suggestedNextState');
    }
  });
});
