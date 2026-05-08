/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Official Public Knowledge Base
 * ═══════════════════════════════════════════════════════════════
 * Hardcoded, public-safe facts about GhostAgent for the official
 * SaaS support bot. This gives the bot a baseline even when
 * no Knowledge Manager docs exist in business_knowledge.
 *
 * DO NOT include:
 *   - Private admin details / God Mode internals
 *   - DB constraints / service role keys
 *   - Internal prompts / implementation details
 *   - Customer workspace inventory
 */

export const OFFICIAL_GHOSTAGENT_FACTS = `
## What is GhostAgent?
GhostAgent is an AI-powered customer service assistant for Instagram and WhatsApp.
It replies to DMs, answers customer questions, captures orders, books appointments,
and helps businesses save time by automating routine conversations.

## How does it work?
1. Connect your Instagram Business/Creator account or WhatsApp Business number.
2. Add your products (for e-commerce) or services + working hours (for appointments).
3. Configure the AI tone, language, and any custom instructions.
4. GhostAgent replies automatically (Autopilot) or saves drafts for your review.

## Supported Channels
- **Instagram DMs** — replies to direct messages automatically.
- **Instagram Comments** — replies to post/reel comments and can send interested users to DMs.
- **WhatsApp Business** — replies to WhatsApp messages when connected.

## Workspace Types
- **E-Commerce** — for businesses selling products. Handles product questions, pricing,
  stock checks, order capture (name, phone, address), and confirmation.
- **Appointments** — for service businesses. Handles service questions, availability checks,
  appointment booking (name, phone, date/time), and confirmation.

## E-Commerce Features
- AI answers product questions using live inventory data.
- Captures customer name, phone, and delivery address.
- Confirms orders only after customer approval and successful database save.
- Supports cash-on-delivery businesses.
- Tracks orders in the dashboard (pending, confirmed, shipped, delivered, cancelled).
- Supports product variants (size, color).
- Stock levels update automatically when orders are placed.

## Appointment Features
- AI shows available services and prices.
- Checks real-time availability against working hours and existing bookings.
- Captures customer name and phone.
- Confirms appointments only after customer approval and successful database save.
- Tracks appointments in the dashboard (confirmed, completed, cancelled, no-show).

## Language Support
- English, Arabic, French, Spanish.
- **Arabizi / Lebanese Franco** — GhostAgent natively understands Latin-script Arabic like
  "kifak", "bde", "adde", "3nwen", "ra2me", and mixed English-Arabizi messages.
- Auto-Detect mode matches the customer's language automatically.

## Autopilot & Draft Mode
- **Autopilot ON** — AI replies instantly without owner review.
- **Autopilot OFF (Draft Mode)** — AI generates replies but saves them as drafts.
  The business owner reviews and sends manually from the Inbox.
- Autopilot can be toggled on/off at any time from the dashboard.

## Dashboard Pages
- **Inbox** — view all conversations, see AI drafts, send manual replies.
- **Orders** — view, manage, and update customer orders.
- **Appointments** — view, manage, and update customer bookings.
- **Inventory** — add products manually or upload via CSV.
- **Services** — add services with prices, durations, and categories.
- **Working Hours** — set open/close times for each day of the week.
- **Settings** — configure business name, type, tone, language, AI instructions, integrations.
- **Billing** — view plan, usage, and manage subscription.

## Pricing Plans
- **Starter (Free)** — 100 AI replies/month, 1 Instagram account, basic features.
- **Pro Agent ($49/month)** — 1,000 AI replies/month, 1 Instagram account, dual workspace,
  custom AI persona, sales & booking analytics, priority support.
- **Empire ($199/month)** — Unlimited AI replies, up to 5 Instagram accounts,
  unlimited workspaces, team access, priority onboarding.

## Connecting Instagram
1. Go to Settings → Connect Instagram.
2. Log in with a Facebook account that manages the Instagram Business/Creator page.
3. Grant the required permissions (messages, comments, profile).
4. Once connected, GhostAgent receives DMs and comments via webhook.

## Connecting WhatsApp
1. Go to Settings → WhatsApp section.
2. Enter the WhatsApp Business Phone Number ID and Access Token from Meta Business Suite.
3. Configure the webhook URL in Meta Developer Portal.
4. Once connected, GhostAgent receives and replies to WhatsApp messages.

## Troubleshooting
- **Bot not replying?** Check that Autopilot is ON and the integration is connected in Settings.
- **Wrong answers?** Update product/service data in Inventory/Services and add custom AI instructions.
- **Instagram disconnected?** Re-connect from Settings → Connect Instagram.

## Can I talk to the team?
Yes. If you need help with setup, have questions, or want a demo, we can connect you
with the GhostAgent team.
`.trim();
