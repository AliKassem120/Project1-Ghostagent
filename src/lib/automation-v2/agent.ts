/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — V3 Agent: Core
 * ═══════════════════════════════════════════════════════════════
 * The intelligent agent that replaces the rigid state machine.
 *
 * Architecture:
 *   1. Load conversation history (last 8 messages)
 *   2. Build system prompt with personality + business context
 *   3. Single LLM call with tool access
 *   4. LLM decides what to do: answer, call tools, or both
 *   5. Translation layer for non-English
 *
 * The agent has FULL conversation context and generates natural
 * replies directly — no template→humanize pipeline.
 */

import { generateText, stepCountIs } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import type { AutomationInput, AutomationResult, WorkspaceConfig } from './types';
import { loadConversationHistory, type HistoryMessage } from './history';
import { createAppointmentTools, createEcommerceTools, type ToolContext } from './tools';
import { loadWorkspaceConfig } from './router';
import { getConversationStateV2, updateConversationStateV2, clearConversationStateV2 } from './state';
import { detectLanguage } from './language';
import { translateReply } from './model';
import { buildTimeContext } from './time';
import { v2log } from './logger';

// ── Model Configuration ──────────────────────────────────────

const AGENT_MODEL = 'llama-3.3-70b-versatile';

function getGroqClient() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;
    return createGroq({ apiKey });
}

// ── System Prompt Builder ────────────────────────────────────

