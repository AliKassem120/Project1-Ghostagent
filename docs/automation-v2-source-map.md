# Automation V2 — Dashboard Source Map

> Audit date: 2026-04-27
> Status: COMPLETE — Phase 0

This document maps every dashboard page and database table that the Automation Engine V2 must interact with. The bot must only read/write to the exact same tables and columns that the dashboard uses.

---

## APPOINTMENTS WORKSPACE

### 1. Services

| Field | Value |
|-------|-------|
| Dashboard file | `src/app/dashboard/services/page.tsx` |
| Database table | `services` |
| Columns used by UI | `id, name, description, price, duration_minutes, is_active, aliases, category, buffer_before, buffer_after, created_at` |
| Filter | `.eq("workspace_id", activeWorkspaceId)` |
| Write path | Insert/Update/Delete via dashboard UI |
| Bot reads | `name, price, duration_minutes, is_active, aliases, category, buffer_before, buffer_after` |
| Bot writes | Nothing — read-only for bot |

### 2. Working Hours

| Field | Value |
|-------|-------|
| Dashboard file | `src/app/dashboard/hours/page.tsx` |
| Database table | `business_hours` |
| Columns used by UI | `day_of_week, is_open, open_time, close_time` |
| Filter | `.eq("workspace_id", activeWorkspaceId)` |
| Write path | Upsert all 7 days via dashboard UI |
| Bot reads | `day_of_week, is_open, open_time, close_time` |
| Bot writes | Nothing — read-only for bot |

### 3. Calendar (Appointments)

| Field | Value |
|-------|-------|
| Dashboard file | `src/app/dashboard/calendar/page.tsx` |
| Database table | `appointments` |
| Columns used by UI | `id, customer_name, customer_phone, service, appointment_date, start_time, end_time, duration_minutes, status, instagram_handle, notes, source` |
| Filter | `.eq("workspace_id", activeWorkspaceId).gte("appointment_date", startOfMonth).lte("appointment_date", endOfMonth)` |
| Status values | `confirmed, cancelled, completed, no_show` |
| Write path | Manual create via modal + bot automation |
| Bot reads | Existing appointments for overlap check |
| Bot writes | Insert into `appointments` with: `user_id, workspace_id, instagram_user_id, instagram_handle, customer_name, customer_phone, service, appointment_date, start_time, end_time, duration_minutes, status='confirmed', notes` |

### 4. AI Settings

| Field | Value |
|-------|-------|
| Dashboard file | `src/app/dashboard/settings/page.tsx` |
| Database table | `ai_settings` |
| Columns used by bot | `business_name, business_type, tone, system_instructions, language, store_location, contact_info, use_emojis, use_local_slang, urgency_mode, handoff_keywords, shipping_rules, timezone, slot_duration_minutes` |
| Filter | `.eq("id", workspaceId)` |
| Bot reads | All above columns |
| Bot writes | Nothing — read-only for bot |

### 5. Conversation State

| Field | Value |
|-------|-------|
| Code file | `src/lib/conversation-state.ts` |
| Database table | `conversation_states` |
| Columns | `user_id, workspace_id, chat_id, workspace_type, stage, data, updated_at` |
| Unique constraint | `(user_id, workspace_id, chat_id, workspace_type)` |
| Bot reads | Stage + data for current chat |
| Bot writes | Upsert on every state transition, delete on completion/cancel |

### 6. Activity Log / Inbox

| Field | Value |
|-------|-------|
| Dashboard file | `src/app/dashboard/inbox/page.tsx` |
| Database table | `activity_log` |
| Key columns | `user_id, workspace_id, event_type, description, timestamp, metadata (chat_id, username, profile_pic, platform)` |
| Bot writes | Logs message received + reply sent events |

### 7. Instagram Integration

| Field | Value |
|-------|-------|
| Database table | `instagram_integrations` |
| Key columns | `workspace_id, instagram_page_id, instagram_user_id, access_token, instagram_username` |
| Bot reads | Token and page ID for sending replies |

---

## E-COMMERCE WORKSPACE

### 1. Inventory / Products

