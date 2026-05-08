# GhostAgent Brain Architecture

## Core Principle

```
LLM understands → Code acts → Database proves → Guard protects
```

The LLM is never allowed to execute business actions. It only classifies intent.
Deterministic handlers are the only layer that writes to the database.
The final reply guard blocks any success claim that the database didn't prove.

---

## Message Flow (Ecommerce & Appointments)

```
Customer sends DM (Instagram or WhatsApp)
│
├─ 1. GATE
│   Is autopilot on? Is it a voice note? Is it a story reply?
│   └─ Blocked → static reply or silence
│
├─ 2. ROUTER
│   Load workspace config from DB
│   ├─ Handoff keyword detected? → silence, let human take over
│   └─ ecommerce / appointments → run agent
│
├─ 3. AGENT
│   Detect language (English, Arabizi, Arabic, mixed)
│   Load conversation state from DB
│   │
│   ├─ 4. DECISION ENGINE
│   │   │
│   │   ├─ A. HARD SAFETY STOPS
│   │   │   - human handoff ("talk to a human")
│   │   │   - frustration stop ("stop messaging me")
│   │   │   - bot loop detection
│   │   │   - unsupported / deleted message
│   │   │   → Immediate exit. No further processing.
│   │   │
│   │   ├─ B. CLEAR TRANSACTIONAL GLOBAL INTERRUPTS
│   │   │   Detected by sync regex classifier (zero-cost):
│   │   │   - cancel real order
│   │   │   - cancel real appointment
│   │   │   - cancel both / all / first / second (scoped)
│   │   │   - reschedule appointment
│   │   │   - modify existing order
│   │   │   → Deterministic handler executes immediately.
│   │   │   → Beats active FSM. If user says "cancel my order" mid-checkout,
│   │   │     the cancel handler runs, not the FSM.
│   │   │
│   │   ├─ C. ACTIVE FSM STATE
│   │   │   Is user mid-checkout? Mid-booking?
│   │   │   → FSM handles it directly. NO classifier. NO LLM.
│   │   │   The FSM already knows what the user is answering.
│   │   │   Examples:
│   │   │   - name / phone / address collection
│   │   │   - date / time collection
│   │   │   - confirmation yes / no
│   │   │   - variant / quantity selection
│   │   │
│   │   ├─ D. REPLY-TO / POST-CONTEXT
│   │   │   Did user just complete an action and is now replying?
│   │   │   → Post-context handler. NO LLM.
│   │   │   Examples:
│   │   │   - "yes" to specific confirmation message
│   │   │   - "change address to Zeleya" after order
│   │   │   - "same one again" / repeat order
│   │   │
│   │   ├─ E. IDLE — CLASSIFIER PIPELINE
│   │   │   │
│   │   │   ├─ Step 1: Regex (free, instant, deterministic)
│   │   │   │   "hello"                    → greeting (0.98)        ✅ done
│   │   │   │   "how much is the crewneck" → price_question (0.85)  ✅ done
│   │   │   │   "cancel both orders"       → cancel_order (0.90)    ✅ done
│   │   │   │
│   │   │   └─ Step 2: Regex returned unknown?
│   │   │       → Call LLM classifier (Groq, ~200ms, read-only)
│   │   │
│   │   │       Input:  "can u remove the two things I ordered"
│   │   │       Output: {
│   │   │                 "intent": "cancel_order",
│   │   │                 "scope": "count",
│   │   │                 "count": 2,
│   │   │                 "confidence": 0.93,
│   │   │                 "isTransactional": true,
│   │   │                 "source": "llm"
│   │   │               }
│   │   │
│   │   │       The LLM does NOT cancel anything.
│   │   │       The LLM does NOT reply to the customer.
│   │   │       It only returns structured JSON.
│   │   │
│   │   │       If LLM fails → fall back to regex result (if any).
│   │   │       If both fail → return unknown.
│   │   │
│   │   ├─ F. DETERMINISTIC HANDLERS (code acts)
│   │   │   Now we have a classified intent. Handlers execute:
│   │   │
│   │   │   greeting
│   │   │     → "Hey! How can I help?"
│   │   │
│   │   │   product_availability
│   │   │     → search products DB → "Yes, Crewneck is available — $25. Want one?"
│   │   │
│   │   │   purchase_intent
│   │   │     → start ecommerce FSM → "What's your name?"
│   │   │
│   │   │   cancel_order (scope=count, count=2)
│   │   │     → cancelOrdersForChat(scope="count", count=2)
│   │   │     → DB returns: cancelled 2 of 2 pending
│   │   │     → reply: "2 orders cancelled ✅"
│   │   │
│   │   │   cancel_order (scope=count, count=2) — partial success
│   │   │     → DB returns: cancelled 1 of 2 (1 already shipped)
│   │   │     → reply: "Only 1 order could be cancelled. The other is already shipped."
│   │   │
│   │   │   repeat_last_order
│   │   │     → reuse postContext (name, phone, address) → start checkout
│   │   │
│   │   │   booking_intent
│   │   │     → start appointment FSM → "What day works for you?"
│   │   │
│   │   │   cancel_appointment
│   │   │     → cancelAppointmentsForChat() → reply based on DB result
│   │   │
│   │   │   reschedule_appointment
│   │   │     → update appointment in DB → confirm new date/time
│   │   │
│   │   │   business_hours
│   │   │     → load hours from DB → "Mon-Fri 9am-6pm"
│   │   │
│   │   │   location_question
│   │   │     → read config → "We're at: Hamra, Beirut"
│   │   │
│   │   └─ G. GENERAL FALLBACK (non-transactional FAQ ONLY)
│   │       → LLM agent with READ-ONLY tools (no transactional tools)
│   │       → Can answer: business hours, location, shipping, payment,
│   │         policy, general product/service info
│   │       → CANNOT: place orders, cancel orders, book appointments,
│   │         cancel appointments, reschedule appointments, update orders
│   │       → If transactional intent detected, returns clarification
│   │         or routes to deterministic handler path
│   │
│   ├─ 5. FINAL REPLY GUARD (guard protects)
│   │   ├─ "Order confirmed" but dbWriteSuccess=false?       → BLOCKED
│   │   ├─ "Both orders cancelled" but cancelledCount=1?     → BLOCKED
│   │   ├─ "2 orders cancelled" but cancelledCount=0?        → BLOCKED
│   │   ├─ "All appointments cancelled" but cancelledCount=0? → BLOCKED
│   │   ├─ "[HANDOFF]" in reply?                             → BLOCKED
│   │   └─ Normal safe reply?                                → passes through
│   │
│   └─ 6. SEND REPLY
│       → Instagram DM API or WhatsApp Business API
│
└─ 7. LOG TO DB
    automation_runs table:
    {
      intent: "cancel_order",
      actions: ["scoped_cancel_order"],
      classifierSource: "llm",
      classifierConfidence: 0.93,
      classifierResult: { intent: "cancel_order", scope: "count", count: 2 },
      dbWriteSuccess: true,
      durationMs: 340
    }
```

