# GHOST AGENT — COMPLETE ENTERPRISE REFACTOR
## The Mission: Build the Best AI Customer Service SaaS in the World

---

## EXECUTIVE SUMMARY

GhostAgent automates Instagram/WhatsApp DMs for e-commerce and appointment businesses. Current version works but has three critical bugs (language detection failures, conversation loops, stale session recovery) and lacks enterprise-grade architecture (observability, resilience, scalability).

This refactor transforms GhostAgent from a working MVP into a production-grade, multi-tenant, globally-scalable AI automation platform.

---

## CURRENT ARCHITECTURE INVENTORY

### File Structure
```
src/lib/automation-v2/
├── agent.ts                    (25KB) — LLM fallback with tools
├── decision-engine.ts          (74KB) — Central orchestrator (TOO BIG)
├── index.ts                    (10KB) — V2 engine entrypoint
├── router.ts                   (5KB) — Workspace config + handoff keywords
├── language.ts                 (14KB) — Keyword-based language detection
├── llm-entity-extractor.ts     (7KB) — LLM product extraction
├── customer-history.ts         (2KB) — Customer lookup
├── customer-store.ts           (3KB) — Customer upsert
├── history.ts                  (5KB) — Conversation history loader
├── time.ts                     (10KB) — Time context builder
├── tools.ts                    (18KB) — Tool definitions for LLM
├── types.ts                    (5KB) — Shared types
├── logger.ts                   (6KB) — Logging utility
├── dictionaries.ts             (7KB) — Lebanese vocabulary
├── should-reply.ts             (5KB) — Reply gate
├── classify/
│   ├── intent-classifier.ts    — Regex + LLM fallback intent detection
│   ├── normalized-intent.ts    — Intent type definitions
│   └── post-context-classifier.ts — Follow-up intent detection
├── ecommerce/
│   ├── lookup.ts               — Order lookup/cancel
│   ├── products.ts             — Product search/match
│   ├── extract-product.ts      — Product candidate extraction
│   ├── cancel-orders.ts        — Order cancellation logic
│   └── orders.ts               — Order creation
├── appointments/
│   ├── lookup.ts               — Appointment lookup/cancel
│   ├── services.ts             — Service search/match
│   ├── hours.ts                — Business hours loader
│   └── cancel-appointments.ts  — Appointment cancellation
├── state/
│   ├── store.ts                — DB read/write for conversation_states
│   ├── types.ts                — FSM type definitions
│   ├── ecommerce-fsm.ts        (26KB) — E-commerce state machine
│   └── appointments-fsm.ts     (31KB) — Appointments state machine
├── replies/
│   └── reply-composer.ts       — LLM reply naturalization
├── validation/
│   ├── final-reply-guard.ts    — Pre-send validation
│   └── reply-validator.ts      — Reply content validation
└── __tests__/                  — Unit tests (insufficient coverage)

src/utils/
├── ghost-brain.ts              — Main entry point (routes to V2)
├── dm-debounce.ts              — Message buffering system
└── whatsapp-alerts.ts          — WhatsApp formatting

Database Tables:
- conversation_states (user_id, workspace_id, chat_id, workspace_type, stage, data, updated_at)
- dm_buffer (owner_id, sender_id, workspace_id, channel, buffered_text, reply_at, status, lock_expires_at)
- ai_settings (workspace configuration)
- orders / appointments / inventory / services / business_hours
- automation_runs (execution logs)
- activity_log (analytics)
```

### Current Data Flow
```
Webhook → dm-debounce.ts (5s buffer) → ghost-brain.ts → index.ts
→ should-reply gate → decision-engine.ts
  → If active state: FSM (ecommerce-fsm.ts / appointments-fsm.ts)
  → If idle: intent classifier → deterministic handler OR LLM agent
→ reply-composer.ts (naturalization) → final-reply-guard.ts → Send
```

---

## CRITICAL BUGS (P0 — Fix First)

### BUG 1: Language Detection Failure
**Symptom:** Franco-Arabic messages replied to in English. Mixed scripts confused.
**Root Cause:** `language.ts` uses keyword matching (`ARABIZI_SIGNALS` array). Mixed Arabic+Latin returns `'mixed'` → falls back to English. `agent.ts` `buildPrompt()` takes `replyLanguage` parameter — wrong detection poisons entire prompt.
**Impact:** Lebanese users (primary market) get English replies to Arabic messages. Churn.

### BUG 2: Infinite Conversation Loops  
**Symptom:** Bot asks same question repeatedly. User says "yes" → bot asks again.
**Root Cause:** `ecommerce-fsm.ts` `handleAwaitingOrderDetails()` — user says "yes" without providing name/phone/address → returns SAME state `awaiting_order_details` with SAME reply. No `loopCount`, no `lastBotMessage` comparison, no max retries.
**Impact:** Users abandon conversation. Support tickets. Bad reviews.

### BUG 3: Stale Session Recovery
**Symptom:** User says "hello" after 24h → bot continues old question about order details.
**Root Cause:** `state/store.ts` `loadConversationState()` loads state with NO timestamp check. `decision-engine.ts` checks `currentStage !== 'idle'` → runs FSM. No session timeout.
**Impact:** Confused users, failed conversions, frustrated customers.

