# Automation Brain Connection Audit

## Appointments
| Dashboard source | Dashboard file | Table/API used by dashboard | Brain function | R/W | Issues found | Fixes made |
|---|---|---|---|---|---|---|
| Working Hours | `src/app/dashboard/hours/page.tsx` | `business_hours`, `ai_settings.slot_duration_minutes` | `getBusinessHoursForDay`, `getAppointmentSlotDuration` | Read | Prior flow could answer without checking state first | State-first handling added in appointments brain before classifier |
| Services | `src/app/dashboard/services/page.tsx` | `services` (`is_active=true`) | `getServices`, `resolveService` | Read | Risk of inactive/ambiguous service handling | Active services-only matching kept deterministic |
| Calendar | `src/app/dashboard/calendar/page.tsx` | `appointments` month query with `workspace_id` | `createAppointmentBooking` | Read/Write | Confirmations could occur before visibility check in some paths | Confirmation path constrained to insert success + visibility check |
| AI Settings | `src/app/dashboard/settings/page.tsx` | `ai_settings` | appointment brain bootstrap | Read | Language and model behavior coupled to prompt output | Added shared model config + language normalization modules |
| Recent Activity / Inbox | `src/app/dashboard/inbox/page.tsx` | `activity_log`, chats | appointment brain context loading | Read | Missing unified webhook outcome snapshot | Added structured webhook outcome logging module |

## E-Commerce
| Dashboard source | Dashboard file | Table/API used by dashboard | Brain function | R/W | Issues found | Fixes made |
|---|---|---|---|---|---|---|
| Products / Inventory | `src/app/dashboard/inventory/page.tsx` | `inventory` | `searchInventory` | Read | Unknown product could still continue unsafe paths | Deterministic unknown-product fallback kept in order path |
| Variants | `inventory.variants` | `inventory` JSON variants | ecommerce brain variant resolution | Read | Variant prompting inconsistent | Explicit template-first variant prompt path |
| Orders | `src/app/dashboard/orders/page.tsx` | `orders` by `workspace_id` | `finalizeEcommerceOrder` | Read/Write | Prior freeform reply risked unsafe confirms | Reply now template-first + confirmation validator |
| Leads | `orders` pending records | `orders` | pending state + missing field logic | Write | Incomplete details could attempt order flow | Missing fields now force awaiting details state |
| Delivery / Checkout | `src/app/dashboard/shipping/page.tsx`, checkout routes | settings + checkout endpoints | checkout/delivery helpers | Read | Non-deterministic copy in final LLM layer | Removed freeform final generation in ecommerce brain |
| AI Settings | `src/app/dashboard/settings/page.tsx` | `ai_settings` | ecommerce brain bootstrap | Read | Groq structured mismatch risk | Added `model-config` + JSON text fallback parser |

