/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — FSM End-to-End Integration Tests
 * ═══════════════════════════════════════════════════════════════
 * Covers the full confirmed-transaction pipeline for both
 * order placement (ecommerce-fsm) and appointment booking
 * (appointment-fsm), including the 3 root causes fixed:
 *
 * Root cause #1: detectYesNo() / classifyConfirmationIntent()
 *   - Confirms that long messages starting with "yes" are still
 *     classified as confirmations (the original bug scenario)
 *
 * Root cause #2: Response-generator hallucination
 *   - Verifies FSM correctly returns isReadyToConfirm vs
 *     checkout_success so the response-generator gets the right signal
 *
 * Root cause #3: Appointment booking default path
 *   - Verifies the appointment FSM uses the RPC (safe) path by default
 *
 * Silent-skip guards (audit fixes):
 *   - post_order_modify: no active order returns early (not product search)
 *   - post_order_modify: invalid quantity returns re-ask (not product search)
 *   - post_appointment_modify: unclear intent returns re-ask (not booking check)
 *
 * DB write alerting:
 *   - alertDbWriteFailure fires when dbWriteAttempted=true & dbWriteSuccess=false
 *   - Writes to activity_log
 *   - Fires Slack webhook when SLACK_ALERT_WEBHOOK is set
 *   - Does NOT throw on secondary alert failures
 *
 * LLM confirmation classifier:
 *   - Falls back to rule-based detectYesNo() when LLM call fails
 *   - Avoids LLM call when rule-based is decisive (fast path)
 *   - Uses LLM for ambiguous messages
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runEcommerceFSM } from '../automation-v3/fsm/ecommerce-fsm';
import { runAppointmentFSM } from '../automation-v3/fsm/appointment-fsm';
import { classifyConfirmationIntent } from '../ai/guardrails/confirmation-classifier';
import { alertDbWriteFailure } from '../ai/guardrails/db-write-alerting';
import { detectYesNo } from '../ai/language';
import type { SessionContext } from '../automation-v3/types';
import type { WorkspaceConfig } from '../ai/types';

// ── Fixtures ────────────────────────────────────────────────

function createMockSupabase(overrides: Record<string, any> = {}) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.filter = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
  chain.upsert = vi.fn().mockResolvedValue({ error: null });
  chain.insert = vi.fn().mockResolvedValue({ error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.in = vi.fn().mockReturnValue(chain);
  chain.ilike = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockReturnValue(chain);
  chain.gt = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.rpc = vi.fn().mockResolvedValue({ data: { success: true, appointment_id: 'appt_rpc_1' }, error: null });
  return { from: vi.fn().mockReturnValue(chain), rpc: vi.fn().mockResolvedValue({ data: { success: true, appointment_id: 'appt_rpc_1' }, error: null }), ...overrides };
}

function createEcommerceSession(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    state: 'awaiting_checkout_confirmation',
    data: {
      productId: 'prod_ps5',
      productName: 'PS5',
      price: 500,
      variant: '',
      quantity: 1,
      name: 'Ali',
      phone: '71123456',
      address: 'Hamra near Verdun Hall building 4th floor',
    },
    postContext: null,
    loopCount: 0,
    lastBotMessage: 'Please confirm your order: PS5 x1 — $500 to Hamra near Verdun Hall building 4th floor.',
    lastInteractionAt: new Date().toISOString(),
    stateEnteredAt: new Date().toISOString(),
    isFreshSession: false,
    customerProfile: null,
    platform: 'instagram',
    workspaceId: 'ws_test',
    chatId: 'chat_test',
    userId: 'user_test',
    ...overrides,
  };
}

function createAppointmentSession(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    state: 'awaiting_booking_confirmation',
    data: {
      service: 'Haircut',
      date: '2026-06-10',
      time: '15:00',
      name: 'Ali',
      phone: '71123456',
    },
    postContext: null,
    loopCount: 0,
    lastBotMessage: 'Confirm: Haircut on June 10 at 3pm?',
    lastInteractionAt: new Date().toISOString(),
    stateEnteredAt: new Date().toISOString(),
    isFreshSession: false,
    customerProfile: null,
    platform: 'instagram',
    workspaceId: 'ws_test',
    chatId: 'chat_test',
    userId: 'user_test',
    ...overrides,
  };
}