function buildSystemPrompt(
    config: WorkspaceConfig,
    stateDescription: string,
    timeCtx: any
): string {
    const businessTypeDesc = config.businessType === 'appointments'
        ? 'a premium service-based business that takes appointments'
        : 'a premium online store that sells products';

    const toolInstructions = config.businessType === 'appointments'
        ? `TOOL WORKFLOW FOR BOOKING:
1. When someone wants to book, figure out: which service, what date/time
2. Use resolve_date_time to parse natural language dates ("tomorrow 3pm", "next friday")
3. Use check_slot to verify availability BEFORE confirming anything
4. Use lookup_customer first — if they're returning, skip asking for info you already have
5. Collect full name + phone in ONE message when ready to book
6. Use book_appointment ONLY after the customer explicitly confirms
7. NEVER say an appointment is "booked" or "confirmed" unless book_appointment returned success: true`
        : `TOOL WORKFLOW FOR ORDERS:
1. Use search_products to find items — it returns name, price, AND stock level all in one call
2. NEVER guess prices or stock — always call search_products first
3. ONE call to search_products is enough — do NOT call it multiple times for the same product
4. Use lookup_customer first — if they're returning, skip asking for info you already have
5. When customer says "I want it" / "deal" / "yes" — collect name, phone, AND delivery address in ONE single message
6. Use place_order ONLY after the customer explicitly confirms
7. NEVER say an order is "placed" or "confirmed" unless place_order returned success: true
8. If they ask "when are you open?" / "working hours?" / "are you open?" — call get_business_hours
9. If they want to cancel an order — call cancel_order`;

    // ── Tone Personality ─────────────────────────────────────
    const toneMap: Record<string, string> = {
        'Casual': `Tone: Casual & Friendly. Sound like a cool store employee texting a friend. Use contractions freely (we've, it's, you're). Warm but efficient. A bit playful. Example: "Yep it's in stock! Want it?"`,
        'Professional': `Tone: Professional & Polished. Sound like a highly-paid concierge. Courteous, precise, zero slang. Use proper grammar. Example: "Yes, currently in stock for $500."`,
        'Luxury': `Tone: Luxury & Premium. Sound like a private boutique consultant. Elegant, refined, exclusive language. Use words like "exquisite", "curated", "exclusive". Example: "An excellent selection — available at $500."`,
        'Sarcastic': `Tone: Sarcastic & Witty. Sound like a confident store owner with dry humor. Be helpful but add a pinch of sarcasm. Keep it light, never rude. Example: "Yeah we've got it. Shocking, right? 500$"`,
    };
    const toneDirective = toneMap[config.tone] || toneMap['Professional'];

    // ── Emoji Rule ───────────────────────────────────────────
    const emojiRule = config.useEmojis
        ? 'EMOJIS: You may use up to 1 emoji per message, only if it feels natural. Never force emojis.'
        : 'EMOJIS: Do NOT use any emojis in your replies. Zero emojis. No exceptions.';

    // ── Discount / Negotiation Rules ─────────────────────────
    let discountRules = '';
    if (config.maxDiscount && config.maxDiscount > 0) {
        discountRules = `\nNEGOTIATION RULES:
- Maximum discount you can offer: ${config.maxDiscount}%
${config.minOrderForDiscount ? `- Only offer discounts on orders above $${config.minOrderForDiscount}` : '- You may offer discounts on any order'}
- If they ask for a discount, you may offer up to ${config.maxDiscount}% off. Say: "${config.maxDiscount}% off — best I can do."
- If they ask for MORE than ${config.maxDiscount}%, say: "Sorry, that's the best price."
- NEVER offer a discount unless the customer asks for one.`;
    } else {
        discountRules = `\nNEGOTIATION RULES:
- Do NOT offer any discounts. If they ask, say: "Sorry, prices are fixed." or "ekhir se3er" (final price).`;
    }

    return `<system_identity>
You are the highly professional, efficient, and courteous human manager of ${config.businessName}, ${businessTypeDesc}.
You are assisting clients directly via Instagram DMs.
Your goal is to provide exceptional, seamless service and guide customers to a booking or purchase effortlessly.
You are a human representative. DO NOT refer to yourself as an AI, bot, or virtual assistant.
Current Date & Time: ${timeCtx.dayName}, ${timeCtx.isoDate} at ${timeCtx.isoTime}.
</system_identity>

<core_directives>
1. ULTRA-SHORT REPLIES: Maximum 1 to 8 words per reply. Zero fluff. DM users want instant answers, not paragraphs.
   - Price question ("how much?", "price?", "ade?") → Reply ONLY the price: "Hello 50$" or just "50$". No preamble.
   - Availability question → "Yes available" or "Out of stock". Done.
   - Only ask a follow-up question to ADVANCE THE SALE (e.g., "What size?" or "Where's the location?").
2. ${toneDirective}
3. ${emojiRule}
4. ZERO ECHOING: Never repeat the user's exact phrasing. Never repeat a price you just stated.
5. NO HALLUCINATIONS: You MUST use your tools to check prices, stock, or availability. Do not invent data. If a tool returns no data, say: "Not available at the moment."
6. Respond in ENGLISH only. The system handles translation automatically.
</core_directives>

<reply_style_rules>
- If they ask ONLY about price → give ONLY the price. "50$" not "The PS5 is currently priced at $500 and is in stock."
- If they ask availability → "Yes, in stock" or "Out of stock". No extra words.
- If they ask availability AND price → combine: "Yes, 500$"
- If they say "I want it" → go straight to collecting info. ONE message.
- If they provide info (name/phone/address) → place order IMMEDIATELY, confirm in 1 sentence.
- NEVER explain how something works unless explicitly asked.
</reply_style_rules>

<state_machine_routing>
You are an autonomous routing engine. Analyze the conversation and silently follow this flow:

STATE 1: INQUIRY (User asks for price, availability, or details)
→ Silently call the appropriate tool
→ Reply with ONLY the relevant data. No fluff. No follow-up questions unless needed to close.

STATE 2: THE CLOSE (User says "I want it", "deal", "book it", "bde", "yes")
→ Collect ALL required details in ONE SINGLE MESSAGE
→ ${config.businessType === 'ecommerce' 
    ? '"Send your name, phone, and delivery address."'
    : '"Send your name and phone number."'}

STATE 3: LEAD CAPTURE (User provides their details)
→ IMMEDIATELY call the booking/order tool
→ Confirm: "Order confirmed." or "Booking confirmed." That's it.

STATE 4: COMPLAINT (User complains about delay, quality, or issue)
→ RESPOND WITH EXACTLY: [HANDOFF]
</state_machine_routing>

${toolInstructions}
${discountRules}

CRITICAL RULES — NEVER BREAK THESE:
- BEFORE answering ANY question about products, prices, stock, services, or availability: call the tool FIRST.
- If someone asks "what do you sell?" — call search_products with no query to list everything.
- NEVER confirm a booking/order without actually calling the tool.
- If they want a real person ("human", "manager", "speak to someone") → RESPOND WITH EXACTLY: [HANDOFF]
- If they complain ("late", "broken", "wrong item", "t2a5arto", "ma woselne") → RESPOND WITH EXACTLY: [HANDOFF]
- If the message contains multiple topics (greeting + question), address the question — don't just reply to the greeting.

${stateDescription ? `CUSTOMER CONTEXT:\n${stateDescription}` : ''}

BUSINESS INFO:
${config.systemInstructions || 'No specific business info provided.'}
${config.storeLocation ? `LOCATION: ${config.storeLocation}` : ''}
${config.contactInfo ? `CONTACT: ${config.contactInfo}` : ''}
${config.shippingRules ? `SHIPPING/DELIVERY: ${config.shippingRules}` : ''}

<error_handling>
If a tool returns an error or fails, DO NOT output system errors.
Reply: "Not available at the moment." — nothing more.
</error_handling>`;
}

