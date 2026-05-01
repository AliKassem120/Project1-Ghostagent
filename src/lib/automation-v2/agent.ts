/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — V4 Agent: Specialist Workers
 * ═══════════════════════════════════════════════════════════════
 * 
 * Architecture: Classifier-First Intent Routing
 * 
 * Instead of one giant brain with all tools, we have:
 *   1. Classifier (classifier.ts) → Tags the intent (regex, 0 tokens)
 *   2. Router (router.ts) → Dispatches to the correct worker
 *   3. Workers (this file) → Tiny focused agents, each with ONLY
 *      the tools they need and a minimal prompt
 *
 * Workers:
 *   handleGreeting()       → Pure code, zero LLM tokens
 *   handleComplaint()      → Pure code, [HANDOFF]
 *   handleHoursInquiry()   → Pure DB call, zero LLM tokens
 *   handleCancelRequest()  → Pure DB call + tiny formatter
 *   handleProductInquiry() → LLM with ONLY search_products
 *   handleOrderIntent()    → LLM with search_products + place_order + lookup_customer
 *   handleServiceInquiry() → LLM with ONLY get_services
 *   handleBookingIntent()  → LLM with all booking tools
 *   handleGeneralChat()    → LLM with NO tools (just conversation)
 */

import { generateText, stepCountIs } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import type { AutomationInput, AutomationResult, WorkspaceConfig, DetectedLanguage } from './types';
import { loadConversationHistory } from './history';
import { createAppointmentTools, createEcommerceTools, type ToolContext } from './tools';
import { getConversationStateV2, clearConversationStateV2 } from './state';
import { translateReply } from './model';
import { buildTimeContext } from './time';
import { v2log } from './logger';
import type { Intent } from './classifier';

// ── Models ───────────────────────────────────────────────────

const AGENT_MODEL = 'llama-3.3-70b-versatile';

function getGroqClient() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;
    return createGroq({ apiKey });
}

// ── Shared Context Builder ───────────────────────────────────

function buildToolContext(input: AutomationInput, config: WorkspaceConfig): ToolContext {
    return {
        supabase: input.supabase,
        userId: input.userId,
        workspaceId: input.workspaceId,
        chatId: input.chatId,
        config,
        platform: input.platform,
    };
}

function buildBasePrompt(config: WorkspaceConfig, timeCtx: any): string {
    const toneMap: Record<string, string> = {
        'Casual': 'casual and friendly, like texting a friend',
        'Professional': 'polished and courteous, like a concierge',
        'Luxury': 'elegant and refined, like a boutique consultant',
        'Sarcastic': 'witty with dry humor, but still helpful',
    };
    const tone = toneMap[config.tone] || toneMap['Professional'];
    const emojiRule = config.useEmojis ? 'Max 1 emoji if natural.' : 'NO emojis.';

    return `You are the human manager of ${config.businessName}. Tone: ${tone}. ${emojiRule}
Reply in 1-8 words max. English only. Never say you are an AI.
Current: ${timeCtx.dayName}, ${timeCtx.isoDate} ${timeCtx.isoTime}.
${config.systemInstructions || ''}`;
}

function buildResult(
    input: AutomationInput,
    config: WorkspaceConfig,
    replyText: string,
    language: DetectedLanguage,
    intent: string,
    actions: string[],
    startTime: number,
    opts: { dbWriteAttempted?: boolean; dbWriteSuccess?: boolean; shouldReply?: boolean; stateAfter?: string } = {}
): AutomationResult {
    return {
        shouldReply: opts.shouldReply ?? true,
        replyText: opts.shouldReply === false ? undefined : replyText,
        actions,
        stateBefore: 'idle',
        stateAfter: (opts.stateAfter || 'idle') as any,
        debug: {
            requestId: '',
            engineVersion: 'v2',
            workspaceId: input.workspaceId,
            workspaceType: config.businessType as 'appointments' | 'ecommerce',
            chatId: input.chatId,
            language,
            intent,
            dbWriteAttempted: opts.dbWriteAttempted ?? false,
            dbWriteSuccess: opts.dbWriteSuccess ?? false,
            durationMs: Date.now() - startTime,
        },
    };
}

// ── Post-Processing Pipeline ─────────────────────────────────