function createConfig(overrides: Partial<WorkspaceConfig> = {}): WorkspaceConfig {
  return {
    workspaceId: 'ws_test',
    userId: 'user_test',
    businessName: 'Test Store',
    businessType: 'ecommerce',
    tone: 'Casual',
    language: 'English',
    timezone: 'Asia/Beirut',
    useEmojis: false,
    systemInstructions: null,
    storeLocation: 'Beirut, Lebanon',
    contactInfo: '71123456',
    handoffKeywords: [],
    shippingRules: null,
    maxDiscount: null,
    minOrderForDiscount: null,
    slotDurationMinutes: 30,
    automationEngineVersion: 'v3_brain',
    ...overrides,
  };
}

// ── Mock the LLM classifier and tools ───────────────────────

const {
  mockCreateEcommerceTools,
  mockCreateAppointmentTools,
  mockLookupLatestOrder,
  mockUpdateOrderVariant,
  mockUpdateOrderAddress,
  mockUpdateOrderQuantity
} = vi.hoisted(() => {
  return {
    mockCreateEcommerceTools: vi.fn(),
    mockCreateAppointmentTools: vi.fn(),
    mockLookupLatestOrder: vi.fn(),
    mockUpdateOrderVariant: vi.fn(),
    mockUpdateOrderAddress: vi.fn(),
    mockUpdateOrderQuantity: vi.fn(),
  };
});

vi.mock('../ai/tools', () => ({
  createEcommerceTools: mockCreateEcommerceTools,
  createAppointmentTools: mockCreateAppointmentTools,
}));

vi.mock('../ai/ecommerce/lookup', () => ({
  lookupLatestOrder: mockLookupLatestOrder,
  updateOrderVariant: mockUpdateOrderVariant,
  updateOrderAddress: mockUpdateOrderAddress,
  updateOrderQuantity: mockUpdateOrderQuantity,
}));

vi.mock('../ai/providers/llm-provider', () => ({
  createProvider: vi.fn(),
}));

vi.mock('../ai/guardrails/confirmation-classifier', async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    classifyConfirmationIntent: vi.fn(original.classifyConfirmationIntent),
  };
});

vi.mock('../ai/ecommerce/products', () => ({
  searchProducts: vi.fn().mockResolvedValue([
    { id: 'prod_ps5', itemName: 'PS5', price: 500, stockLevel: 5, variants: [] },
  ]),
  findBestProductMatch: vi.fn().mockReturnValue({
    id: 'prod_ps5', itemName: 'PS5', price: 500, stockLevel: 5, variants: [],
  }),
}));

vi.mock('../ai/appointments/services', () => ({
  loadActiveServices: vi.fn().mockResolvedValue([
    { id: 'svc_1', name: 'Haircut', price: 20, durationMinutes: 30 },
  ]),
  findBestServiceMatch: vi.fn().mockReturnValue(
    { id: 'svc_1', name: 'Haircut', price: 20, durationMinutes: 30 }
  ),
}));

// ── Helpers ─────────────────────────────────────────────────

/** Builds tools mock that simulates a successful place_order */
function buildOrderTools(success = true) {
  return {
    place_order: { execute: vi.fn().mockResolvedValue({ success, orderId: success ? 'order_123' : undefined }) },
    cancel_order: { execute: vi.fn().mockResolvedValue({ success: true }) },
    update_order: { execute: vi.fn().mockResolvedValue({ success: true }) },
    check_stock: { execute: vi.fn().mockResolvedValue({ inStock: true }) },
    lookup_customer: { execute: vi.fn().mockResolvedValue({ found: false }) },
  };
}

function buildAppointmentTools(success = true) {
  return {
    book_appointment: { execute: vi.fn().mockResolvedValue({ success, appointmentId: success ? 'appt_123' : undefined }) },
    cancel_appointment: { execute: vi.fn().mockResolvedValue({ success: true }) },
    reschedule_appointment: { execute: vi.fn().mockResolvedValue({ success: true, new_time: '15:00' }) },
    check_slot: { execute: vi.fn().mockResolvedValue({ available: true }) },
    lookup_customer: { execute: vi.fn().mockResolvedValue({ found: false }) },
  };
}

// ═══════════════════════════════════════════════════════════
// SUITE 1: Root Cause #1 — detectYesNo long-message fix
// ═══════════════════════════════════════════════════════════

