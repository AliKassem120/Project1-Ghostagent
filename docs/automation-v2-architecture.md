# Automation Engine V2 — Architecture

> Completed: 2026-04-28
> Version: 2.0.0

Automation Engine V2 is a stateful, deterministic, and multilingual replacement for the legacy GhostAgent "brains". It prioritizes state machine logic over LLM classification to ensure high reliability in transactional flows (bookings and orders).

## Core Principles

1.  **State Before Classifier**: If a conversation is in a pending state (e.g., `awaiting_customer_details`), the message is first processed as potential missing data for that state. Only if the state doesn't match is the intent classifier run.
2.  **Deterministic Templates**: Final replies are built from predefined templates. The LLM is used for extraction, classification, and translation, but never for generating the core business response.
3.  **Source-of-Truth Wiring**: Every action (availability check, product search, booking, order) is directly wired to the dashboard's database tables. If it's not in the DB, the bot doesn't know about it.
4.  **DM-Native Aesthetics**: Enforces short, concise replies (max 2 sentences, 220 characters) appropriate for Instagram/WhatsApp.
5.  **Multilingual by Design**: Supports English, Arabic, Arabizi (Franco), French, and Spanish out of the box with automatic detection and dashboard-level overrides.

## Engine Pipeline (15 Steps)

1.  **Load Workspace Context**: `ai_settings` and integration tokens.
2.  **Build Time Context**: Resolves "today", "tomorrow", and day names using the workspace timezone.
3.  **Load State**: Fetches `conversation_states` for the specific chat.
4.  **Language Detection**: Analyzes script and vocabulary signals.
5.  **State Processor (Primary)**:
    - If `idle`: Skip to step 6.
    - If `awaiting_*`: Try to extract missing fields (name, phone, date, variant, etc.).
    - If resolved: Advance state and select template.
6.  **Intent Classifier (Fallback)**:
    - Runs only if step 5 returns null.
    - Uses `classifyWithLLM` (Llama 3.1-70b via Groq).
7.  **Intent Processor**:
    - Executes business logic based on intent (greeting, booking, question).
    - Checks source-of-truth (hours, inventory, services).
    - Sets new state if flow started.
8.  **Action Preconditions**: Validates that all required data is present before any DB write.
9.  **Database Write**: Inserts into `appointments` or `orders` table.
10. **Visibility Check**: Verifies the record is queryable by the dashboard.
11. **Template Selection**: Picks the appropriate `APPOINTMENT_TEMPLATE` or `ECOMMERCE_TEMPLATE`.
12. **Translation/Polish**: Translates the template into the target language using LLM (preserving meaning).
13. **Final Validation**: Enforces length, sentence count, and blocks false confirmations/parroting.
14. **Logging**: Structured logs to `INSTAGRAM_WEBHOOK_OUTCOME`.
15. **Return**: Delivers final text to the webhook router.

## State Machines

### Appointments
`idle` → `awaiting_service` → `awaiting_date_time` → `awaiting_customer_details` → `awaiting_booking_confirmation` → `idle`

### E-Commerce
`idle` → `awaiting_product` → `awaiting_variant` → `awaiting_order_details` → `awaiting_checkout_confirmation` → `idle`

## Safety & Observability

- **Feature Flag**: Controlled via `automation_engine_version` in `ai_settings`.
- **Validation**: Blocks "I'm checking that for you" style filler.
- **Error Handling**: Safe fallback reply ("I'm having trouble right now") ensures no silent failures.
- **Duplicate Prevention**: 30-minute window check for e-commerce orders.