async function postProcess(
    reply: string,
    language: DetectedLanguage,
    config: WorkspaceConfig,
    actions: string[]
): Promise<string> {
    let text = reply;

    // 1. Translation
    const targetLang = config.language === 'Auto-Detect' ? language : config.language;
    if (targetLang.toLowerCase() !== 'english' && targetLang !== 'Auto-Detect') {
        text = await translateReply({ reply: text, targetLanguage: targetLang, tone: config.tone });
    }

    // 2. Slang injection
    if (config.useLocalSlang && config.tone?.toLowerCase() !== 'professional') {
        const isConfirmed = actions.includes('order_created') || actions.includes('appointment_created');
        if (isConfirmed) {
            text += config.useEmojis ? ' Tekram! 🙏' : ' Tekram!';
        }
    }

    // 3. Emoji strip safety net
    if (!config.useEmojis) {
        text = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu, '').replace(/\s{2,}/g, ' ').trim();
    }

    return text;
}

// ═══════════════════════════════════════════════════════════════
// WORKER: GREETING (Zero tokens)
// ═══════════════════════════════════════════════════════════════

export async function handleGreeting(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    v2log.info('V4_WORKER', 'Greeting → pure code reply');

    const greetings: Record<string, string[]> = {
        'Casual': ["Hey! What can I get you?", "Hi! Looking for something?", "Hey! How can I help?"],
        'Professional': ["Hello! How may I assist you?", "Welcome! How can I help?", "Good to hear from you! How may I help?"],
        'Luxury': ["Welcome! How may I be of service?", "A pleasure to hear from you. How may I assist?"],
        'Sarcastic': ["Hey! Ready to spend some money?", "Oh hi! What are we looking for today?"],
    };
    const options = greetings[config.tone] || greetings['Professional'];
    let reply = options[Math.floor(Math.random() * options.length)];
    reply = await postProcess(reply, language, config, []);

    return buildResult(input, config, reply, language, 'greeting', ['greeting'], startTime);
}

// ═══════════════════════════════════════════════════════════════
// WORKER: COMPLAINT / HANDOFF (Zero tokens)
// ═══════════════════════════════════════════════════════════════

export async function handleComplaint(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    v2log.info('V4_WORKER', 'Complaint/Handoff → [HANDOFF]');

    return buildResult(input, config, '', language, 'complaint', ['handoff'], startTime, {
        shouldReply: false,
        stateAfter: 'handoff',
    });
}

// ═══════════════════════════════════════════════════════════════
// WORKER: HOURS INQUIRY (Zero tokens — pure DB)
// ═══════════════════════════════════════════════════════════════

export async function handleHoursInquiry(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    v2log.info('V4_WORKER', 'Hours inquiry → pure DB lookup');

    const { loadBusinessHours } = await import('./appointments/hours');
    const { formatTime12 } = await import('./time');
    const hours = await loadBusinessHours(input.supabase, input.workspaceId);

    if (hours.length === 0) {
        const reply = await postProcess("Working hours not set up yet.", language, config, []);
        return buildResult(input, config, reply, language, 'hours_inquiry', ['hours_checked'], startTime);
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const lines = hours
        .filter(h => h.isOpen)
        .map(h => `${dayNames[h.dayOfWeek]}: ${formatTime12(h.openTime)}-${formatTime12(h.closeTime)}`);

    let reply = lines.length > 0 ? lines.join(', ') : 'Currently closed.';
    reply = await postProcess(reply, language, config, []);

    return buildResult(input, config, reply, language, 'hours_inquiry', ['hours_checked'], startTime);
}

// ═══════════════════════════════════════════════════════════════
// WORKER: CANCEL REQUEST (Minimal DB call)
// ═══════════════════════════════════════════════════════════════

export async function handleCancelRequest(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    v2log.info('V4_WORKER', 'Cancel request → DB lookup');

    let reply: string;
    let actions: string[] = [];

    if (config.businessType === 'ecommerce') {
        const { data: recent } = await input.supabase.from('orders')
            .select('id, item_requested')
            .eq('workspace_id', input.workspaceId)
            .eq('instagram_user_id', input.chatId)
            .eq('status', 'Pending')
            .order('created_at', { ascending: false })
            .limit(1).maybeSingle();

        if (!recent) {
            reply = "No pending order to cancel.";
        } else {
            await input.supabase.from('orders').update({ status: 'Cancelled' }).eq('id', recent.id);
            reply = `Order cancelled: ${recent.item_requested}`;
            actions = ['order_cancelled'];
            await clearConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'ecommerce', input.platform);
        }
    } else {
        const { formatTime12 } = await import('./time');
        const { data: upcoming } = await input.supabase.from('appointments')
            .select('id, service, appointment_date, start_time')
            .eq('workspace_id', input.workspaceId)
            .eq('instagram_user_id', input.chatId)
            .eq('status', 'Confirmed')
            .order('appointment_date', { ascending: true })
            .limit(1).maybeSingle();

        if (!upcoming) {
            reply = "No upcoming appointment to cancel.";
        } else {
            await input.supabase.from('appointments').update({ status: 'Cancelled' }).eq('id', upcoming.id);
            reply = `Cancelled: ${upcoming.service} on ${upcoming.appointment_date}`;
            actions = ['appointment_cancelled'];
            await clearConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform);
        }
    }

    reply = await postProcess(reply, language, config, actions);
    return buildResult(input, config, reply, language, 'cancel_request', actions, startTime);
}

