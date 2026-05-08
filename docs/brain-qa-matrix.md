# GhostAgent — Brain QA Matrix

All launch scenarios for brain reliability validation.

## Legend

| Status | Meaning |
|--------|---------|
| ✅ | Automated test passes — calls production code |
| 🟡 | Logic-level validation or manual test needed |
| ⏭️ | Deferred to Phase 2 |
| ❌ | Known failure |

---

## Gate Results

```
npm run test:          522 pass, 0 fail, 0 skip
npm run test:scenarios: 110 pass, 0 fail, 0 skip
npm run build:         exit code 0 (TypeScript clean)
```

---

## Ecommerce Scenarios

| # | Scenario | Test File | Status |
|---|----------|-----------|--------|
| E1 | Product availability — exact match | `ecommerce.scenarios.test.ts` | ✅ |
| E2 | Product availability — typo/fuzzy | `ecommerce.scenarios.test.ts` | ✅ |
| E3 | Product price question | `ecommerce.scenarios.test.ts` | ✅ |
| E4 | Order flow — English | `ecommerce.scenarios.test.ts` | ✅ |
| E5 | Order flow — Arabizi | `ecommerce.scenarios.test.ts` | ✅ |
| E6 | "yes" / "yeahh" confirmation | FSM `detectYesNo` | ✅ |
| E7 | Cancel order after confirmation | `ecommerce.scenarios.test.ts` | ✅ |
| E8 | Cancel already-cancelled order | `cancel-order.test.ts` | ✅ |
| E9 | Fulfilled order cannot cancel | `cancel-order.test.ts` | ✅ |
| E10 | Change address post-order | `post-context-modify.test.ts` | ✅ |
| E11 | New order same name/number | `ecommerce.scenarios.test.ts` | ✅ |
| E12 | Post-context new order ≠ modify | `ecommerce.scenarios.test.ts` | ✅ |
| E13 | Out of stock product | `ecommerce.scenarios.test.ts` | ✅ |
| E14 | Empty inventory | `ecommerce.scenarios.test.ts` | ✅ |
| E15 | No false confirmation on DB failure | `ecommerce.scenarios.test.ts` | ✅ |
| E16 | No [HANDOFF] leak | `ecommerce.scenarios.test.ts` | ✅ |
| E17 | Availability CTA continues order | — | 🟡 Manual test |
| E18 | Buffered product + customer details → straight to confirmation | `ecommerce-fsm.ts` (buffered_details_extracted) | ✅ |
| E19 | "Already sent it" recovery | `ecommerce-fsm.ts` (already_sent_partial_recovery) | ✅ |
| E20 | Repeat last order: "add one more" | `repeat-order.scenarios.test.ts` | ✅ |
| E21 | Repeat last order: same phone/address | `decision-engine.ts` (repeat_order_confirm) | ✅ |
| E22 | Product reference: "the PS5" | — | 🟡 Manual test |
| E23 | Cancel both orders | `multi-cancel.scenarios.test.ts` | ✅ |
| E24 | Cancel all pending orders | `multi-cancel.scenarios.test.ts` | ✅ |
| E25 | Cancel first order | `multi-cancel.scenarios.test.ts` | ✅ |
| E26 | Cancel second order | `multi-cancel.scenarios.test.ts` | ✅ |
| E27 | Cancel product-specific order | `multi-cancel.scenarios.test.ts` | ✅ |
| E28 | False plural cancellation guard | `multi-cancel.scenarios.test.ts` | ✅ |
| E29 | New order vs modify order disambiguation | `repeat-order.scenarios.test.ts` | ✅ |
| E30 | Multi-item purchase → clarification | — | 🟡 Future |

## Appointment Scenarios

| # | Scenario | Test File | Status |
|---|----------|-----------|--------|
| A1 | Service question | `appointments.scenarios.test.ts` | ✅ |
| A2 | Booking flow — English | `appointments.scenarios.test.ts` | ✅ |
| A3 | Booking flow — Arabizi | `appointments.scenarios.test.ts` | ✅ |
| A4 | Business hours question | `appointments.scenarios.test.ts` | ✅ |
| A5 | Closed day | `appointments.scenarios.test.ts` | ✅ |
| A6 | Taken slot | `availability.test.ts` | ✅ |
| A7 | Cancel appointment | `appointments.scenarios.test.ts` | ✅ |
| A9 | No false booking on DB failure | `appointments.scenarios.test.ts` | ✅ |
| A10 | Cancel already-cancelled appointment | `multi-cancel.scenarios.test.ts` | ✅ |
| A11 | Cancel both appointments | `multi-cancel.scenarios.test.ts` | ✅ |
| A12 | Cancel appointment by date | — | 🟡 Manual test |
| A13 | Reschedule appointment | `appointments.scenarios.test.ts` | ✅ |
| A14 | Reschedule to unavailable slot | — | 🟡 Manual test |
| A15 | Appointment status query | `multi-cancel.scenarios.test.ts` | ✅ |

## SaaS Support Scenarios