| Field | Value |
|-------|-------|
| Dashboard file | `src/app/dashboard/inventory/page.tsx` |
| Database table | `inventory` |
| Columns used by UI | `id, user_id, workspace_id, item_name, price, stock_level, created_at` |
| Filter | `.eq("workspace_id", activeWorkspaceId)` |
| Write path | Add/Edit/Delete + CSV upload via dashboard |
| Bot reads | `item_name, price, stock_level, description, variants` |
| Bot writes | Nothing — read-only for bot |

### 2. Business Knowledge (CSV catalog)

| Field | Value |
|-------|-------|
| Database table | `business_knowledge` |
| Columns | `user_id, workspace_id, content, file_name` |
| Bot reads | Parsed JSON content as product catalog fallback |
| Bot writes | Nothing |

### 3. Orders

| Field | Value |
|-------|-------|
| Dashboard file | `src/app/dashboard/orders/page.tsx` |
| Database table | `orders` |
| Columns used by UI | `id, created_at, instagram_handle, item_requested, customer_name, customer_phone, customer_address, status, raw_message` |
| Filter | `.eq("workspace_id", activeWorkspaceId)` |
| Status values | `Pending, Contacted, Fulfilled` |
| Write path | Bot inserts + dashboard status updates |
| Bot reads | Recent orders for duplicate prevention (30 min window) |
| Bot writes | Insert with: `user_id, workspace_id, instagram_user_id, instagram_handle, status='Pending', customer_name, customer_phone, customer_email, item_requested, customer_address, raw_message (JSON: item_variant, payment_method, inventory_item_name, inventory_item_id)` |

### 4. Shipping

| Field | Value |
|-------|-------|
| Dashboard file | `src/app/dashboard/shipping/page.tsx` |
| Status | **Coming Soon placeholder** — no functional page |
| Database table | None dedicated |
| Bot reads | `shipping_rules` from `ai_settings` |

### 5. AI Settings

Same as appointments workspace (shared `ai_settings` table).

### 6. Conversation State

Same table as appointments, scoped by `workspace_type = 'ecommerce'`.

---

## WEBHOOK ENTRY POINT

| Field | Value |
|-------|-------|
| Instagram webhook | `src/app/api/webhook/instagram/route.ts` |
| WhatsApp webhook | `src/app/api/webhook/whatsapp/route.ts` |
| Brain router | `src/utils/ghost-brain.ts` |
| Router logic | Reads `ai_settings.business_type` → delegates to appointments or ecommerce brain |
| DM buffer | `src/utils/dm-debounce.ts` — debounces multi-message bursts into one batched message |

---

## CURRENT V1 BRAIN FILES

### Appointments
- `src/utils/brains/appointments/brain.ts` — main reply generator (now template-only)
- `src/utils/brains/appointments/intent.ts` — LLM intent classifier + fallback
- `src/utils/brains/appointments/tools.ts` — business hours, availability, services queries
- `src/utils/brains/appointments/prompt.ts` — (dead code after template migration)
- `src/lib/appointments/business-hours.ts` — hours/timezone helpers
- `src/lib/appointments/create-appointment.ts` — DB insert + visibility check
- `src/lib/appointments/resolve-service.ts` — fuzzy service matcher

### E-Commerce
- `src/utils/brains/ecommerce/brain.ts` — main reply generator (still uses LLM polish)
- `src/utils/brains/ecommerce/intent.ts` — LLM intent classifier + fallback
- `src/utils/brains/ecommerce/tools.ts` — inventory search, order creation, duplicate logic
- `src/utils/brains/ecommerce/prompt.ts` — LLM prompt builder

### Shared
- `src/utils/brains/templates.ts` — reply templates (APPOINTMENT_TEMPLATES + ECOM_TEMPLATES)
- `src/utils/brains/validator.ts` — reply validation (length, forbidden phrases)
- `src/utils/brains/types.ts` — BusinessProfile type
- `src/lib/automation/language/arabizi.ts` — Arabizi detection + normalization
- `src/lib/conversation-state.ts` — state persistence
- `src/utils/rolling-memory.ts` — conversation history/summarization