// ═══════════════════════════════════════════════════════════════
// WORKER: PRODUCT INQUIRY (search_products ONLY)
// ═══════════════════════════════════════════════════════════════

export async function handleProductInquiry(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    v2log.info('V4_WORKER', 'Product inquiry → search_products agent');

    const groq = getGroqClient();
    if (!groq) return makeErrorResult(input, config, startTime, language, 'No API key');

    const timeCtx = buildTimeContext(config.timezone);
    const toolCtx = buildToolContext(input, config);
    const allTools = createEcommerceTools(toolCtx);
    const history = await loadConversationHistory(input.supabase, input.userId, input.workspaceId, input.chatId);

    // ONLY give it search_products — nothing else
    const tools = { search_products: allTools.search_products };

    // Discount rules (injected only for product inquiries)
    let discountLine = '';
    if (config.maxDiscount && config.maxDiscount > 0) {
        discountLine = `If they ask for discount: max ${config.maxDiscount}% off. Never offer unless asked.`;
    } else {
        discountLine = `No discounts. If asked, say "prices are fixed".`;
    }

    const result = await generateText({
        model: groq(AGENT_MODEL),
        system: `${buildBasePrompt(config, timeCtx)}
You answer product questions. Call search_products to check price and stock.
After the tool returns, reply with ONLY the price/availability. 1-8 words max.
If the product is not found, say "We don't have that." — nothing more.
${discountLine}
${config.storeLocation ? `Location: ${config.storeLocation}` : ''}
${config.shippingRules ? `Shipping: ${config.shippingRules}` : ''}`,
        messages: [...history, { role: 'user' as const, content: input.message }],
        tools: tools as any,
        stopWhen: stepCountIs(3),
        temperature: 0.2,
    });

    let replyText = result.text?.trim() || '';

    // Fallback if LLM didn't generate text
    if (!replyText) {
        const toolResult = result.steps?.[0]?.toolResults?.[0] as any;
        const data = toolResult?.result ?? toolResult?.output;
        if (data?.products?.length > 0) {
            const p = data.products[0];
            replyText = p.inStock ? `${p.name} — $${p.price}` : `${p.name} — out of stock.`;
        } else {
            replyText = "We don't carry that.";
        }
    }

    replyText = await postProcess(replyText, language, config, ['tool_search_products']);
    return buildResult(input, config, replyText, language, 'product_inquiry', ['tool_search_products'], startTime);
}

// ═══════════════════════════════════════════════════════════════
// WORKER: ORDER INTENT (search + place_order + lookup)
// ═══════════════════════════════════════════════════════════════

