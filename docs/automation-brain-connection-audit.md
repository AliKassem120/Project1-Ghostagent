# Automation Brain Connection Audit

This document records the exact mapping between Dashboard UI features, database tables, and the Automation Brain tools.

## 1. Service/Appointments Workspace

| Dashboard UI | Database Table | Brain Function | Shared Utility |
| :--- | :--- | :--- | :--- |
| **Services Page** | `services` | `getServices()` | `src/lib/appointments/services.ts` |
| **Calendar Page** | `appointments` | `createAppointmentBooking()` | `src/lib/appointments/create-appointment.ts` |
| **Hours Page** | `business_hours` | `getBusinessHours()` | `src/lib/appointments/business-hours.ts` |
| **Settings (Slot Duration)** | `ai_settings` | `getAppointmentSlotDuration()` | `src/lib/appointments/business-hours.ts` |
| **Settings (Timezone)** | `ai_settings` | `getWorkspaceTimezone()` | `src/lib/appointments/business-hours.ts` |

## 2. E-Commerce Workspace

| Dashboard UI | Database Table | Brain Function | Shared Utility |
| :--- | :--- | :--- | :--- |
| **Inventory (Manual)** | `inventory` | `searchInventory()` | `src/utils/brains/ecommerce/tools.ts` |
| **Inventory (CSV)** | `business_knowledge` | `searchInventory()` | `src/utils/brains/ecommerce/tools.ts` (Requires Fix) |
| **Orders Page** | `orders` | `finalizeEcommerceOrder()` | `src/utils/brains/ecommerce/tools.ts` |
| **Settings (Shipping)** | `ai_settings` | `loadBusinessProfile()` | `src/utils/brains/ecommerce/brain.ts` |
| **Settings (Discounts)** | `ai_settings` | `loadBusinessProfile()` | `src/utils/brains/ecommerce/brain.ts` |

## 3. Global Settings & Safeguards

| Feature | Database Table | Logic Location |
| :--- | :--- | :--- |
| **Autopilot Toggle** | `ai_settings` | `src/app/api/webhook/instagram/route.ts` |
| **Usage Limits** | `users.plan_tier` | `src/app/api/webhook/instagram/route.ts` |
| **Reply Delay** | `ai_settings` | `src/app/api/webhook/instagram/route.ts` |
| **Conversation State** | `conversation_state` | `src/lib/conversation-state.ts` |