---

## ARCHITECTURAL DEBT (P1 — Fix Second)

### DEBT 1: Monolithic Decision Engine (74KB)
Does intent classification, FSM routing, post-context handling, 15+ deterministic handlers, cancel logic, scoped cancels. Violates single responsibility. Hard to test, hard to debug.

### DEBT 2: LLM Has Transactional Tool Access
`agent.ts` gives `place_order`, `book_appointment` tools to LLM. But `decision-engine.ts` claims "transactional actions go through deterministic handlers." Two paths can place an order → conflicting logic, race conditions.

### DEBT 3: Multiple LLM Calls Per Message
Intent classification (if regex fails) → Entity extraction (if product match fails) → Full agent conversation → Reply composer. Up to 4 LLM calls per DM. Expensive and slow.

### DEBT 4: No Conversation Regression Testing
`__tests__` has unit tests but no end-to-end conversation flow tests. Can't verify "order a product" works after code changes.

### DEBT 5: No Rate Limiting or Abuse Protection
`dm-debounce.ts` buffers messages but doesn't prevent spam, harassment, or API abuse.

### DEBT 6: No Observability Beyond Logs
`v2log` writes to console. No metrics, no alerting, no dashboards. Flying blind in production.

### DEBT 7: No Human Handoff Context Transfer
When `[HANDOFF]` triggers, conversation context is lost. Human agent starts from zero.

### DEBT 8: No Multi-Channel Customer Identity
Instagram and WhatsApp conversations are isolated. Customer switching channels starts over.

---

## THE TARGET ARCHITECTURE

### Design Principles
1. **Deterministic over Generative:** Business logic (orders, appointments, payments) is code, not LLM prompts.
2. **LLM as Response Writer Only:** The LLM generates text. It never decides state, never calls transactional tools, never modifies data.
3. **Structured Everything:** Every LLM call returns JSON. No freestyle parsing.
4. **Session-First:** All conversation state is wrapped in a session with timeout, loop detection, and freshness.
5. **Event-Driven at Scale:** Webhooks enqueue. Workers process. No request timeouts.
6. **Observable by Default:** Every action emits a metric. Every error triggers an alert.
7. **Tested Conversations:** Every happy path and edge case has a regression test.

### New Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                    INGESTION LAYER                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│  │  Instagram  │  │  WhatsApp   │  │  Future: Messenger  │    │
│  │  Webhook    │  │  Webhook    │  │  Telegram, etc.     │    │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘    │
└─────────┼────────────────┼────────────────────────────────────┘
          │                │
┌─────────▼────────────────▼────────────────────────────────────┐
│              NORMALIZATION & SECURITY                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │  Signature  │  │  Message    │  │  Rate Limiter       │      │
│  │  Verify     │  │  Normalize  │  │  (Spam/Burst/Block) │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
└──────────────────────────┬────────────────────────────────────────┘
                           │
┌──────────────────────────▼────────────────────────────────────────┐
│              MESSAGE QUEUE (Redis/QStash)                            │
│  • Durable, retryable, observable                                   │
│  • Decouples webhook response from processing                       │
└──────────────────────────┬────────────────────────────────────────┘
                           │
┌──────────────────────────▼────────────────────────────────────────┐
│              PROCESSING WORKER                                       │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  SESSION MANAGER                                             │   │
│  │  • Load session (with 30-min timeout check)                  │   │
│  │  • Detect fresh session → greeting handler                   │   │
│  │  • Track loopCount, lastBotMessage, stateEntryTime           │   │
│  └──────────────────────┬─────────────────────────────────────┘   │
│                           │                                         │
│  ┌────────────────────────▼─────────────────────────────────────┐   │
│  │  INTENT CLASSIFIER (Lightweight)                               │   │
│  │  • Groq llama-3.1-8b-instant, JSON mode, ~50ms                 │   │
│  │  • Output: {intent, entities, confidence, language_script}     │   │
│  │  • Confidence < 0.7 → route to LLM response generator          │   │
│  └──────────────────────┬─────────────────────────────────────────┘   │
│                           │                                         │
│  ┌────────────────────────▼─────────────────────────────────────┐   │
│  │  ORCHESTRATOR / ROUTER                                         │   │
│  │  • If active FSM state + intent matches → FSM handler          │   │
│  │  • If idle + transactional intent → FSM entry point            │   │
│  │  • If idle + info intent → deterministic handler (no LLM)      │   │
│  │  • If idle + unclear intent → LLM response generator           │   │
│  └──────────────────────┬─────────────────────────────────────────┘   │
│                           │                                         │
│  ┌────────────────────────▼─────────────────────────────────────┐   │
│  │  FSM HANDLERS (Deterministic, Zero LLM)                        │   │
│  │  • E-commerce: product → variant → details → confirm → place   │   │
│  │  • Appointments: service → date/time → details → confirm      │   │
│  │  • All DB writes happen here. All business rules enforced.     │   │
│  └──────────────────────┬─────────────────────────────────────────┘   │
│                           │                                         │
│  ┌────────────────────────▼─────────────────────────────────────┐   │
│  │  RESPONSE GENERATOR (LLM — Text Only, No Tools)                │   │
│  │  • Receives: system instruction + context + required response    │   │
│  │  • Generates: natural language in user's detected script       │   │
│  │  • NO tools, NO DB access, NO state changes                     │   │
│  └──────────────────────┬─────────────────────────────────────────┘   │
│                           │                                         │
│  ┌────────────────────────▼─────────────────────────────────────┐   │
│  │  STATE VALIDATOR & PERSISTENCE                                 │   │
│  │  • Validate proposed next state against allowed transitions      │   │
│  │  • Enforce maxLoops per state                                    │   │
│  │  • Save to conversation_states with metadata                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼────────────────────────────────────────┐
│              OUTPUT LAYER                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐        │
│  │  Channel    │  │  Human      │  │  Analytics          │        │
│  │  Formatter  │  │  Handoff    │  │  (Metrics + Logs)   │        │
│  │  (Buttons,  │  │  (Context   │  │                     │        │
│  │   Lists)    │  │   Transfer) │  │                     │        │
│  └─────────────┘  └─────────────┘  └─────────────────────┘        │
└───────────────────────────────────────────────────────────────────┘
```

---

## FILE-BY-FILE IMPLEMENTATION PLAN

### NEW FILES TO CREATE

#### 1. `src/lib/automation-v3/session-manager.ts`
**Purpose:** Session lifecycle management — timeout detection, loop tracking, freshness.
**Interface:**
```typescript
export interface SessionContext {
  state: ConversationStage;
  data: StateData | null;
  postContext: PostActionContext | null;
  loopCount: number;
  lastBotMessage: string | null;
  lastInteractionAt: string; // ISO
  stateEnteredAt: string;    // ISO — when did we enter current state?
  isFreshSession: boolean;
  customerProfile: CustomerProfile | null;
}