export async function handleOrderIntent(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    v2log.info('V4_WORKER', 'Order intent → checkout agent');

    const groq = getGroqClient();
    if (!groq) return makeErrorResult(input, config, startTime, language, 'No API key');

    const timeCtx = buildTimeContext(config.timezone);
    const toolCtx = buildToolContext(input, config);
    const allTools = createEcommerceTools(toolCtx);
    const history = await loadConversationHistory(input.supabase, input.userId, input.workspaceId, input.chatId);

    // Give it search + place_order + lookup — NO cancel, NO hours
    const tools = {
        search_products: allTools.search_products,
        place_order: allTools.place_order,
        lookup_customer: allTools.lookup_customer,
    };

    const result = await generateText({
        model: groq(AGENT_MODEL),
        system: `${buildBasePrompt(config, timeCtx)}
The customer wants to buy something. Your job is to collect: Product Name/Variant, Name, Phone, and Delivery Address.
RULES:
1. ALWAYS call search_products first if you are not 100% sure what the exact product name or variant is. NEVER hallucinate products or stock status.
2. Call lookup_customer first to check if they're a returning customer (skip asking for saved info).
3. Ask the customer for their full name, phone number, and delivery address if you don't have it. NEVER invent phone numbers or addresses.
4. If they already provided all details, call place_order immediately.
5. After place_order returns success, say "Order confirmed." and stop.
6. If place_order fails, say "Order couldn't be placed, try again."
7. NEVER say "Order confirmed" without calling place_order first.`,
        messages: [...history, { role: 'user' as const, content: input.message }],
        tools: tools as any,
        stopWhen: stepCountIs(6),
        temperature: 0.2,
    });

    let replyText = result.text?.trim() || '';
    const actions: string[] = [];
    let dbWriteAttempted = false;
    let dbWriteSuccess = false;

    // Parse tool results
    for (const step of result.steps || []) {
        for (const tr of step.toolResults || []) {
            const toolName = (tr as any).toolName as string;
            const data = (tr as any).result ?? (tr as any).output;
            v2log.info('V4_WORKER', `Tool: ${toolName}`, { result: JSON.stringify(data)?.slice(0, 200) });

            if (toolName === 'place_order') {
                dbWriteAttempted = true;
                if (data?.success) {
                    dbWriteSuccess = true;
                    actions.push('order_created');
                    await clearConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'ecommerce', input.platform);
                }
            }
        }
    }

    if (!replyText) {
        replyText = dbWriteSuccess
            ? "Order confirmed!"
            : "Send your name, phone, and delivery address.";
    }

    replyText = await postProcess(replyText, language, config, actions);
    return buildResult(input, config, replyText, language, 'order_intent', actions, startTime, { dbWriteAttempted, dbWriteSuccess });
}

// ═══════════════════════════════════════════════════════════════
// WORKER: SERVICE INQUIRY (get_services ONLY)
// ═══════════════════════════════════════════════════════════════

export async function handleServiceInquiry(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    v2log.info('V4_WORKER', 'Service inquiry → get_services agent');

    const groq = getGroqClient();
    if (!groq) return makeErrorResult(input, config, startTime, language, 'No API key');

    const timeCtx = buildTimeContext(config.timezone);
    const toolCtx = buildToolContext(input, config);
    const allTools = createAppointmentTools(toolCtx);
    const history = await loadConversationHistory(input.supabase, input.userId, input.workspaceId, input.chatId);

    // ONLY get_services
    const tools = { get_services: allTools.get_services };

    const result = await generateText({
        model: groq(AGENT_MODEL),
        system: `${buildBasePrompt(config, timeCtx)}
You answer questions about available services. Call get_services to check.
List services with prices briefly. Keep reply short.
If they ask about a specific service, show its price and duration.`,
        messages: [...history, { role: 'user' as const, content: input.message }],
        tools: tools as any,
        stopWhen: stepCountIs(3),
        temperature: 0.2,
    });

    let replyText = result.text?.trim() || "Check our services page for details.";
    replyText = await postProcess(replyText, language, config, ['tool_get_services']);
    return buildResult(input, config, replyText, language, 'service_inquiry', ['tool_get_services'], startTime);
}

// ═══════════════════════════════════════════════════════════════
// WORKER: BOOKING INTENT (full appointment tools)
// ═══════════════════════════════════════════════════════════════