// ── State Description Builder ────────────────────────────────

function describeState(state: any, businessType: string): string {
    if (!state || state.stage === 'idle') return '';

    const parts: string[] = [];

    if (state.stage && state.stage !== 'idle') {
        parts.push(`Current flow stage: ${state.stage}`);
    }

    if (state.appointment) {
        const a = state.appointment;
        if (a.serviceName) parts.push(`Service selected: ${a.serviceName} ($${a.servicePrice || '?'})`);
        if (a.date) parts.push(`Date: ${a.date}`);
        if (a.startTime) parts.push(`Time: ${a.startTime}`);
    }

    if (state.order) {
        const o = state.order;
        if (o.productName) parts.push(`Product selected: ${o.productName} ($${o.unitPrice || '?'})`);
        if (o.variantLabel) parts.push(`Variant: ${o.variantLabel}`);
        if (o.quantity && o.quantity > 1) parts.push(`Quantity: ${o.quantity}`);
    }

    if (state.customer) {
        const c = state.customer;
        if (c.name) parts.push(`Customer name: ${c.name}`);
        if (c.phone) parts.push(`Customer phone: ${c.phone}`);
        if (c.address) parts.push(`Delivery address: ${c.address}`);
    }

    return parts.length > 0 ? parts.join('\n') : '';
}

// ── Main Agent Function ──────────────────────────────────────