export async function loadSession(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  chatId: string,
  workspaceType: WorkspaceType,
  platform: Platform
): Promise<SessionContext>;

export async function saveSession(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  chatId: string,
  workspaceType: WorkspaceType,
  session: SessionContext,
  platform: Platform
): Promise<void>;

export function isGreeting(message: string): boolean;
export function isFreshSessionTimeout(lastInteractionAt: string, timeoutMinutes?: number): boolean;
```
**Logic:**
- `SESSION_TIMEOUT_MINUTES = 30` (configurable per workspace)
- `loadSession` reads from `conversation_states`, checks `updated_at` or `data.updated_at`
- If timeout exceeded and state !== 'idle': clear to idle, preserve postContext, set `isFreshSession: true`
- Read `loopCount`, `lastBotMessage`, `stateEnteredAt` from `data` JSONB
- Load `customerProfile` from `customer_profiles` table (new table, see below)
- `saveSession` writes all metadata into `data` JSONB

#### 2. `src/lib/automation-v3/state-validator.ts`
**Purpose:** Enforce valid state transitions and loop limits.
**Interface:**
```typescript
export interface StateValidationResult {
  approvedStage: ConversationStage;
  resetLoop: boolean;
  forceMenu: boolean;
  reason?: string;
}

export function validateTransition(
  currentStage: ConversationStage,
  proposedNext: ConversationStage,
  loopCount: number,
  stateConfig?: Partial<StateConfig>
): StateValidationResult;

export function getStateConfig(stage: ConversationStage): StateConfig;
```
**State Configuration:**
```typescript
const DEFAULT_STATE_CONFIG: Record<ConversationStage, StateConfig> = {
  idle: { validNext: ['awaiting_product', 'awaiting_service', 'handoff'], maxLoops: 1, maxDurationMinutes: Infinity, fallbackState: 'idle' },
  awaiting_product: { validNext: ['awaiting_variant', 'awaiting_order_details', 'idle'], maxLoops: 3, maxDurationMinutes: 15, fallbackState: 'idle' },
  awaiting_variant: { validNext: ['awaiting_order_details', 'idle'], maxLoops: 2, maxDurationMinutes: 10, fallbackState: 'idle' },
  awaiting_order_details: { validNext: ['awaiting_checkout_confirmation', 'idle'], maxLoops: 3, maxDurationMinutes: 20, fallbackState: 'idle' },
  awaiting_checkout_confirmation: { validNext: ['idle', 'post_order_modify'], maxLoops: 2, maxDurationMinutes: 10, fallbackState: 'idle' },
  awaiting_service: { validNext: ['awaiting_date_time', 'idle'], maxLoops: 3, maxDurationMinutes: 15, fallbackState: 'idle' },
  awaiting_date_time: { validNext: ['awaiting_customer_details', 'idle'], maxLoops: 3, maxDurationMinutes: 15, fallbackState: 'idle' },
  awaiting_customer_details: { validNext: ['awaiting_booking_confirmation', 'idle'], maxLoops: 3, maxDurationMinutes: 20, fallbackState: 'idle' },
  awaiting_booking_confirmation: { validNext: ['idle', 'post_appointment_modify'], maxLoops: 2, maxDurationMinutes: 10, fallbackState: 'idle' },
  handoff: { validNext: ['idle'], maxLoops: 1, maxDurationMinutes: Infinity, fallbackState: 'idle' },
  post_order_modify: { validNext: ['idle'], maxLoops: 2, maxDurationMinutes: 30, fallbackState: 'idle' },
  post_appointment_modify: { validNext: ['idle'], maxLoops: 2, maxDurationMinutes: 30, fallbackState: 'idle' },
};
```
**Validation Rules:**
- If `proposedNext` not in `validNext` → return `currentStage` (reject)
- If `loopCount >= maxLoops` → return `fallbackState` + `forceMenu: true`
- If `(now - stateEnteredAt) > maxDurationMinutes` → return `fallbackState` + `forceMenu: true` (state timeout)
- If `proposedNext === currentStage` → `resetLoop: false` (increment loop)
- If `proposedNext !== currentStage` → `resetLoop: true` (new state, fresh start)

#### 3. `src/lib/automation-v3/intent-classifier.ts`
**Purpose:** Single lightweight LLM call for intent + entity + language detection.
**Interface:**
```typescript
export interface IntentClassification {
  intent: string;
  entities: Record<string, any>;
  confidence: number; // 0.0 - 1.0
  languageScript: 'english' | 'arabic' | 'franco' | 'mixed' | 'unknown';
  needsClarification: boolean;
  clarificationQuestion?: string;
}