| # | Scenario | Test File | Status |
|---|----------|-----------|--------|
| S1 | "What is GhostAgent?" | `saas-support.scenarios.test.ts` | ✅ |
| S2 | Greeting → static reply | `saas-support.scenarios.test.ts` | ✅ |
| S3 | Arabizi greeting | `saas-support.scenarios.test.ts` | ✅ |
| S4 | Human handoff request | `saas-support.scenarios.test.ts` | ✅ |
| S5 | Feature question handled by responder | `saas-support.scenarios.test.ts` | ✅ |
| S6 | Setup question handled by responder | `saas-support.scenarios.test.ts` | ✅ |
| S7 | Pricing handled by responder | `saas-support.scenarios.test.ts` | ✅ |
| S8 | No orders/appointments | `saas-support.scenarios.test.ts` | ✅ |
| S9 | No [HANDOFF] in any path | `saas-support.scenarios.test.ts` | ✅ |
| S10 | State always idle | `saas-support.scenarios.test.ts` | ✅ |
| S11 | Official knowledge contains key facts | `saas-support.test.ts` | ✅ |
| S12 | No private admin details in knowledge | `saas-support.test.ts` | ✅ |
| S13 | SaaS bypass: no transactional tools | `saas-support.scenarios.test.ts` | ✅ |


## Comment Scenarios

| # | Scenario | Test File | Status |
|---|----------|-----------|--------|
| C1 | Price comment | `comments.scenarios.test.ts` | ✅ |
| C2 | Availability comment | `comments.scenarios.test.ts` | ✅ |
| C3 | Arabizi price comment | `comments.scenarios.test.ts` | ✅ |
| C4 | Arabizi availability | `comments.scenarios.test.ts` | ✅ |
| C5 | Comment-only ≠ fake inbox | — | 🟡 Manual webhook verification needed |

## Universal Scenarios

| # | Scenario | Test File | Status |
|---|----------|-----------|--------|
| U1 | Gratitude → not purchase_intent | `universal.scenarios.test.ts` | ✅ |
| U2 | Goodbye → not purchase_intent | `universal.scenarios.test.ts` | ✅ |
| U3 | Correction → not cancel_order | `universal.scenarios.test.ts` | ✅ |
| U4 | Clarification request | — | 🟡 Manual test |
| U5 | Human handoff no [HANDOFF] | `universal.scenarios.test.ts` | ✅ |
| U6 | Frustration stop | `universal.scenarios.test.ts` | ✅ |

## WhatsApp Scenarios

| # | Scenario | Test File | Status |
|---|----------|-----------|--------|
| W1 | No fallback in production | `whatsapp.scenarios.test.ts` | ✅ |
| W2 | Dev fallback requires env flag | `whatsapp.scenarios.test.ts` | ✅ |
| W3 | Random env value not allowed | `whatsapp.scenarios.test.ts` | ✅ |
| W4 | Buffer combines messages | `whatsapp-buffer.test.ts` | ✅ |

## LLM Classifier

| # | Scenario | Test File | Status |
|---|----------|-----------|--------|
| L1 | Valid JSON parses into NormalizedIntent | `llm-intent-classifier.test.ts` | ✅ |
| L2 | Invalid JSON returns unknown safe fallback | `llm-intent-classifier.test.ts` | ✅ |
| L3 | Zod validation failure returns fallback | `llm-intent-classifier.test.ts` | ✅ |
| L4 | cancel both orders → cancel_order/count/2 | `llm-intent-classifier.test.ts` | ✅ |
| L5 | cancel second one → cancel_order/ordinal/second | `llm-intent-classifier.test.ts` | ✅ |
| L6 | add one more same phone/address → repeat_last_order + reuse | `llm-intent-classifier.test.ts` | ✅ |
| L7 | same one new address Zeleya → repeat_last_order + changedAddress | `llm-intent-classifier.test.ts` | ✅ |
| L8 | crewneck black size L + reuse → purchase_intent + entities | `llm-intent-classifier.test.ts` | ✅ |
| L9 | book me like last time → booking_intent + needsClarification | `llm-intent-classifier.test.ts` | ✅ |
| L10 | move appointment to Friday 5 → reschedule + date/time | `llm-intent-classifier.test.ts` | ✅ |
| L11 | cash on delivery → payment_methods_question | `llm-intent-classifier.test.ts` | ✅ |
| L12 | ambiguous "that one" → product_reference + needsClarification | `llm-intent-classifier.test.ts` | ✅ |
| LS1 | Weird cancel-both phrasing via LLM | `llm-classifier-scenarios.test.ts` | ✅ |
| LS2 | Weird repeat phrasing via LLM | `llm-classifier-scenarios.test.ts` | ✅ |
| LS3 | Appointment reschedule through classifier | `llm-classifier-scenarios.test.ts` | ✅ |
| LS4 | Arabizi repeat via LLM | `llm-classifier-scenarios.test.ts` | ✅ |
| LS5 | Arabizi cancellation via LLM | `llm-classifier-scenarios.test.ts` | ✅ |
| LS6 | Payment/COD classified by regex or LLM | `llm-classifier-scenarios.test.ts` | ✅ |
| LS7 | High-confidence regex wins over LLM | `llm-classifier-scenarios.test.ts` | ✅ |
| LS8 | Regex fallback when LLM fails | `llm-classifier-scenarios.test.ts` | ✅ |
| LS9 | Low confidence returns needsClarification | `llm-classifier-scenarios.test.ts` | ✅ |
| LS10 | LLM result source is always regex or llm | `llm-classifier-scenarios.test.ts` | ✅ |
| LS11 | LLM result never contains replyText | `llm-classifier-scenarios.test.ts` | ✅ |
| LG1 | Count guard: both cancelled blocked when count < 2 | `llm-intent-classifier.test.ts` | ✅ |
| LG2 | Count guard: both cancelled allowed when count >= 2 | `llm-intent-classifier.test.ts` | ✅ |
| LG3 | Count guard: all cancelled blocked when count = 0 | `llm-intent-classifier.test.ts` | ✅ |
| LG4 | Count guard: N cancelled blocked when mismatch | `llm-intent-classifier.test.ts` | ✅ |
| LG5 | Status explanation "only 1" passes guard | `llm-intent-classifier.test.ts` | ✅ |