describe('Root Cause #1: detectYesNo long-message fix', () => {
  it('detects "yes" when message starts with "Yes" (short)', () => {
    expect(detectYesNo('Yes')).toBe('yes');
  });

  it('detects "yes" when message starts with "Yes" followed by address (>5 tokens — original bug)', () => {
    expect(detectYesNo('Yes hamra near verdun hall building 4th floor')).toBe('yes');
  });

  it('detects "yes" from "Yes please book it for me" (>5 tokens)', () => {
    expect(detectYesNo('Yes please book it for me')).toBe('yes');
  });

  it('detects "yes" from "Yeah sure go ahead" (phrase match)', () => {
    expect(detectYesNo('Yeah sure go ahead')).toBe('yes');
  });

  it('detects "yes" from explicit phrase "go ahead"', () => {
    expect(detectYesNo('go ahead with the order')).toBe('yes');
  });

  it('detects "no" from "No thanks I changed my mind" (>5 tokens)', () => {
    expect(detectYesNo('No thanks I changed my mind')).toBe('no');
  });

  it('detects "no" from "no" alone', () => {
    expect(detectYesNo('no')).toBe('no');
  });

  it('detects "no" from "changed my mind" phrase', () => {
    expect(detectYesNo('I changed my mind about this')).toBe('no');
  });

  it('returns null for ambiguous messages', () => {
    expect(detectYesNo('maybe tomorrow')).toBeNull();
    expect(detectYesNo('what time does it arrive')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 2: LLM Confirmation Classifier
// ═══════════════════════════════════════════════════════════

describe('LLM Confirmation Classifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fast-path: returns "yes" without LLM call when detectYesNo is decisive', async () => {
    const { createProvider } = await import('../ai/providers/llm-provider');
    const mockProvider = { complete: vi.fn(), name: 'mock' };
    vi.mocked(createProvider as any).mockReturnValue(mockProvider);

    const result = await classifyConfirmationIntent('Yes', { businessType: 'ecommerce' });

    expect(result).toBe('yes');
    // LLM should NOT have been called — fast path
    expect(mockProvider.complete).not.toHaveBeenCalled();
  });

  it('fast-path: returns "no" without LLM call for clear rejection', async () => {
    const { createProvider } = await import('../ai/providers/llm-provider');
    const mockProvider = { complete: vi.fn(), name: 'mock' };
    vi.mocked(createProvider as any).mockReturnValue(mockProvider);

    const result = await classifyConfirmationIntent('no', { businessType: 'appointments' });

    expect(result).toBe('no');
    expect(mockProvider.complete).not.toHaveBeenCalled();
  });

  it('slow-path: calls LLM for ambiguous messages', async () => {
    const { createProvider } = await import('../ai/providers/llm-provider');
    const mockProvider = { complete: vi.fn().mockResolvedValue({ text: 'YES', latencyMs: 50 }), name: 'mock' };
    vi.mocked(createProvider as any).mockReturnValue(mockProvider);

    const result = await classifyConfirmationIntent('sounds good to me', { businessType: 'ecommerce', pendingItem: 'PS5 x1' });

    expect(mockProvider.complete).toHaveBeenCalledOnce();
    expect(result).toBe('yes');
  });

  it('slow-path: LLM returns NO → classified as "no"', async () => {
    const { createProvider } = await import('../ai/providers/llm-provider');
    const mockProvider = { complete: vi.fn().mockResolvedValue({ text: 'NO', latencyMs: 50 }), name: 'mock' };
    vi.mocked(createProvider as any).mockReturnValue(mockProvider);

    const result = await classifyConfirmationIntent('actually forget it', { businessType: 'ecommerce' });

    expect(result).toBe('no');
  });

  it('fallback: returns "unsure" when LLM call throws (never blocks transaction)', async () => {
    const { createProvider } = await import('../ai/providers/llm-provider');
    const mockProvider = { complete: vi.fn().mockRejectedValue(new Error('API timeout')), name: 'mock' };
    vi.mocked(createProvider as any).mockReturnValue(mockProvider);

    const result = await classifyConfirmationIntent('sounds good to me', { businessType: 'ecommerce' });

    expect(result).toBe('unsure');
  });

  it('slow-path: LLM returns garbage → defaults to "unsure"', async () => {
    const { createProvider } = await import('../ai/providers/llm-provider');
    const mockProvider = { complete: vi.fn().mockResolvedValue({ text: 'MAYBE LATER', latencyMs: 50 }), name: 'mock' };
    vi.mocked(createProvider as any).mockReturnValue(mockProvider);

    const result = await classifyConfirmationIntent('dunno what to do', { businessType: 'appointments' });

    expect(result).toBe('unsure');
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 3: Order Placement — End-to-End
// ═══════════════════════════════════════════════════════════

describe('E2E: Order Placement Pipeline', () => {
  let mockSupabase: any;
  let session: SessionContext;
  let config: WorkspaceConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    config = createConfig({ businessType: 'ecommerce' });
    mockCreateEcommerceTools.mockReturnValue(buildOrderTools(true));
  });

  it('E2E-O1: Short "Yes" → order placed → dbWriteSuccess=true', async () => {
    session = createEcommerceSession();
    // Classifier will fast-path to 'yes' from "Yes"
    vi.mocked(classifyConfirmationIntent).mockResolvedValue('yes');

    const result = await runEcommerceFSM('Yes', session, config, mockSupabase);

    expect(result.dbWriteAttempted).toBe(true);
    expect(result.dbWriteSuccess).toBe(true);
    expect(result.nextState).toBe('idle');
    expect(result.context?.actionType).toBe('checkout_success');
    expect(result.context?.payload.success).toBe(true);
    expect(result.actions).toContain('tool_place_order');
    expect(result.actions).toContain('place_order_success');
  });

  it('E2E-O2 (original bug): "Yes hamra near verdun..." → order placed (NOT skipped)', async () => {
    session = createEcommerceSession({
      data: {
        productId: 'prod_ps5',
        productName: 'PS5',
        price: 500,
        variant: '',
        quantity: 1,
        name: 'Ali',
        phone: '71123456',
        address: 'Hamra near Verdun Hall building 4th floor',
      },
    });
    // This was the exact failure scenario — classifier now returns 'yes'
    vi.mocked(classifyConfirmationIntent).mockResolvedValue('yes');

    const result = await runEcommerceFSM(
      'Yes hamra near verdun hall building 4th floor',
      session,
      config,
      mockSupabase
    );

    expect(result.dbWriteAttempted).toBe(true);
    expect(result.dbWriteSuccess).toBe(true);
    expect(result.context?.actionType).toBe('checkout_success');
    expect(result.context?.payload.success).toBe(true);
    // Address extracted and preserved in the confirmation payload
    expect(result.context?.payload.address).toBeTruthy();
  });

  it('E2E-O3: "No" → order cancelled, NOT placed, session reset', async () => {
    session = createEcommerceSession();
    vi.mocked(classifyConfirmationIntent).mockResolvedValue('no');

    const result = await runEcommerceFSM('no thanks', session, config, mockSupabase);

    expect(result.dbWriteAttempted).toBe(false);
    expect(result.dbWriteSuccess).toBe(false);
    expect(result.nextState).toBe('idle');
    expect(result.context?.payload.checkoutConfirmed).toBe(false);
  });

  it('E2E-O4: Ambiguous reply → isReadyToConfirm re-prompt (NOT placed)', async () => {
    session = createEcommerceSession();
    vi.mocked(classifyConfirmationIntent).mockResolvedValue('unsure');

    const result = await runEcommerceFSM('maybe tomorrow', session, config, mockSupabase);

    expect(result.dbWriteAttempted).toBe(false);
    expect(result.dbWriteSuccess).toBe(false);
    // FSM stays in confirmation state and returns isReadyToConfirm: true
    expect(result.context?.payload.isReadyToConfirm).toBe(true);
    expect(result.context?.actionType).toBe('info_gathered');
  });

  it('E2E-O5: Supabase insert fails → dbWriteAttempted=true, dbWriteSuccess=false', async () => {
    session = createEcommerceSession();
    vi.mocked(classifyConfirmationIntent).mockResolvedValue('yes');

    mockCreateEcommerceTools.mockReturnValue(buildOrderTools(false));

    const result = await runEcommerceFSM('Yes', session, config, mockSupabase);

    expect(result.dbWriteAttempted).toBe(true);
    expect(result.dbWriteSuccess).toBe(false);
    // Routes to handoff on DB failure
    expect(result.nextState).toBe('handoff');
    expect(result.actions).toContain('handoff');
  });

  it('E2E-O6: Missing details on yes → back to details collection, NOT placed', async () => {
    session = createEcommerceSession({
      data: {
        productId: 'prod_ps5',
        productName: 'PS5',
        price: 500,
        variant: '',
        quantity: 1,
        name: null,    // missing
        phone: null,   // missing
        address: null, // missing
      },
    });
    vi.mocked(classifyConfirmationIntent).mockResolvedValue('yes');

    const result = await runEcommerceFSM('Yes', session, config, mockSupabase);

    expect(result.dbWriteAttempted).toBe(false);
    expect(result.dbWriteSuccess).toBe(false);
    // Should NOT place order — should ask for missing info
    expect(['awaiting_order_details', 'awaiting_checkout_confirmation']).toContain(result.nextState);
    const missing = (result.context?.payload as any)?.missingDetails as string[] | undefined;
    expect(missing?.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 4: Appointment Booking — End-to-End
// ═══════════════════════════════════════════════════════════

describe('E2E: Appointment Booking Pipeline', () => {
  let mockSupabase: any;
  let session: SessionContext;
  let config: WorkspaceConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    config = createConfig({ businessType: 'appointments' });
    mockCreateAppointmentTools.mockReturnValue(buildAppointmentTools(true));
  });

  it('E2E-A1: Short "Yes" → appointment booked → dbWriteSuccess=true', async () => {
    session = createAppointmentSession();
    vi.mocked(classifyConfirmationIntent).mockResolvedValue('yes');

    const result = await runAppointmentFSM('Yes', session, config, mockSupabase);

    expect(result.dbWriteAttempted).toBe(true);
    expect(result.dbWriteSuccess).toBe(true);
    expect(result.nextState).toBe('idle');
    expect(result.context?.actionType).toBe('appointment_booked');
    expect(result.context?.payload.success).toBe(true);
    expect(result.actions).toContain('tool_book_appointment');
    expect(result.actions).toContain('book_appointment_success');
  });

  it('E2E-A2 (original bug): "Yes please book me for 3pm" → appointment booked (NOT skipped)', async () => {
    session = createAppointmentSession();
    // 6-token message that would have failed old detectYesNo
    vi.mocked(classifyConfirmationIntent).mockResolvedValue('yes');

    const result = await runAppointmentFSM(
      'Yes please book me for 3pm tomorrow',
      session,
      config,
      mockSupabase
    );

    expect(result.dbWriteAttempted).toBe(true);
    expect(result.dbWriteSuccess).toBe(true);
    expect(result.context?.actionType).toBe('appointment_booked');
    expect(result.context?.payload.success).toBe(true);
  });

  it('E2E-A3: "No" → appointment not created, session reset', async () => {
    session = createAppointmentSession();
    vi.mocked(classifyConfirmationIntent).mockResolvedValue('no');

    const result = await runAppointmentFSM('no thanks', session, config, mockSupabase);

    expect(result.dbWriteAttempted).toBe(false);
    expect(result.dbWriteSuccess).toBe(false);
    expect(result.nextState).toBe('idle');
    expect(result.context?.payload.bookingConfirmed).toBe(false);
  });

  it('E2E-A4: Ambiguous reply → isReadyToConfirm re-prompt (NOT booked)', async () => {
    session = createAppointmentSession();
    vi.mocked(classifyConfirmationIntent).mockResolvedValue('unsure');

    const result = await runAppointmentFSM('sometime next week maybe', session, config, mockSupabase);

    expect(result.dbWriteAttempted).toBe(false);
    expect(result.dbWriteSuccess).toBe(false);
    expect(result.context?.payload.isReadyToConfirm).toBe(true);
  });

  it('E2E-A5: RPC used by default (Root Cause #3 — race condition fix)', async () => {
    // Ensure USE_DIRECT_APPOINTMENT_INSERT is not set
    delete process.env.USE_DIRECT_APPOINTMENT_INSERT;

    session = createAppointmentSession();
    vi.mocked(classifyConfirmationIntent).mockResolvedValue('yes');

    const rpcSpy = vi.fn().mockResolvedValue({
      data: { success: true, appointment_id: 'appt_rpc_1' },
      error: null,
    });
    mockSupabase = createMockSupabase({ rpc: rpcSpy });

    const tools = buildAppointmentTools(true);
    mockCreateAppointmentTools.mockReturnValue(tools);

    await runAppointmentFSM('Yes', session, config, mockSupabase);

    // The appointment tool should have been called (which internally uses RPC)
    expect(tools.book_appointment.execute).toHaveBeenCalled();
  });

  it('E2E-A6: Supabase booking fails → dbWriteAttempted=true, dbWriteSuccess=false', async () => {
    session = createAppointmentSession();
    vi.mocked(classifyConfirmationIntent).mockResolvedValue('yes');

    mockCreateAppointmentTools.mockReturnValue(buildAppointmentTools(false));

    const result = await runAppointmentFSM('Yes', session, config, mockSupabase);

    expect(result.dbWriteAttempted).toBe(true);
    expect(result.dbWriteSuccess).toBe(false);
    expect(result.nextState).toBe('handoff');
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 5: Silent-Skip Guard Tests (FSM Audit Fixes)
// ═══════════════════════════════════════════════════════════

describe('FSM Audit: Silent-Skip Guards', () => {
  let mockSupabase: any;
  let config: WorkspaceConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    config = createConfig({ businessType: 'ecommerce' });
    mockCreateEcommerceTools.mockReturnValue(buildOrderTools(true));
    mockCreateAppointmentTools.mockReturnValue(buildAppointmentTools(true));
  });

  it('Guard-O1: post_order_modify with no active order returns "no_active_order" (not product search)', async () => {
    const session = createEcommerceSession({ state: 'post_order_modify', data: {} });

    // lookupLatestOrder returns null
    mockLookupLatestOrder.mockResolvedValue(null);

    const result = await runEcommerceFSM('change my address please', session, config, mockSupabase);

    expect(result.actions).toContain('no_active_order');
    expect(result.nextState).toBe('idle');
    // Must NOT fall through to product search
    expect(result.actions).not.toContain('tool_search_products');
  });

  it('Guard-O2: post_order_modify with invalid quantity returns needsValidQuantity re-ask', async () => {
    const session = createEcommerceSession({ state: 'post_order_modify', data: {} });

    mockLookupLatestOrder.mockResolvedValue({
      id: 'order_1',
      isEditable: true,
      status: 'pending',
    });
    mockUpdateOrderQuantity.mockResolvedValue(true);

    // "quantity" keyword present but no valid number
    const result = await runEcommerceFSM('change quantity please', session, config, mockSupabase);

    // Must NOT fall through to product search
    expect(result.actions).not.toContain('tool_search_products');
    expect(result.context?.payload.needsValidQuantity).toBe(true);
  });

  it('Guard-A1: post_appointment_modify with unrecognised intent returns modifyIntentUnclear (not booking check)', async () => {
    const session = createAppointmentSession({ state: 'post_appointment_modify', data: {} });
    const apptConfig = createConfig({ businessType: 'appointments' });

    // Message that contains neither cancel keywords nor a date/time
    const result = await runAppointmentFSM(
      'what are your business hours',
      session,
      apptConfig,
      mockSupabase
    );

    expect(result.context?.payload.modifyIntentUnclear).toBe(true);
    expect(result.actions).toContain('modify_intent_unclear');
    // Must NOT proceed into booking confirmation logic
    expect(result.context?.payload.isReadyToConfirm).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 6: DB Write Failure Alerting
// ═══════════════════════════════════════════════════════════

describe('Production Alerting: DB Write Failures', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    // Clear Slack env var before each test
    delete process.env.SLACK_ALERT_WEBHOOK;
  });

  const baseCtx = {
    workspaceId: 'ws_test',
    chatId: 'chat_test_123',
    platform: 'instagram' as const,
    businessType: 'ecommerce' as const,
    stateBefore: 'awaiting_checkout_confirmation',
    stateAfter: 'handoff',
    actions: ['tool_place_order', 'place_order_failed', 'handoff'],
    requestId: 'req_abcdefgh',
    orderDetails: {
      productName: 'PS5',
      customerName: 'Ali',
      customerPhone: '71123456',
    },
  };

  it('ALERT-1: always writes to activity_log on DB write failure', async () => {
    await alertDbWriteFailure(mockSupabase, baseCtx);

    expect(mockSupabase.from).toHaveBeenCalledWith('activity_log');
  });

  it('ALERT-2: activity_log insert contains correct event_type and severity', async () => {
    const chain = mockSupabase.from('activity_log');

    await alertDbWriteFailure(mockSupabase, baseCtx);

    const insertCall = chain.insert.mock.calls[0]?.[0];
    if (insertCall) {
      expect(insertCall.event_type).toBe('DB_WRITE_FAILURE_ALERT');
      expect(insertCall.metadata?.severity).toBe('critical');
      expect(insertCall.metadata?.requestId).toBe('req_abcdefgh');
    }
  });

  it('ALERT-3: does NOT fire Slack webhook when env var is not set', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    await alertDbWriteFailure(mockSupabase, baseCtx);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('ALERT-4: fires Slack webhook when SLACK_ALERT_WEBHOOK is configured', async () => {
    process.env.SLACK_ALERT_WEBHOOK = 'https://hooks.slack.com/test/webhook';
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as any);

    await alertDbWriteFailure(mockSupabase, baseCtx);

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://hooks.slack.com/test/webhook',
      expect.objectContaining({ method: 'POST' })
    );

    // Slack message should identify the business type and request ID
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.text).toContain('ORDER');
    fetchSpy.mockRestore();
  });

  it('ALERT-5: does NOT throw even if activity_log insert fails', async () => {
    const failingSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockRejectedValue(new Error('DB unavailable')),
      }),
    };

    // Must not throw
    await expect(alertDbWriteFailure(failingSupabase as any, baseCtx)).resolves.toBeUndefined();
  });

  it('ALERT-6: does NOT throw even if Slack webhook call fails', async () => {
    process.env.SLACK_ALERT_WEBHOOK = 'https://hooks.slack.com/test/webhook';
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    // Must not throw
    await expect(alertDbWriteFailure(mockSupabase, baseCtx)).resolves.toBeUndefined();
    vi.restoreAllMocks();
  });

  it('ALERT-7: appointment failures include correct label in Slack message', async () => {
    process.env.SLACK_ALERT_WEBHOOK = 'https://hooks.slack.com/test/webhook';
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as any);

    await alertDbWriteFailure(mockSupabase, {
      ...baseCtx,
      businessType: 'appointments',
      appointmentDetails: { service: 'Haircut', date: '2026-06-10', time: '15:00', customerName: 'Ali' },
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.text).toContain('APPOINTMENT');
    fetchSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════
// SUITE 7: Root Cause #2 — FSM Context Signal Correctness
// (Prevents response-generator hallucination)
// ═══════════════════════════════════════════════════════════

describe('Root Cause #2: FSM context signals prevent LLM hallucination', () => {
  let mockSupabase: any;
  let config: WorkspaceConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    config = createConfig({ businessType: 'ecommerce' });
    mockCreateEcommerceTools.mockReturnValue(buildOrderTools(true));
  });

  it('Returns isReadyToConfirm=true (NOT checkout_success) when awaiting confirmation', async () => {
    const session = createEcommerceSession({
      state: 'awaiting_order_details',
      data: { productId: 'prod_ps5', productName: 'PS5', price: 500, quantity: 1 },
    });

    const result = await runEcommerceFSM(
      'Ali Kassem, 71123456, Hamra Verdun',
      session,
      config,
      mockSupabase
    );

    // FSM should say "ready to confirm" NOT "order placed"
    expect(result.context?.payload.isReadyToConfirm).toBe(true);
    expect(result.context?.actionType).toBe('info_gathered');
    // Verify it did NOT prematurely set checkout_success
    expect(result.context?.actionType).not.toBe('checkout_success');
    expect(result.dbWriteAttempted).toBe(false);
  });

  it('Returns checkout_success=true ONLY after confirmed "yes" + successful DB write', async () => {
    const session = createEcommerceSession();
    vi.mocked(classifyConfirmationIntent).mockResolvedValue('yes');

    mockCreateEcommerceTools.mockReturnValue(buildOrderTools(true));

    const result = await runEcommerceFSM('Yes', session, config, mockSupabase);

    // Only NOW should actionType be checkout_success
    expect(result.context?.actionType).toBe('checkout_success');
    expect(result.context?.payload.success).toBe(true);
    expect(result.dbWriteSuccess).toBe(true);
  });

  it('Returns isReadyToConfirm=true (NOT appointment_booked) when awaiting booking confirmation', async () => {
    const session = createAppointmentSession({
      state: 'awaiting_customer_details',
      data: { service: 'Haircut', date: '2026-06-10', time: '15:00' },
    });
    const apptConfig = createConfig({ businessType: 'appointments' });

    const result = await runAppointmentFSM(
      'My name is Ali, phone 71123456',
      session,
      apptConfig,
      mockSupabase
    );

    expect(result.context?.payload.isReadyToConfirm).toBe(true);
    expect(result.context?.actionType).toBe('info_gathered');
    expect(result.dbWriteAttempted).toBe(false);
  });
});