export async function classifyIntent(
  message: string,
  workspaceType: WorkspaceType,
  context?: {
    currentStage?: ConversationStage;
    recentProduct?: string;
    recentService?: string;
    customerProfile?: CustomerProfile;
  }
): Promise<IntentClassification>;
```
**Implementation:**
- Use `groq('llama-3.1-8b-instant')` — 50ms, $0.0001 per call
- JSON mode: `response_format: { type: 'json_object' }`
- Temperature: 0.1 (deterministic)
- Max tokens: 150
- Prompt includes workspace type, available intents, and context
- **Never use regex fallback.** If 8b fails, retry once. If still fails, return `intent: 'unknown', confidence: 0`.

**Intent List (E-commerce):**
`greeting`, `purchase_intent`, `product_question`, `price_question`, `product_availability`, `order_status`, `cancel_order`, `modify_order`, `repeat_last_order`, `business_hours`, `location_question`, `shipping_question`, `human_handoff`, `frustration_stop`, `correction`, `small_talk`, `unknown`

**Intent List (Appointments):**
`greeting`, `booking_intent`, `service_question`, `price_question`, `service_availability`, `appointment_status`, `cancel_appointment`, `modify_appointment`, `reschedule_appointment`, `business_hours`, `location_question`, `human_handoff`, `frustration_stop`, `correction`, `small_talk`, `unknown`

#### 4. `src/lib/automation-v3/response-generator.ts`
**Purpose:** LLM text generation ONLY. No tools. No DB access. No state changes.
**Interface:**
```typescript
export interface ResponseContext {
  systemInstruction: string;        // Business rules, tone, language rule
  conversationHistory: Message[];   // Last 4 turns max
  currentState: ConversationStage;
  pendingAction?: string;
  customerProfile?: CustomerProfile;
  toolResults?: ToolResult[];       // Results from read-only tools
  requiredLanguageScript: string;
  channel: 'instagram' | 'whatsapp';
}

export async function generateResponse(
  context: ResponseContext
): Promise<{
  text: string;
  suggestedActions?: string[];
}>;
```
**System Prompt Template:**
```
You are the DM manager of {businessName}, {businessDescription}.
You're chatting with customers on {channel} DMs.
Date: {dayName}, {isoDate} at {isoTime}.

CRITICAL LANGUAGE RULE:
You MUST reply in the EXACT same language and script the user is using.
Supported scripts: English, Arabic (العربية), Lebanese Franco-Arabic (Latin + numbers 3,7,2,5).
If user mixes scripts, mirror the same mix. Never switch languages.
Never say "I only speak English." Never ask user to switch.

RULES:
1. Keep replies short: 1-3 sentences for WhatsApp, 1 sentence for quick replies.
2. Tone: {tone}
3. Emojis: {emojiRule}
4. NEVER echo back what user said.
5. NEVER make up prices, stock, or availability. Use provided tool results only.
6. For greetings: warm, short, natural. No tools needed.
7. For small talk: brief human response. Don't just ask "how can I help."
8. ONLY use [HANDOFF] if user explicitly asks for human agent.
9. You are HUMAN. Never say you're AI or bot.
10. If you don't know something, say so honestly. Offer to connect with human.

{toolResultsBlock}
{customerContextBlock}
```

**Key Change:** Remove `buildPrompt()` from `agent.ts`. The response generator receives a fully assembled context object. The LLM only writes text.

#### 5. `src/lib/automation-v3/templates.ts`
**Purpose:** Pre-built responses for common states. Skip LLM entirely.
**Interface:**
```typescript
export function getTemplate(
  templateId: string,
  languageScript: string,
  variables: Record<string, string | number>
): string | null;

