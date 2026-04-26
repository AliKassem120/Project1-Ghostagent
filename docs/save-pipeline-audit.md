# Save Pipeline Audit — GhostAgent
Generated: 2026-04-27

---

## Appointments Calendar Source

**Calendar UI file:** `src/app/dashboard/calendar/page.tsx`

**Table:** `appointments`

**Required fields (columns read by the UI):**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `customer_name` | text | shown in card |
| `customer_phone` | text | shown in card |
| `service` | text | plain text snapshot (NOT a FK) |
| `appointment_date` | date | `YYYY-MM-DD` format |
| `start_time` | time | `HH:mm` format |
| `end_time` | time | `HH:mm` format |
| `duration_minutes` | int | shown on card |
| `status` | text | `confirmed \| cancelled \| completed \| no_show` |
| `instagram_handle` | text | shown on card |
| `notes` | text | optional |
| `source` | text | `instagram \| manual` |
| `workspace_id` | uuid | workspace filter |
| `user_id` | uuid | owner filter |

**Filters applied by the calendar:**
- `appointment_date >= startOfMonth AND <= endOfMonth`
- `workspace_id = activeWorkspaceId` (if set)
- OR `user_id = user.id AND workspace_id IS NULL` (legacy personal)

**Status values (all lowercase):**
- `confirmed` ✅ (bot must write this)
- `cancelled`
- `completed`
- `no_show`

**Date format:** `YYYY-MM-DD` (exact `appointment_date` column)
**Time format:** `HH:mm` (24h, `start_time` and `end_time` columns)

> ⚠️ **CRITICAL**: The bot's `create-appointment.ts` writes `status: 'confirmed'` (lowercase) which matches the calendar. BUT the `orders` mirror write uses `status: 'Confirmed'` (capitalized) — this is irrelevant to the calendar but potentially confusing.

---

## Orders Page Source

**Orders UI file:** `src/app/dashboard/orders/page.tsx`

**Table:** `orders` (single table, no `order_items` join)

**Required fields (columns read by the UI):**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `created_at` | timestamp | shown as date |
| `instagram_handle` | text | @handle shown in table |
| `item_requested` | text | product column — "Unknown" if empty/missing |
| `customer_name` | text | shown in expanded row |
| `customer_phone` | text | shown in expanded row |
| `customer_address` | text | shown in expanded row |
| `status` | text | `Pending \| Contacted \| Fulfilled` (capitalized) |
| `raw_message` | text | JSON string, optional extra data |
| `workspace_id` | uuid | workspace filter |
| `user_id` | uuid | owner filter |

**Status values (CAPITALIZED — must match exactly):**
- `Pending`
- `Contacted`
- `Fulfilled`

**Workspace filter:**
- `workspace_id = activeWorkspaceId`
- If no workspace: returns empty array (line 144-148 in orders page)

**Product relationship:**
- **No separate `order_items` table used**
- Product data is stored as plain text in `item_requested`
- Bot must pass `productName + variantLabel` into `item_requested`

**Customer fields:**
- `customer_name`, `customer_phone`, `customer_address` — all direct columns on `orders`

---

## Root Cause Analysis

### Appointments not visible in calendar

The bot inserts correctly into `appointments` with `workspace_id` and `status: 'confirmed'`.

**CONFIRMED WORKING** based on code trace.

**Likely actual cause:** The `checkAppointmentAvailability()` call in `createAppointmentBooking()` returns `available: false` or throws, and the function silently returns `null`. The brain then calls `replyWithTruth({ booking_failed: true })` — but the **BOOKING_ERROR template fires a reply** to the customer even though null was returned, which may make the bot sound like it confirmed.

The real fix: add explicit `[APPOINTMENT_CALENDAR_VISIBILITY_CHECK]` logging after every insert.

### Orders saving with empty customer/product data

**Root cause identified:**

In `ecommerce/brain.ts`, the `checkout_info` case at line 338:

```ts
if (customerName && customerPhone && deliveryAddress && state.stage === 'awaiting_order_details') {
    return await performOrder(pendingData);
}
```

This is correct. But the bug is that `intent.customer_name`, `intent.customer_phone`, `intent.customer_address` are often `null` from the LLM classifier when the message is just "Okay" — and `state.data` may also be incomplete from the first `purchase_intent` hit.

When the **first** `purchase_intent` fires (before details), `pendingData` is built with `customerName: null`, `customerPhone: null`, `deliveryAddress: null`. If the `awaiting_order_details` stage check fails for any reason, the code falls through to `return await performOrder(pendingData)` on line 351 — **with empty customer data.**

Also: `finalizeEcommerceOrder` receives `item: data.productName` which maps to `product.item_name` — this is correct **only** if the product was found in `searchInventory`. If the product was resolved from CSV with `id: 'csv-0'`, the `productId` is fake and `item_requested` gets the real name. This is fine for the Orders page (text only), but the item label logic is correct.

**The real missing fields bug:** When `performOrder` is called on line 351 directly (after "fresh" purchase_intent), `deliveryAddress` may be null and the guard in `finalizeEcommerceOrder` blocks it — but returns `ok: false` rather than asking for details. The brain's `replyWithTruth` then shows ORDER_ERROR copy instead of asking for details.

---

## Fix Summary

1. **Appointments**: Add visibility check log after insert. Add hard pre-insert validation log.
2. **Orders**: Fix the fall-through on line 351 — it must NEVER call `performOrder` if any required field is missing. Always save state and ask for details instead.
3. **Orders "Unknown" product**: The `item_requested` field gets the correct name IF `matchedItem` resolves. The guard at line 268 already blocks unknown product. The bug may be that `item` is `null` when `productName` is not passed correctly.
