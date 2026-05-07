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
npm run test:          480 pass, 0 fail, 0 skip
npm run test:scenarios: 75 pass, 0 fail, 0 skip
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
| A8 | Already cancelled appointment | — | 🟡 Manual verification needed |
| A9 | No false booking on DB failure | `appointments.scenarios.test.ts` | ✅ |

## SaaS Support Scenarios

| # | Scenario | Test File | Status |
|---|----------|-----------|--------|
| S1 | "What is GhostAgent?" | `saas-support.scenarios.test.ts` | ✅ |
| S2 | Greeting → static reply | `saas-support.scenarios.test.ts` | ✅ |
| S3 | Arabizi greeting | `saas-support.scenarios.test.ts` | ✅ |
| S4 | Human handoff request | `saas-support.scenarios.test.ts` | ✅ |
| S5 | Pricing question classified | `saas-support.scenarios.test.ts` | ✅ |
| S6 | Feature question classified | `saas-support.scenarios.test.ts` | ✅ |
| S7 | Setup question classified | `saas-support.scenarios.test.ts` | ✅ |
| S8 | No orders/appointments | `saas-support.scenarios.test.ts` | ✅ |
| S9 | No [HANDOFF] in any path | `saas-support.scenarios.test.ts` | ✅ |
| S10 | State always idle | `saas-support.scenarios.test.ts` | ✅ |

## Comment Scenarios

| # | Scenario | Test File | Status |
|---|----------|-----------|--------|
| C1 | Price comment | `comments.scenarios.test.ts` | ✅ |
| C2 | Availability comment | `comments.scenarios.test.ts` | ✅ |
| C3 | Arabizi price comment | `comments.scenarios.test.ts` | ✅ |
| C4 | Arabizi availability | `comments.scenarios.test.ts` | ✅ |
| C5 | Comment-only ≠ fake inbox | — | 🟡 Manual webhook verification needed |

## WhatsApp Scenarios

| # | Scenario | Test File | Status |
|---|----------|-----------|--------|
| W1 | No fallback in production | `whatsapp.scenarios.test.ts` | ✅ |
| W2 | Dev fallback requires env flag | `whatsapp.scenarios.test.ts` | ✅ |
| W3 | Random env value not allowed | `whatsapp.scenarios.test.ts` | ✅ |
| W4 | Buffer combines messages | `whatsapp-buffer.test.ts` | ✅ |

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
| Structured LLM classifier fallback | ⏭️ Phase 2 | Regex handles known intents. Unknown intents go to LLM agent. |
| Instagram webhook refactoring | ⏭️ Phase 2 | 1400+ lines, too risky during reliability phase. |

---

## Remaining Known Issues

1. **Instagram webhook is too large** — 1400+ lines in one file. Refactoring deferred to Phase 2.
2. **LLM classifier fallback** — regex-only classifier returns `unknown` for ambiguous messages. Structured LLM fallback is Phase 2.
3. **A8: Already-cancelled appointment** — needs manual webhook verification (no automated regression test).
4. **C5: Comment-only → no fake inbox** — needs manual DM verification.

---

## Audit

| Category | Count |
|----------|-------|
| QA items backed by automated tests calling production code | ~40 |
| QA items that are logic-level validations only (D1–D7) | 7 |
| QA items requiring manual webhook verification (A8, C5) | 2 |
| QA items deferred (LLM classifier, webhook refactor) | 2 |
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
| Automation audit trail | ✅ |
| Workspace readiness gate | ✅ |
| CI test gate | ✅ |
| DB constraints verified (live) | 🟡 Requires `test:db-smoke` |

**Verdict: Beta-ready.** Safe for supervised pilot with real businesses. Not yet production-ready for unsupervised Autopilot at scale — needs LLM classifier fallback, Instagram webhook refactoring, and live DB constraint verification first.