export function hasTemplate(templateId: string): boolean;
```
**Templates:**
```typescript
const TEMPLATES: Record<string, Record<string, string>> = {
  greeting: {
    english: "Hey! How can I help? 👋",
    arabic: "مرحبا! كيف يمكنني مساعدتك؟ 👋",
    franco: "Hala! Kif fiye se3dak? 👋"
  },
  awaiting_product_ask: {
    english: "What would you like to order?",
    arabic: "ماذا تريد أن تطلب؟",
    franco: "Shu baddak tetlob?"
  },
  awaiting_order_details: {
    english: "{{productName}} — ${{price}}. Send your name, phone, and delivery address.",
    arabic: "{{productName}} — ${{price}}. أرسل اسمك ورقمك والعنوان.",
    franco: "{{productName}} — ${{price}}. B3atle ismak, ra2mak w el 3nwen."
  },
  order_confirmed: {
    english: "Order confirmed! ✅",
    arabic: "تم تأكيد الطلب! ✅",
    franco: "Tmm order-ak t2akkad! ✅"
  },
  loop_detected_menu: {
    english: "Let's start fresh! What would you like to do?
1. Browse products
2. Track my order
3. Talk to a human",
    arabic: "لنبدأ من جديد! ماذا تريد أن تفعل؟
1. تصفح المنتجات
2. تتبع طلبي
3. التحدث مع إنسان",
    franco: "Yalla mn el awal! Shu baddak ta3mel?
1. Dawwar products
2. Track order
3. Haki ma3 beshar"
  },
  // ... 30+ more templates
};
```
**Usage:** FSM handlers call `getTemplate()` first. If template exists, use it (0ms, $0). If not, call `generateResponse()`.

#### 6. `src/lib/automation-v3/guardrails/rate-limiter.ts`
**Purpose:** Prevent spam, burst attacks, harassment.
**Interface:**
```typescript
export interface RateLimitResult {
  allowed: boolean;
  reason?: 'spam' | 'burst' | 'blocked_word' | 'suspended';
  retryAfterSeconds?: number;
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  chatId: string,
  message: string,
  workspaceId: string
): Promise<RateLimitResult>;
```
**Rules:**
- **Duplicate detection:** Same text in last 3 messages → `spam`
- **Burst detection:** >5 messages in 60 seconds → `burst`, retry after 60s
- **Blocked words:** Harassment/trolling word list → `blocked_word`, log incident
- **Suspended users:** Check `suspended_users` table → `suspended`

#### 7. `src/lib/automation-v3/guardrails/handoff-manager.ts`
**Purpose:** Transfer conversation to human with full context.
**Interface:**
```typescript
export interface HandoffPayload {
  chatId: string;
  workspaceId: string;
  platform: Platform;
  conversationSummary: string;
  pendingAction?: 'order' | 'appointment' | 'modification';
  customerDetails: {
    name?: string;
    phone?: string;
    address?: string;
    instagramHandle?: string;
  };
  lastBotMessage: string;
  recentMessages: Array<{role: string; content: string; timestamp: string}>;
  reason: 'human_requested' | 'loop_detected' | 'low_confidence' | 'error' | 'rate_limited' | 'complex_request';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
}

export async function createHandoff(
  session: SessionContext,
  message: string,
  reason: HandoffPayload['reason'],
  supabase: SupabaseClient
): Promise<string>; // Returns handoff ID
```
**Storage:** Write to `handoff_queue` table. Human dashboard polls or uses Supabase Realtime subscription.
**Priority Logic:**
- `urgent`: Loop detected 3x + customer said "urgent" or "now"
- `high`: Loop detected or error
- `medium`: Human requested or complex request
- `low`: Low confidence, non-urgent

#### 8. `src/lib/automation-v3/metrics.ts`
**Purpose:** Structured metrics emission for every automation run.
**Interface:**
```typescript
export function emitMetric(
  metric: string,
  value: number,
  tags: Record<string, string>
): void;

export function emitEvent(
  event: string,
  payload: Record<string, any>
): void;
```
**Metrics:**
- `bot.response_time_ms` — Total processing time
- `bot.intent_classification_ms` — Intent classifier latency
- `bot.response_generation_ms` — LLM response latency
- `bot.state_transition` — State before → after
- `bot.loop_detected` — Count
- `bot.state_timeout` — Count
- `bot.language_mismatch` — Detected vs actual (from user feedback)
- `bot.handoff` — Count + reason
- `bot.rate_limited` — Count + reason
- `bot.order_created` — Count + value
- `bot.appointment_created` — Count + value
- `bot.tool_call` — Count + tool name + success/failure
- `bot.template_used` — Count + template ID (tracks template coverage)
- `bot.llm_call` — Count + model + tokens + cost

**Output:** JSON to stdout (Vercel/Datadog compatible). Also write to `metrics` table for dashboard queries.

#### 9. `src/lib/automation-v3/customer-profile.ts`
**Purpose:** Cross-channel customer identity and history.
**Interface:**
```typescript
export interface CustomerProfile {
  id: string;
  phone?: string;           // Primary identifier for cross-channel linking
  instagramHandles: string[];
  whatsappNumbers: string[];
  name?: string;
  addresses: Array<{address: string; label: string; isDefault: boolean}>;
  preferredLanguage: 'english' | 'arabic' | 'franco';
  orderHistory: Array<{
    orderId: string;
    productName: string;
    date: string;
    status: string;
    total: number;
  }>;
  appointmentHistory: Array<{
    appointmentId: string;
    serviceName: string;
    date: string;
    status: string;
  }>;
  totalOrders: number;
  totalSpent: number;
  firstInteractionAt: string;
  lastInteractionAt: string;
  tags: string[]; // VIP, frequent, problematic, etc.
}

