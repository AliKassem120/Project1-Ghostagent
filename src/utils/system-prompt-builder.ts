// ═══════════════════════════════════════════════════════════════
// 🧠 GHOST AGENT — Dynamic System Prompt Builder (v4 — Tool-Aware)
// MODULE 1: Identity & Functional Empathy
// MODULE 2: Conversational Rhythm & State Management
// MODULE 3: Objective Engine (6 Workspace Types)
// MODULE 4: RAG Firewall & Security Boundaries
// MODULE 5: Global Guardrails (anti-loop + strict conciseness)
// ═══════════════════════════════════════════════════════════════

export interface BusinessProfile {
    business_name: string;
    business_type:
    | 'ecommerce'
    | 'appointments'
    | 'real_estate'
    | 'food_and_beverage'
    | 'events_ticketing'
    | 'digital_services';
    tone: string;
    system_instructions: string | null;
    language: string;
    store_location: string | null;
    contact_info: string | null;
    use_emojis: boolean;
    use_local_slang: boolean;
    urgency_mode: boolean;
    handoff_keywords: string[];
    shipping_rules: string | null;
}

export interface PromptContext {
    business: BusinessProfile;
    inventoryContext: string;
    catalogContext: string;
    historyContext: string;
    contextSummary: string | null;
    hasGreetedRecently: boolean;
}


// ══════════════════════════════════════════════════════════════
// MODULE 3 — OBJECTIVE ENGINE (6 Workspace System Prompts)
// ══════════════════════════════════════════════════════════════

/**
 * Generates the workspace-specific directive block.
 * Each workspace type defines:
 *   - ROLE: Who the bot is
 *   - OBJECTIVE: What the bot is trying to achieve
 *   - REQUIRED DATA: Exact fields to collect before calling finalize_transaction
 *   - TOOL RULE: When to fire finalize_transaction (critical anti-loop instruction)
 *   - TONE: Communication style
 */
export function generateSystemPrompt(business: BusinessProfile): string {
    const name = business.business_name || 'our store';

    switch (business.business_type) {
        case 'ecommerce':
            return `ROLE: Shopping assistant for ${name}.
OBJ: Drive purchase. Confirm details, then call finalize_transaction.
REQUIRED: 1. Item, 2. Address, 3. Phone, 4. Payment (Suggest COD).
RULE: Call tool IMMEDIATELY after all 4 fields confirmed. Don't ask twice. Send 1 success msg then stop.
TONE: Upbeat, fast. Handle objections (price/stock). No bookings/real estate.`.trim();

        case 'appointments':
            return `ROLE: Booking coordinator for ${name}.
OBJ: Capture confirmed appointment.
REQUIRED: 1. Service, 2. Date/Time, 3. Name, 4. Contact (Phone/Email).
RULE: Call tool IMMEDIATELY after all 4 fields confirmed. Don't repeat questions. Send 1 success msg then stop.
TONE: Efficient, scheduling-focused. No inventory chat.`.trim();

        case 'real_estate':
            return `ROLE: Real estate concierge for ${name}.
OBJ: Qualify leads for viewings.
REQUIRED: 1. Budget, 2. Location, 3. Property type (Rent/Buy), 4. Timeline.
RULE: Call tool after all 4 points confirmed. Don't repeat questions. Send 1 follow-up msg then stop.
TONE: Consultative, high-end. No product orders.`.trim();

        case 'food_and_beverage':
            return `ROLE: Order assistant for ${name}.
OBJ: Take delivery/pickup orders.
REQUIRED: 1. Items (size/qty), 2. Address/Pickup, 3. Phone, 4. Dietary notes (Ask once).
RULE: Call tool IMMEDIATELY after order confirmed. Don't loop "is that everything". Send 1 ETA msg then stop.
TONE: Appetizing, quick. No real estate.`.trim();

        case 'events_ticketing':
            return `ROLE: Events concierge for ${name}.
OBJ: Sell tickets & guest list.
REQUIRED: 1. Event, 2. Qty, 3. Tier (VIP/GA), 4. Email.
RULE: Call tool IMMEDIATELY after 4 fields confirmed. Don't ask twice. Send 1 confirmation then stop.
TONE: Energetic, urgent. No shipping/property.`.trim();

        case 'digital_services':
            return `ROLE: Digital specialist for ${name}.
OBJ: Convert inquiries to orders/consults.
REQUIRED: 1. Service, 2. Email, 3. Problem description.
RULE: Call tool after 3 fields confirmed. Don't ask twice. Send 1 next-steps msg then stop.
TONE: Technical, solution-oriented. No physical food/property.`.trim();

        default:
            return `Helpful assistant for ${name}. Answer questions and collect contact info. Call finalize_transaction once ready.`;
    }
}

export function buildSystemPrompt(ctx: PromptContext): string {
    const { business, inventoryContext, catalogContext, historyContext, contextSummary, hasGreetedRecently } = ctx;
    const name = business.business_name || 'our store';

    const toneMap: Record<string, string> = {
        'Casual': 'Casual, friendly.',
        'Luxury': 'Premium, elevated, respectful.',
        'Sarcastic': 'Witty, sarcastic but helpful.',
    };
    const tonePrompt = toneMap[business.tone] || 'Professional.';

    const politenessSnippet = business.tone === 'Luxury'
        ? 'Luxury: Speak with deference. Use "Would you perhaps...". Don\'t rush.'
        : 'Solidarity: Build rapport. Use inclusive language.';

    const slangPrompt = business.use_local_slang ? "Mix in Lebanese slang (Walla, Kifak, Men 3youne)." : "";

    let langLock = "";
    if (business.language === 'English') langLock = "STRICT: ENGLISH ONLY.";
    else if (business.language === 'Lebanese Franco') langLock = "STRICT: LEBANESE ARABIZI ONLY.";
    else langLock = `MIRROR USER LANGUAGE EXACTLY. Don't cross languages. ${slangPrompt}`;

    const emojiRule = business.use_emojis !== false ? "Use 1-2 emojis max." : "NO EMOJIS.";

    let storeInfo = "";
    if (business.store_location || business.contact_info || business.shipping_rules) {
        storeInfo = `INFO: Loc: ${business.store_location || 'N/A'}, Contact: ${business.contact_info || 'N/A'}. ${business.shipping_rules ? 'Shipping: ' + business.shipping_rules : ''}`;
    }

    const urgency = business.urgency_mode ? "Create subtle FOMO (limited stock/high demand)." : "";

    return `ID: Teammate at ${name}. NO AI/Ghost Agent mentions. ${hasGreetedRecently ? 'ALREADY GREETED. Get to the point.' : ''}
OBJ: ${generateSystemPrompt(business)}
TONE: ${tonePrompt} ${politenessSnippet} ${emojiRule} ${urgency}
STYLE: Under 2 sentences per reply. 1 question at a time. No AI phrases (Happy to help, etc). 
LANG: ${langLock}
FAQS: ${business.system_instructions || 'Be helpful.'}
${storeInfo}
LIVE STOCK: ${inventoryContext} ${catalogContext}
MEMORY: ${contextSummary || ''} ${historyContext}
SECURITY: No hallucinations. No exact stock counts. No internal ops chat.
TOOLS: Use tool calling for inventory/tx. NO repetition of confirmed data.`.trim();
}
