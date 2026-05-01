/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — V5 Agent: Pre-Fetched Context Architecture
 * ═══════════════════════════════════════════════════════════════
 *
 * ZERO search tools. ZERO hallucination.
 *
 * Instead of giving the AI "get_services" and hoping it calls it,
 * we fetch services/products with pure TypeScript BEFORE the LLM
 * runs, then paste them into the system prompt as hard facts.
 *
 * The AI only gets write-tools (book_appointment, place_order)
 * and ONLY after all required data is collected.
 *
 * Workers:
 *   handleGreeting()       → Pure code, zero tokens
 *   handleComplaint()      → Pure code, [HANDOFF]
 *   handleHoursInquiry()   → Pure DB, zero tokens
 *   handleCancelRequest()  → Pure DB, zero tokens
 *   handleProductInquiry() → Pre-fetched products → tiny LLM (no tools)
 *   handleOrderIntent()    → Pre-fetched products → LLM with place_order ONLY
 *   handleServiceInquiry() → Pre-fetched services → tiny LLM (no tools)
 *   handleBookingIntent()  → Pre-fetched services → LLM with book_appointment + check_slot + resolve_date_time
 *   handleGeneralChat()    → LLM with NO tools
 */

import { generateText, stepCountIs } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import type { AutomationInput, AutomationResult, WorkspaceConfig, DetectedLanguage } from './types';
import { loadConversationHistory } from './history';
import { createAppointmentTools, createEcommerceTools, type ToolContext } from './tools';
import { clearConversationStateV2 } from './state';
import { translateReply } from './model';
import { buildTimeContext, formatTime12 } from './time';
import { v2log } from './logger';
import type { Intent } from './classifier';
import { runBookingStateMachine, runOrderStateMachine } from './state-machine';

// ── Data layer imports (for pre-fetching) ────────────────────
import { loadActiveServices, findBestServiceMatch } from './appointments/services';
import { loadBusinessHours } from './appointments/hours';
import { searchProducts } from './ecommerce/products';
import { getKnownCustomerDetails } from './customer-history';

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
MAXIMUM 10 WORDS per reply. Be aggressively brief. English only. Never say you are an AI.
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
    v2log.info('V5_WORKER', 'Greeting → pure code reply');

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
    v2log.info('V5_WORKER', 'Complaint/Handoff → [HANDOFF]');

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
    v2log.info('V5_WORKER', 'Hours inquiry → pure DB lookup');

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
// WORKER: CANCEL REQUEST (Zero tokens — pure DB)
// ═══════════════════════════════════════════════════════════════