export async function loadCustomerProfile(
  supabase: SupabaseClient,
  workspaceId: string,
  chatId: string,
  platform: Platform
): Promise<CustomerProfile | null>;

export async function upsertCustomerProfile(
  supabase: SupabaseClient,
  workspaceId: string,
  chatId: string,
  platform: Platform,
  data: Partial<CustomerProfile>
): Promise<CustomerProfile>;
```
**Cross-Channel Linking:**
- When customer provides phone in Instagram DM → search `customer_profiles` by phone
- If found with WhatsApp history → merge or offer "Continue from WhatsApp?"
- If not found → create new profile, link by phone for future

#### 10. `src/lib/automation-v3/experiments.ts`
**Purpose:** A/B testing for prompts, templates, flows.
**Interface:**
```typescript
export function getVariant(
  workspaceId: string,
  experiment: string
): string;

export function trackExperimentResult(
  workspaceId: string,
  experiment: string,
  variant: string,
  result: 'conversion' | 'dropoff' | 'handoff' | 'loop'
): void;
```
**Experiments:**
- `prompt_v2` — New unified prompt vs old prompt
- `template_first` — Template response vs LLM response
- `shorter_replies` — 1-sentence vs 3-sentence replies
- `proactive_suggestions` — Suggest products vs wait for user

#### 11. `src/lib/automation-v3/queue.ts`
**Purpose:** Message queue for event-driven processing.
**Interface:**
```typescript
export async function enqueueMessage(
  message: MessageJob
): Promise<string>; // Job ID

export async function processMessage(
  jobId: string
): Promise<void>;
```
**Implementation:** Use Upstash Redis or QStash. Job payload includes full webhook payload + received timestamp.
**Retry Logic:**
- 3 retries with exponential backoff
- Dead letter queue after 3 failures
- Alert on dead letter queue growth

#### 12. `src/app/api/webhook/v3/route.ts`
**Purpose:** New webhook endpoint that enqueues instead of processing synchronously.
**Logic:**
1. Verify webhook signature (Instagram/WhatsApp)
2. Normalize payload
3. Check rate limit (fast, in-memory)
4. Enqueue to Redis/QStash
5. Return 200 OK immediately (< 50ms)

#### 13. `src/app/api/worker/process/route.ts`
**Purpose:** Worker endpoint that processes queued messages.
**Logic:**
1. Dequeue message
2. Load session
3. Classify intent
4. Run orchestrator
5. Generate response
6. Send via Instagram/WhatsApp API
7. Save session
8. Emit metrics

#### 14. `src/app/api/cron/purge/route.ts`
**Purpose:** Data retention compliance.
**Logic:**
- Delete messages older than 90 days
- Delete conversation_states older than 90 days (or archive to cold storage)
- Delete automation_runs older than 90 days
- Delete handoff_queue resolved items older than 30 days
- Run weekly (Sunday midnight)

#### 15. `src/lib/automation-v3/tests/conversation-runner.ts`
**Purpose:** End-to-end conversation regression testing.
**Interface:**
```typescript
export interface ConversationTest {
  name: string;
  workspaceType: WorkspaceType;
  setup?: {
    state?: ConversationStage;
    stateData?: StateData;
    postContext?: PostActionContext;
    customerProfile?: CustomerProfile;
    products?: InventoryRecord[];
    services?: ServiceRecord[];
  };
  steps: Array<{
    from: 'user' | 'bot';
    text?: string;
    assert?: (result: any) => boolean | string;
    delay?: number; // Simulate time passage
  }>;
}