export async function handleBookingIntent(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    v2log.info('V4_WORKER', 'Booking intent → appointment agent');

    const groq = getGroqClient();
    if (!groq) return makeErrorResult(input, config, startTime, language, 'No API key');

    const timeCtx = buildTimeContext(config.timezone);
    const toolCtx = buildToolContext(input, config);
    const allTools = createAppointmentTools(toolCtx);
    const history = await loadConversationHistory(input.supabase, input.userId, input.workspaceId, input.chatId);

    // Full booking toolset — but NO cancel (handled separately)
    const tools = {
        get_services: allTools.get_services,
        get_business_hours: allTools.get_business_hours,
        check_slot: allTools.check_slot,
        resolve_date_time: allTools.resolve_date_time,
        book_appointment: allTools.book_appointment,
        lookup_customer: allTools.lookup_customer,
    };

    const result = await generateText({
        model: groq(AGENT_MODEL),
        system: `${buildBasePrompt(config, timeCtx)}
The customer wants to book an appointment. Your job is to collect: Service, Date/Time, Name, and Phone.
RULES:
1. ALWAYS call get_services first if you are not 100% sure what the exact name of the service is. NEVER hallucinate services like "manicure" or "pedicure" unless get_services returns them.
2. If they ask for a service you don't have, tell them what you DO have based on get_services.
3. Use resolve_date_time for natural language dates ("tomorrow 3pm").
4. Call check_slot BEFORE confirming to ensure it's available.
5. Use lookup_customer — if returning, skip asking saved info.
6. Ask the customer for their full name and phone number if you don't have it. NEVER invent a phone number.
7. Call book_appointment ONLY after customer confirms all details.
8. NEVER say "booked" unless book_appointment returned success.`,
        messages: [...history, { role: 'user' as const, content: input.message }],
        tools: tools as any,
        stopWhen: stepCountIs(6),
        temperature: 0.2,
    });

    let replyText = result.text?.trim() || '';
    const actions: string[] = [];
    let dbWriteAttempted = false;
    let dbWriteSuccess = false;

    for (const step of result.steps || []) {
        for (const tr of step.toolResults || []) {
            const toolName = (tr as any).toolName as string;
            const data = (tr as any).result ?? (tr as any).output;
            v2log.info('V4_WORKER', `Tool: ${toolName}`, { result: JSON.stringify(data)?.slice(0, 200) });

            if (toolName === 'book_appointment') {
                dbWriteAttempted = true;
                if (data?.success) {
                    dbWriteSuccess = true;
                    actions.push('appointment_created');
                    await clearConversationStateV2(input.supabase, input.userId, input.workspaceId, input.chatId, 'appointments', input.platform);
                }
            }
        }
    }

    if (!replyText) {
        replyText = dbWriteSuccess
            ? "Booking confirmed!"
            : "What service and when would you like?";
    }

    replyText = await postProcess(replyText, language, config, actions);
    return buildResult(input, config, replyText, language, 'booking_intent', actions, startTime, { dbWriteAttempted, dbWriteSuccess });
}

// ═══════════════════════════════════════════════════════════════
// WORKER: GENERAL CHAT (No tools, just conversation)
// ═══════════════════════════════════════════════════════════════

export async function handleGeneralChat(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    v2log.info('V4_WORKER', 'General chat → no-tool agent');

    const groq = getGroqClient();
    if (!groq) return makeErrorResult(input, config, startTime, language, 'No API key');

    const timeCtx = buildTimeContext(config.timezone);
    const history = await loadConversationHistory(input.supabase, input.userId, input.workspaceId, input.chatId);

    const result = await generateText({
        model: groq(AGENT_MODEL),
        system: `${buildBasePrompt(config, timeCtx)}
You are having a casual DM conversation. Be helpful, short, and friendly.
If they seem like they want to ${config.businessType === 'ecommerce' ? 'buy something' : 'book an appointment'},
ask what they're looking for. Keep replies to 1-8 words.
${config.storeLocation ? `Location: ${config.storeLocation}` : ''}
${config.contactInfo ? `Contact: ${config.contactInfo}` : ''}`,
        messages: [...history, { role: 'user' as const, content: input.message }],
        temperature: 0.4,
        // NO tools — pure conversation
    });

    let replyText = result.text?.trim() || "How can I help?";
    replyText = await postProcess(replyText, language, config, []);
    return buildResult(input, config, replyText, language, 'general_chat', ['conversation'], startTime);
}

// ═══════════════════════════════════════════════════════════════
// ERROR HELPER
// ═══════════════════════════════════════════════════════════════

function makeErrorResult(
    input: AutomationInput,
    config: WorkspaceConfig,
    startTime: number,
    language: DetectedLanguage,
    error: string
): AutomationResult {
    v2log.error('V4_WORKER', 'Worker error', { error });
    return buildResult(input, config, "Not available at the moment.", language, 'error', ['agent_error'], startTime);
}

// ═══════════════════════════════════════════════════════════════
// LEGACY EXPORT (keeps index.ts / router.ts import working)
// ═══════════════════════════════════════════════════════════════

export { handleGeneralChat as runAgent };