---

## Classifier / Handler Priority (Exact Order)

```
A. Hard safety stops
   → human_handoff, frustration_stop, bot_loop, unsupported_message
   → Immediate exit, no further processing

B. Clear transactional global interrupts
   → cancel_order, cancel_appointment, reschedule_appointment, modify_order
   → Beats active FSM. Handled by deterministic code.

C. Active FSM state
   → name/phone/address, date/time, yes/no confirmation, variant/quantity
   → No classifier needed. FSM knows what user is answering.

D. Reply-to / post-context
   → "yes" to confirmation, "change address", "same one again"
   → No LLM needed. Post-context handler matches.

E. Idle classifier pipeline
   → Regex first (free, instant)
   → LLM semantic classifier only if regex returns unknown

F. Deterministic handlers
   → product query, purchase, cancel, repeat, booking, reschedule, business info
   → All DB writes happen here and only here

G. General fallback
   → Non-transactional FAQ only
   → READ-ONLY tools (no place_order, cancel_order, book_appointment, cancel_appointment)
   → If transactional intent detected → clarification, not action
```

---

## Layer Responsibilities

| Layer | Role | Writes to DB? | Generates reply? |
|-------|------|:-------------:|:----------------:|
| Regex classifier | Fast pattern matching | ❌ | ❌ |
| LLM classifier | Understand messy language → structured JSON | ❌ | ❌ |
| FSM (ecommerce) | Collect order details step-by-step | ✅ | ✅ |
| FSM (appointments) | Collect booking details step-by-step | ✅ | ✅ |
| Deterministic handlers | Execute business logic (cancel, lookup, etc.) | ✅ | ✅ |
| Fallback LLM agent | Answer general non-transactional questions | ❌ read-only | ✅ |
| Final reply guard | Block false success claims | ❌ | ❌ (replaces bad replies) |

---

## Fallback LLM Agent — Tool Restrictions