export async function runConversationTest(
  test: ConversationTest,
  options?: { verbose?: boolean }
): Promise<{
  passed: boolean;
  failedAtStep?: number;
  error?: string;
  durationMs: number;
}>;
```
**Test Cases to Implement:**
- E-commerce happy path (browse → order → confirm)
- E-commerce with buffered details (all in one message)
- E-commerce loop detection (3x missing info → menu)
- E-commerce 24h timeout (old state → greeting)
- E-commerce cancel order
- E-commerce repeat last order
- Appointments happy path (browse → book → confirm)
- Appointments reschedule
- Appointments cancel
- Language: English only
- Language: Arabic only
- Language: Franco-Arabic only
- Language: Mixed English/Franco
- Language: Code-switching mid-conversation
- Handoff: User requests human
- Handoff: Loop detected
- Rate limit: Burst detection
- Rate limit: Spam detection
- Cross-channel: Instagram to WhatsApp continuity
- Error recovery: Groq failure → template fallback

---

### FILES TO MODIFY

#### 1. `src/lib/automation-v2/agent.ts` → `src/lib/automation-v3/agent.ts`
**Changes:**
- Remove `buildPrompt()` — use `response-generator.ts` instead
- Remove `resolveReplyLanguage()` — language handled by classifier
- Remove transactional tools (`place_order`, `book_appointment`) — FSM only
- Keep read-only tools (`search_products`, `check_slot`, `lookup_customer`, `get_business_hours`)
- Add retry with fallback model on failure
- Strip ALL XML/function call artifacts from output
- Add template fallback if LLM fails twice

#### 2. `src/lib/automation-v2/decision-engine.ts` → `src/lib/automation-v3/orchestrator.ts`
**Changes:**
- Split into 3 files:
  - `orchestrator.ts` — Main flow controller (replaces decision-engine)
  - `handlers/deterministic.ts` — Greeting, hours, location, status lookups
  - `handlers/fsm-router.ts` — Route to ecommerce-fsm or appointments-fsm
- Replace `loadConversationState` with `loadSession`
- Replace intent classification with new `intent-classifier.ts`
- Add rate limit check at entry
- Add session freshness check
- Add state validation before saving
- Add metrics emission at every step
- Remove ALL inline deterministic handlers (move to `handlers/deterministic.ts`)
- Remove post-context inline logic (move to `handlers/post-context.ts`)
- Remove scoped cancel inline logic (move to `handlers/cancel.ts`)

#### 3. `src/lib/automation-v2/state/store.ts`
**Changes:**
- Add `updated_at` auto-update on every write
- Ensure `data` JSONB can store `loopCount`, `lastBotMessage`, `stateEnteredAt`, `postContext`
- Add index on `(workspace_id, updated_at)` for purge queries

#### 4. `src/lib/automation-v2/state/ecommerce-fsm.ts`
**Changes:**
- Accept `SessionContext` instead of raw state
- Return proposed next stage (let validator approve)
- Use templates from `templates.ts` instead of inline `t()` calls
- Add loop detection awareness (check session.loopCount before replying)
- Remove `llmExtractProduct` call — entity extraction happens in classifier
- Add `stateEnteredAt` tracking

#### 5. `src/lib/automation-v2/state/appointments-fsm.ts`
**Changes:**
- Same as ecommerce-fsm.ts

#### 6. `src/lib/automation-v2/language.ts`
**Changes:**
- Keep `detectLanguage()` for analytics/logging ONLY
- Remove from routing logic (orchestrator doesn't use it)
- Keep `detectYesNo()`, `extractNameAndPhone()`, `extractAddress()` — these are heuristics, not LLM
- Add `isGreeting()` function for session manager

#### 7. `src/lib/automation-v2/index.ts` → `src/lib/automation-v3/index.ts`
**Changes:**
- Replace entire flow with new architecture
- Call `loadSession` → `checkRateLimit` → `classifyIntent` → `orchestrator` → `generateResponse`/`getTemplate` → `validateTransition` → `saveSession` → `emitMetric`
- Add handoff creation if state === 'handoff'
- Add experiment tracking

#### 8. `src/utils/ghost-brain.ts`
**Changes:**
- Route to `automation-v3` instead of `automation-v2`
- Keep backward compatibility flag (`automation_engine_version: 'v3'`)

#### 9. `src/utils/dm-debounce.ts`
**Changes:**
- Keep as-is (buffering logic is solid)
- Add `enqueueMessage` call after buffer processing instead of direct processing

#### 10. Database Schema Changes
**New Tables:**
```sql
-- Customer profiles for cross-channel identity
CREATE TABLE customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  phone TEXT,
  instagram_handles TEXT[],
  whatsapp_numbers TEXT[],
  name TEXT,
  addresses JSONB DEFAULT '[]',
  preferred_language TEXT DEFAULT 'english',
  total_orders INT DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  first_interaction_at TIMESTAMPTZ,
  last_interaction_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Handoff queue for human agents
CREATE TABLE handoff_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  chat_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, claimed, resolved
  priority TEXT DEFAULT 'medium',
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Suspended users (abuse)
CREATE TABLE suspended_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL,
  workspace_id UUID REFERENCES workspaces(id),
  reason TEXT,
  suspended_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Metrics for dashboards
CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  metric TEXT NOT NULL,
  value DECIMAL(10,2),
  tags JSONB,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Experiments tracking
CREATE TABLE experiment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  experiment TEXT NOT NULL,
  variant TEXT NOT NULL,
  result TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Modified Tables:**
```sql
-- Add to conversation_states
ALTER TABLE conversation_states ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'instagram';

-- Ensure data JSONB has these fields (no schema change, just convention)
-- data.loopCount, data.lastBotMessage, data.stateEnteredAt, data.postContext, data.updated_at
```

**Indexes:**
```sql
CREATE INDEX idx_conversation_states_workspace_updated ON conversation_states(workspace_id, updated_at);
CREATE INDEX idx_handoff_queue_workspace_status ON handoff_queue(workspace_id, status);
CREATE INDEX idx_customer_profiles_phone ON customer_profiles(phone);
CREATE INDEX idx_customer_profiles_workspace ON customer_profiles(workspace_id);
CREATE INDEX idx_metrics_workspace_metric_time ON metrics(workspace_id, metric, timestamp);
```

---

## IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1) — Fix the 3 Bugs
1. Create `session-manager.ts` — session timeout, loop detection, freshness
2. Create `state-validator.ts` — valid transitions, max loops
3. Create unified `response-generator.ts` — single prompt, no language routing
4. Modify `decision-engine.ts` — use session manager, add validation
5. Modify `agent.ts` — unified prompt, remove language parameter
6. Test: All 3 bugs fixed

### Phase 2: Architecture (Week 2) — Split the Monolith
1. Create `intent-classifier.ts` — lightweight 8b classifier, JSON mode
2. Create `orchestrator.ts` — replace decision-engine (split into handlers)
3. Create `templates.ts` — pre-built responses
4. Create `guardrails/rate-limiter.ts`
5. Create `guardrails/handoff-manager.ts`
6. Create `metrics.ts`
7. Modify `ecommerce-fsm.ts` and `appointments-fsm.ts` — use templates, session context

### Phase 3: Scale (Week 3) — Event-Driven + Cross-Channel
1. Create `queue.ts` — Redis/QStash message queue
2. Create `customer-profile.ts` — cross-channel identity
3. Create new webhook endpoint `api/webhook/v3`
4. Create worker endpoint `api/worker/process`
5. Test: 1000 messages/hour throughput

### Phase 4: Intelligence (Week 4) — Testing + Optimization
1. Create `tests/conversation-runner.ts` — 20+ regression tests
2. Create `experiments.ts` — A/B testing
3. Add data retention cron
4. Add monitoring dashboards
5. Optimize: Cache intents, batch metrics, template coverage tracking

---

## ACCEPTANCE CRITERIA (MUST PASS)

### Bug Fixes
- [ ] "Kifak badde product" (Franco-Arabic) → reply in Franco-Arabic
- [ ] "Hi kifak" (mixed) → reply in mixed English/Franco
- [ ] "Hello" after 30+ min inactivity → greeting, not old question
- [ ] "Hello" after 24h with active state → greeting + "Welcome back"
- [ ] Missing info 3x → main menu offer, not same question
- [ ] Same reply 2x → different phrasing or menu

### Architecture
- [ ] Intent classification < 100ms (8b model)
- [ ] Total response time < 2s (95th percentile)
- [ ] Template coverage > 70% (70% of replies use templates, not LLM)
- [ ] Zero transactional tool calls from LLM agent
- [ ] All DB writes happen in FSM handlers only
- [ ] Rate limit: 5 messages/60s → blocked
- [ ] Handoff includes conversation summary + customer details
- [ ] Cross-channel: same phone links Instagram + WhatsApp history

### Observability
- [ ] Every automation run emits ≥5 metrics
- [ ] Alert fires if loop rate > 5% in 1 hour
- [ ] Alert fires if response time > 3s (95th percentile)
- [ ] Alert fires if handoff rate > 20%
- [ ] Dashboard shows: conversations/hour, conversion rate, LLM cost/conversation

### Testing
- [ ] 20 conversation regression tests pass in CI
- [ ] New prompt changes tested on 5% of workspaces before full rollout
- [ ] Data retention purges old data weekly without error

---

## RISK MITIGATION

| Risk | Mitigation |
|------|-----------|
| New architecture breaks existing customers | Keep v2 running. v3 is opt-in per workspace (`automation_engine_version: 'v3'`). Rollback instant. |
| Groq 8b classifier accuracy too low | Fallback to 70b for classification only. Monitor accuracy dashboard. Threshold: >85% intent accuracy. |
| Message queue adds latency | Queue is optional in v3.1. Start with synchronous processing + session manager. Add queue when >1000 msg/hour. |
| Template replies feel robotic | A/B test template vs LLM. Track conversion rate. If template underperforms by >10%, increase LLM usage. |
| Cross-channel linking privacy concerns | Explicit consent: "We found your WhatsApp history. Continue?" Default to separate unless user confirms. |
| Migration complexity | Phase 1 (bugs) can ship independently. Phase 2+ builds on Phase 1. Each phase is a PR. |

---

## SUCCESS METRICS (90 Days Post-Launch)

| Metric | Current | Target |
|--------|---------|--------|
| Conversation loop rate | ~15% | <2% |
| Stale session confusion | ~20% | <1% |
| Language mismatch complaints | ~25% | <3% |
| Avg response time | ~1.5s | <1s |
| LLM cost per conversation | ~$0.02 | <$0.005 |
| Human handoff rate | ~30% | <15% |
| Order conversion rate | ~8% | >12% |
| Customer satisfaction (NPS) | Unknown | >50 |
| Uptime | ~99% | >99.9% |

---

## FINAL NOTES

1. **Do NOT rewrite everything at once.** Phase 1 fixes the bugs. Ship it. Get customer feedback. Then Phase 2.
2. **Keep v2 as fallback.** If v3 fails, route to v2. Zero downtime migration.
3. **Measure everything.** If a template performs worse than LLM, kill the template.
4. **Customer profile is the moat.** Cross-channel memory + order history = sticky product.
5. **Human handoff is a feature, not a bug.** The best AI knows when to quit. Make handoff seamless.

Build this. Ship Phase 1 this week. Phase 2 next week. You'll have the best AI customer service platform in the market.
