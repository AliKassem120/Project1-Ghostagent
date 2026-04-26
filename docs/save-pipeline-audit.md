# Save Pipeline Audit

## Appointment save path
1. Brain builds pending booking state (`awaiting_date_time` / `awaiting_customer_details`).
2. `createAppointmentBooking` validates required fields.
3. Insert writes to `appointments` table.
4. Visibility re-check uses same month/calendar query pattern as Calendar dashboard (`workspace_id` + date range).
5. Confirmation template is allowed only when insert success flag is true.

### Calendar visibility query
- Table: `appointments`
- Filters: `workspace_id`, `appointment_date` month range.
- Verification log: `[APPOINTMENT_CALENDAR_VISIBILITY_CHECK]`.

## Order save path
1. Brain resolves product + variant + customer details.
2. Missing details => pending state / lead behavior (no confirmation).
3. `finalizeEcommerceOrder` performs deterministic writes to `orders` (and dependent order fields) used by Orders dashboard.
4. Confirmation template is allowed only when order success flag is true.

### Orders visibility query
- Table: `orders`
- Filters: `workspace_id`
- Dashboard source: `src/app/dashboard/orders/page.tsx`.

## Required fields enforced
- Appointments: `workspaceId`, `chatId`, `service`, `date`, `startTime`, `customerName`, `customerPhone`.
- Orders: `product`, `quantity`, `price`, `customerName`, `customerPhone`, `deliveryAddress/pickup`, plus workspace/chat context.

## Failure cases fixed
- Groq structured output 400 due to unsupported `json_schema` -> switched classifier flow to JSON text + safe parser + Zod validation fallback.
- Appointment follow-up state loss after asking date/time -> state-first handler now executes before classifier.
- Unsafe freeform/parroting final DM text -> template-first responses validated by shared reply validator.
- Confirmation leakage without DB success -> guarded by shared confirmation validation.