## Safety & Infrastructure

| # | Scenario | Test File | Status |
|---|----------|-----------|--------|
| I1 | State load fail-safe | `db-constraints.scenarios.test.ts` | ✅ |
| I2 | State load exception fail-safe | `db-constraints.scenarios.test.ts` | ✅ |
| I3 | Active state preserved on success | `db-constraints.scenarios.test.ts` | ✅ |
| I4 | Workspace readiness blocks autopilot | `db-constraints.scenarios.test.ts` | ✅ |
| I5 | Knowledge visibility = public only | `stability-security.test.ts` | ✅ |
| I6 | Final reply guard blocks false success | `final-reply-guard.test.ts` | ✅ |
| I7 | Bot loop detection | `should-reply.test.ts` | ✅ |

## DB Constraints

> [!WARNING]
> DB constraints D1–D7 are currently validated by **logic-level tests only** (array/object checks in code). They do NOT test actual Postgres CHECK constraints. Full verification requires running `npm run test:db-smoke` against a live Supabase instance with `RUN_DB_SMOKE_TEST=true`.

| # | Scenario | Test File | Status |
|---|----------|-----------|--------|
| D1 | conversation_states accepts ecommerce | `db-constraints.scenarios.test.ts` | 🟡 Logic-level only |
| D2 | conversation_states accepts appointments | `db-constraints.scenarios.test.ts` | 🟡 Logic-level only |
| D3 | conversation_states accepts saas_support | `db-constraints.scenarios.test.ts` | 🟡 Logic-level only |
| D4 | conversation_states requires platform | `db-constraints.scenarios.test.ts` | 🟡 Logic-level only |
| D5 | orders Pending → Cancelled valid | `db-constraints.scenarios.test.ts` | 🟡 Logic-level only |
| D6 | appointments confirmed → cancelled valid | `db-constraints.scenarios.test.ts` | 🟡 Logic-level only |
| D7 | business_knowledge requires user_id | `db-constraints.scenarios.test.ts` | 🟡 Logic-level only |

To run the live DB smoke test: `RUN_DB_SMOKE_TEST=true npm run test:db-smoke`

---

## Deferred

| Item | Status | Reason |
|------|--------|--------|
| Instagram webhook refactoring | ⏭️ Phase 3 | 1400+ lines, too risky during classifier phase. |
| Handler refactor (extract engine modules) | ⏭️ Phase 3 | Separate PR after normalized model + LLM classifier stable. |

---

## Remaining Known Issues

1. **Instagram webhook is too large** — 1400+ lines in one file. Refactoring deferred to Phase 3.
2. **A8: Already-cancelled appointment** — needs manual webhook verification (no automated regression test).
3. **C5: Comment-only → no fake inbox** — needs manual DM verification.

---

## Audit

| Category | Count |
|----------|-------|
| QA items backed by automated tests calling production code | ~90 |
| QA items that are logic-level validations only (D1–D7) | 7 |
| QA items requiring manual verification (A12, A14, C5, E17, E22, E30, U4) | 7 |
| QA items deferred (webhook refactor, handler refactor) | 2 |
| Skipped tests | 0 |
| Failed tests | 0 |

---

## Launch Readiness Assessment

| Criteria | Status |
|----------|--------|
| Core ecommerce flow tested | ✅ |
| Core appointment flow tested | ✅ |
| SaaS support isolated | ✅ |
| WhatsApp routing safe | ✅ |
| State load fail-safe | ✅ |
| Knowledge visibility secured | ✅ |
| Final reply guard active | ✅ |
| Final reply guard count-aware | ✅ |
| Automation audit trail | ✅ |
| Workspace readiness gate | ✅ |
| LLM classifier (structured) | ✅ |
| Classifier observability | ✅ |
| CI test gate | ✅ |
| DB constraints verified (live) | 🟡 Requires `test:db-smoke` |

**Verdict: Production-ready with supervised pilot.** LLM classifier provides semantic understanding for complex messages. Deterministic handlers remain in control of all business actions. Count-aware final reply guard prevents false success claims.