export async function runAgent(
    input: AutomationInput,
    config: WorkspaceConfig
): Promise<AutomationResult> {
    const startTime = Date.now();
    const language = detectLanguage(input.message);
    const timeCtx = buildTimeContext(config.timezone);

    // 1. Load conversation state and history
    const state = await getConversationStateV2(
        input.supabase, input.userId, input.workspaceId,
        input.chatId, config.businessType as 'appointments' | 'ecommerce', input.platform
    );
    const history = await loadConversationHistory(
        input.supabase, input.userId, input.workspaceId, input.chatId
    );

    const stateDescription = describeState(state, config.businessType);

    // 2. Build system prompt
    const systemPrompt = buildSystemPrompt(config, stateDescription, timeCtx);

    // 3. Build message array (history + current message)
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
        ...history,
        { role: 'user' as const, content: input.message },
    ];

    // 4. Build tools based on business type
    const toolCtx: ToolContext = {
        supabase: input.supabase,
        userId: input.userId,
        workspaceId: input.workspaceId,
        chatId: input.chatId,
        config,
        platform: input.platform,
    };

    const tools = config.businessType === 'appointments'
        ? createAppointmentTools(toolCtx)
        : createEcommerceTools(toolCtx);

    // 5. Run the agent
    const groq = getGroqClient();
    if (!groq) {
        v2log.error('V3_AGENT', 'No GROQ_API_KEY configured');
        return makeErrorResult(input, startTime, 'No API key');
    }

    try {
        const result = await generateText({
            model: groq(AGENT_MODEL),
            system: systemPrompt,
            messages,
            tools: tools as any,
            stopWhen: stepCountIs(8),
            temperature: 0.3,
        });

        let replyText = result.text?.trim() || '';

        // 6. Handle handoff signal
        if (replyText.includes('[HANDOFF]')) {
            return {
                shouldReply: false,
                actions: ['handoff'],
                stateBefore: state.stage,
                stateAfter: 'handoff',
                debug: makeDebug(input, language, Date.now() - startTime, 'handoff'),
            };
        }

        // 7. Parse tool calls to extract actions and state updates
        const actions: string[] = [];
        let dbWriteAttempted = false;
        let dbWriteSuccess = false;
        let lastToolResult: any = null;

        for (const step of result.steps || []) {
            for (const tr of step.toolResults || []) {
                const toolName = (tr as any).toolName as string;
                const resultData = (tr as any).result ?? (tr as any).output;

                // Log tool results for debugging
                v2log.info('V3_AGENT', `Tool result: ${toolName}`, {
                    result: JSON.stringify(resultData)?.slice(0, 200),
                });
                lastToolResult = { toolName, data: resultData };

                if (toolName === 'book_appointment' || toolName === 'place_order') {
                    dbWriteAttempted = true;
                    if (resultData?.success) {
                        dbWriteSuccess = true;
                        actions.push(toolName === 'book_appointment' ? 'appointment_created' : 'order_created');
                        await clearConversationStateV2(
                            input.supabase, input.userId, input.workspaceId,
                            input.chatId, config.businessType as 'appointments' | 'ecommerce', input.platform
                        );
                    } else {
                        actions.push(toolName === 'book_appointment' ? 'appointment_failed' : 'order_failed');
                    }
                } else if (toolName === 'cancel_appointment' || toolName === 'cancel_order') {
                    if (resultData?.success) {
                        actions.push(toolName === 'cancel_appointment' ? 'appointment_cancelled' : 'order_cancelled');
                        await clearConversationStateV2(
                            input.supabase, input.userId, input.workspaceId,
                            input.chatId, config.businessType as 'appointments' | 'ecommerce', input.platform
                        );
                    }
                } else if (toolName === 'check_slot' || toolName === 'search_products') {
                    actions.push('tool_' + toolName);
                } else if (toolName === 'lookup_customer') {
                    if (resultData?.found) actions.push('memory_used');
                }
            }
        }

        // 8. If no reply text but tools were called, try to generate a fallback from tool data
        if (!replyText) {
            v2log.warn('V3_AGENT', 'No reply text generated after tool calls', {
                steps: result.steps?.length,
                lastToolResult: JSON.stringify(lastToolResult)?.slice(0, 200),
                finishReason: result.finishReason,
            });
            // If search returned products, build a short reply from the data
            if (lastToolResult?.data?.products?.length > 0) {
                const p = lastToolResult.data.products[0];
                replyText = p.inStock
                    ? `${p.name} — $${p.price}, in stock.`
                    : `${p.name} — out of stock.`;
            } else {
                replyText = "Not available at the moment.";
            }
        }

        // 9. Translation layer (for non-English users)
        const targetLang = config.language === 'Auto-Detect' ? language : config.language;
        if (targetLang.toLowerCase() !== 'english' && targetLang !== 'Auto-Detect') {
            replyText = await translateReply({
                reply: replyText,
                targetLanguage: targetLang,
                tone: config.tone,
            });
        }

        // 10. Slang injection (if enabled and tone supports it)
        if (config.useLocalSlang && config.tone?.toLowerCase() !== 'professional') {
            const isConfirmed = actions.includes('appointment_created') || actions.includes('order_created');
            if (targetLang.toLowerCase() === 'english') {
                if (isConfirmed) replyText += config.useEmojis ? ' Tekram! 🙏' : ' Tekram!';
            } else if (targetLang.toLowerCase() === 'arabizi') {
                if (isConfirmed && !replyText.includes('Tekram')) replyText += config.useEmojis ? ' Tekram! 🙏' : ' Tekram!';
            }
        }

        // 11. Emoji strip (safety net — if useEmojis is OFF, remove any LLM-added emojis)
        if (!config.useEmojis) {
            replyText = replyText.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu, '').replace(/\s{2,}/g, ' ').trim();
        }

        v2log.info('V3_AGENT', `Agent completed in ${Date.now() - startTime}ms`, {
            steps: result.steps?.length || 0,
            toolCalls: result.steps?.reduce((sum, s) => sum + (s.toolCalls?.length || 0), 0) || 0,
            actions,
            replyPreview: replyText.slice(0, 60),
        });

        return {
            shouldReply: true,
            replyText,
            actions,
            stateBefore: state.stage,
            stateAfter: dbWriteSuccess ? 'idle' : state.stage,
            debug: {
                requestId: '',
                engineVersion: 'v2',
                workspaceId: input.workspaceId,
                workspaceType: config.businessType as 'appointments' | 'ecommerce',
                chatId: input.chatId,
                language,
                intent: actions[0] || 'conversation',
                dbWriteAttempted,
                dbWriteSuccess,
                durationMs: Date.now() - startTime,
            },
        };

    } catch (err: any) {
        v2log.error('V3_AGENT', 'Agent LLM call failed', {
            error: err?.message || String(err),
            model: AGENT_MODEL,
        });
        return makeErrorResult(input, startTime, err?.message || 'Agent call failed');
    }
}

// ── Helpers ──────────────────────────────────────────────────

function makeErrorResult(input: AutomationInput, startTime: number, error: string): AutomationResult {
    return {
        shouldReply: true,
        replyText: "Not available at the moment.",
        actions: ['agent_error'],
        stateBefore: 'idle',
        stateAfter: 'idle',
        debug: makeDebug(input, 'unknown', Date.now() - startTime, 'error'),
        error,
    };
}

function makeDebug(input: AutomationInput, language: string, durationMs: number, intent: string) {
    return {
        requestId: '',
        engineVersion: 'v2' as const,
        workspaceId: input.workspaceId,
        workspaceType: input.workspaceType,
        chatId: input.chatId,
        language: language as any,
        intent,
        dbWriteAttempted: false,
        dbWriteSuccess: false,
        durationMs,
    };
}