export async function handleCancelRequest(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    v2log.info('V5_WORKER', 'Cancel request → DB lookup');

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
// WORKER: PRODUCT INQUIRY — Pre-fetched, ZERO tools
// ═══════════════════════════════════════════════════════════════

export async function handleProductInquiry(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    v2log.info('V5_WORKER', 'Product inquiry → pre-fetched context (no tools)');

    const groq = getGroqClient();
    if (!groq) return makeErrorResult(input, config, startTime, language, 'No API key');

    // ── PRE-FETCH: Load products with pure code ──────────────
    const products = await searchProducts({ supabase: input.supabase, workspaceId: input.workspaceId });
    const catalog = products.map(p => `• ${p.itemName} — $${p.price} (${p.stockLevel > 0 ? `${p.stockLevel} in stock` : 'OUT OF STOCK'})`).join('\n');

    const timeCtx = buildTimeContext(config.timezone);
    const history = await loadConversationHistory(input.supabase, input.userId, input.workspaceId, input.chatId);

    // Discount rules
    let discountLine = '';
    if (config.maxDiscount && config.maxDiscount > 0) {
        discountLine = `If they ask for discount: max ${config.maxDiscount}% off. Never offer unless asked.`;
    } else {
        discountLine = `No discounts. If asked, say "prices are fixed".`;
    }

    // ── LLM call with ZERO tools — products already in context ──
    const result = await generateText({
        model: groq(AGENT_MODEL),
        system: `${buildBasePrompt(config, timeCtx)}
HERE ARE THE ONLY PRODUCTS WE SELL (this is the complete, real inventory):
${catalog || '(No products configured yet)'}

Answer the customer's product question using ONLY the list above.
If the product they ask about is NOT in the list, say "We don't carry that."
Never invent products, prices, or stock numbers.
${discountLine}
${config.storeLocation ? `Location: ${config.storeLocation}` : ''}
${config.shippingRules ? `Shipping: ${config.shippingRules}` : ''}`,
        messages: [...history, { role: 'user' as const, content: input.message }],
        temperature: 0.2,
        // NO TOOLS — impossible to hallucinate
    });

    let replyText = result.text?.trim() || "We don't carry that.";
    replyText = await postProcess(replyText, language, config, []);
    return buildResult(input, config, replyText, language, 'product_inquiry', ['product_inquiry'], startTime);
}

// ═══════════════════════════════════════════════════════════════
// WORKER: ORDER INTENT — Pre-fetched products, place_order ONLY
// ═══════════════════════════════════════════════════════════════

export async function handleOrderIntent(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    v2log.info('V6_WORKER', 'Order intent → STATE MACHINE');

    if (!process.env.GROQ_API_KEY) return makeErrorResult(input, config, startTime, language, 'No API key');

    const sm = await runOrderStateMachine(input, config, language);
    let replyText = await postProcess(sm.reply, language, config, sm.actions);
    return buildResult(input, config, replyText, language, 'order_intent', sm.actions, startTime, {
        dbWriteAttempted: sm.dbWriteAttempted, dbWriteSuccess: sm.dbWriteSuccess,
    });
}

// ═══════════════════════════════════════════════════════════════
// WORKER: SERVICE INQUIRY — Pre-fetched, ZERO tools
// ═══════════════════════════════════════════════════════════════

export async function handleServiceInquiry(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    v2log.info('V5_WORKER', 'Service inquiry → pre-fetched context (no tools)');

    const groq = getGroqClient();
    if (!groq) return makeErrorResult(input, config, startTime, language, 'No API key');

    // ── PRE-FETCH: services ──────────────────────────────────
    const services = await loadActiveServices(input.supabase, input.workspaceId);
    const serviceList = services.map(s => `• ${s.name} — $${s.price} (${s.durationMinutes} min)`).join('\n');

    const timeCtx = buildTimeContext(config.timezone);
    const history = await loadConversationHistory(input.supabase, input.userId, input.workspaceId, input.chatId);

    const result = await generateText({
        model: groq(AGENT_MODEL),
        system: `${buildBasePrompt(config, timeCtx)}
HERE ARE THE ONLY SERVICES WE OFFER:
${serviceList || '(No services configured yet)'}

Answer the customer's question using ONLY the list above.
If the service they ask about is NOT in the list, say "We don't offer that."
Never invent services, prices, or durations.`,
        messages: [...history, { role: 'user' as const, content: input.message }],
        temperature: 0.2,
        // NO TOOLS
    });

    let replyText = result.text?.trim() || "Check our services page for details.";
    replyText = await postProcess(replyText, language, config, []);
    return buildResult(input, config, replyText, language, 'service_inquiry', ['service_inquiry'], startTime);
}

// ═══════════════════════════════════════════════════════════════
// WORKER: BOOKING INTENT — Pre-fetched services, minimal tools
// ═══════════════════════════════════════════════════════════════

export async function handleBookingIntent(
    input: AutomationInput,
    config: WorkspaceConfig,
    language: DetectedLanguage
): Promise<AutomationResult> {
    const startTime = Date.now();
    v2log.info('V6_WORKER', 'Booking intent → STATE MACHINE');

    if (!process.env.GROQ_API_KEY) return makeErrorResult(input, config, startTime, language, 'No API key');

    const sm = await runBookingStateMachine(input, config, language);
    let replyText = await postProcess(sm.reply, language, config, sm.actions);
    return buildResult(input, config, replyText, language, 'booking_intent', sm.actions, startTime, {
        dbWriteAttempted: sm.dbWriteAttempted, dbWriteSuccess: sm.dbWriteSuccess,
    });
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
    v2log.info('V5_WORKER', 'General chat → no-tool agent');

    const groq = getGroqClient();
    if (!groq) return makeErrorResult(input, config, startTime, language, 'No API key');

    const timeCtx = buildTimeContext(config.timezone);
    const history = await loadConversationHistory(input.supabase, input.userId, input.workspaceId, input.chatId);

    const result = await generateText({
        model: groq(AGENT_MODEL),
        system: `${buildBasePrompt(config, timeCtx)}
You are having a casual DM conversation. Be helpful, short, and friendly.
If they seem like they want to ${config.businessType === 'ecommerce' ? 'buy something' : 'book an appointment'},
ask what they're looking for.
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
    v2log.error('V5_WORKER', 'Worker error', { error });
    return buildResult(input, config, "Not available at the moment.", language, 'error', ['agent_error'], startTime);
}

// ═══════════════════════════════════════════════════════════════
// LEGACY EXPORT (keeps index.ts / router.ts import working)
// ═══════════════════════════════════════════════════════════════

export { handleGeneralChat as runAgent };