The fallback LLM agent (step G) only has access to read-only tools:

| Tool | Available in fallback? | Purpose |
|------|:---------------------:|---------|
| `search_products` | ✅ | Product info, pricing, availability |
| `get_business_hours` | ✅ | Store hours |
| `check_slot` | ✅ | Appointment availability check |
| `lookup_customer` | ✅ | Customer history lookup |
| `place_order` | ❌ BLOCKED | Orders go through ecommerce FSM |
| `cancel_order` | ❌ BLOCKED | Cancellations go through deterministic handler |
| `book_appointment` | ❌ BLOCKED | Bookings go through appointment FSM |
| `cancel_appointment` | ❌ BLOCKED | Cancellations go through deterministic handler |

---

## When the LLM Classifier Is NOT Called

Most messages never hit the LLM. These are handled for free:

| Situation | Handler | LLM called? |
|-----------|---------|:-----------:|
| User is mid-checkout ("my name is Ali") | FSM | ❌ |
| User says "hello" | Regex → greeting handler | ❌ |
| User says "cancel my order" | Regex → cancel handler | ❌ |
| User says "yeah" after purchase offer | Post-context handler | ❌ |
| User says "how much is the hoodie" | Regex → product handler | ❌ |
| User says "book me tomorrow at 3" | Regex → booking FSM | ❌ |

## When the LLM Classifier IS Called

Only for complex/ambiguous messages where regex returns unknown:

| Message | Why regex fails | LLM result |
|---------|----------------|------------|
| "can u remove the two things I ordered" | No "cancel" keyword | cancel_order, scope=count, count=2 |
| "bde wa7de kamane nafs el ra2em" | Arabizi variant spelling | repeat_last_order, reusePhone=true |
| "same one again but to Zeleya" | Complex repeat + changed entity | repeat_last_order, changedAddress="Zeleya" |
| "what if I'm late?" | No keyword match | policy_question |
| "I want crewneck black L same name new address" | Multi-entity extraction | purchase_intent + entities |

---

## Count-Aware Cancel Guard

The final reply guard doesn't just check "did the DB write succeed?" — it checks counts:

| Reply | Required proof | Blocked if... |
|-------|---------------|---------------|
| "Order cancelled" | cancelledCount ≥ 1 | cancelledCount = 0 |
| "Both orders cancelled" | cancelledCount ≥ 2 | cancelledCount = 1 |
| "2 orders cancelled" | cancelledCount ≥ 2 | cancelledCount = 1 |
| "All orders cancelled" | cancelledCount ≥ 1 + scope was all_pending | cancelledCount = 0 |
| "Only 1 order cancelled" | (explanation, not a claim) | Never blocked |

---

## Platform Architecture

Instagram and WhatsApp use the **same brain**. Platform is metadata only:

```typescript
platform: 'instagram' | 'whatsapp'
```

No separate WhatsApp intents. No separate Instagram intents.
Same classifier. Same FSM. Same handlers. Same guard.

---

## File Map

```
src/lib/automation-v2/
├── index.ts                          ← Entry point, gate, guard, logging
├── router.ts                         ← Route to SaaS responder or agent
├── agent.ts                          ← Language detection, state load, LLM fallback (READ-ONLY tools)
├── decision-engine.ts                ← FSM dispatch, classifier, handlers
├── tools.ts                          ← Tool definitions + read-only variants
├── classify/
│   ├── intent-classifier.ts          ← Sync classifyIntent + async semantic fallback
│   ├── llm-intent-classifier.ts      ← Groq + Zod LLM classifier (read-only)
│   ├── regex-fallbacks.ts            ← Deterministic regex patterns
│   ├── normalized-intent.ts          ← 65-intent canonical schema
│   └── post-context-classifier.ts    ← Reply-to-recent-action classifier
├── state/
│   ├── ecommerce-fsm.ts              ← Order checkout state machine
│   ├── appointments-fsm.ts           ← Booking state machine
│   └── store.ts                      ← conversation_states DB read/write
├── validation/
│   └── final-reply-guard.ts          ← Count-aware success claim blocker
├── ecommerce/
│   ├── lookup.ts                     ← Order DB operations
│   └── products.ts                   ← Product search/match
└── __tests__/
    ├── brain-safety-invariants.test.ts  ← Safety invariant tests (20 tests)
    ├── llm-intent-classifier.test.ts    ← LLM classifier tests (21 tests)
    └── scenarios/
        └── llm-classifier-scenarios.test.ts ← Pipeline scenario tests (11 tests)
```
