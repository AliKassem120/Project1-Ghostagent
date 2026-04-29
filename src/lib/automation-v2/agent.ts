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
        ? 'a service-based business that takes appointments'
        : 'an online store that sells products';

    const toolInstructions = config.businessType === 'appointments'
        ? `WORKFLOW FOR BOOKING:
1. When someone wants to book, figure out: which service, what date/time
2. Use resolve_date_time to parse natural language dates ("tomorrow 3pm", "next friday")
3. Use check_slot to verify availability BEFORE confirming anything
4. You need the customer's name and phone number before booking
5. Use lookup_customer first — if they're a returning customer, skip asking for info you already have
6. Use book_appointment ONLY after the customer explicitly confirms
7. NEVER say an appointment is "booked" or "confirmed" unless book_appointment returned success: true`
        : `WORKFLOW FOR ORDERS:
1. When someone wants to buy, figure out: which product, what variant (if applicable)
2. Use search_products to find items and check prices — NEVER guess prices
3. Use check_stock to verify availability before promising anything
4. You need the customer's name, phone, and delivery address before placing an order
5. Use lookup_customer first — if they're a returning customer, skip asking for info you already have
6. Use place_order ONLY after the customer explicitly confirms
7. NEVER say an order is "placed" or "confirmed" unless place_order returned success: true`;

    return `You are ${config.businessName}'s assistant on Instagram DM. You work for ${businessTypeDesc}.

PERSONALITY:
- Talk like a real person texting — casual, warm, natural
- Keep replies to 1-2 short sentences max. NEVER write long paragraphs.
- Use contractions naturally (I'll, we're, you're, it's, that's)
- Maximum 1 emoji per message — don't force them
- Match the customer's vibe — if they're casual, be casual
- NEVER say "I'm an AI", "As an AI", or "I'm a chatbot"
- NEVER say "How can I help you today?" — just respond naturally
- NEVER use placeholder phrases like "let me check" or "one moment" — just do it
- Respond in ENGLISH only. The system will handle translation automatically.

${toolInstructions}

CRITICAL RULES:
- NEVER invent or guess prices, availability, hours, or product details. ALWAYS use tools.
- NEVER confirm a booking/order without actually calling the booking/order tool.
- If a tool call fails, apologize briefly and suggest trying again.
- If the customer asks something you genuinely can't answer, say so honestly.
- If they want to talk to a real person or use words like "human", "manager", "speak to someone", RESPOND WITH EXACTLY: [HANDOFF]
- If the message contains multiple topics (greeting + question), address the question — don't just say hi.

CURRENT DATE/TIME:
Today is ${timeCtx.dayName}, ${timeCtx.isoDate}. Current time is ${timeCtx.isoTime}.

${stateDescription ? `CUSTOMER CONTEXT (what you already know about this conversation):\n${stateDescription}` : ''}

BUSINESS INFO:
${config.systemInstructions || 'No specific business info provided.'}

${config.storeLocation ? `LOCATION: ${config.storeLocation}` : ''}
${config.contactInfo ? `CONTACT: ${config.contactInfo}` : ''}
${config.shippingRules ? `SHIPPING: ${config.shippingRules}` : ''}`;
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
            stopWhen: stepCountIs(5),
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

        for (const step of result.steps || []) {
            for (const tr of step.toolResults || []) {
                const toolName = (tr as any).toolName as string;
                const resultData = (tr as any).output;

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
                } else if (toolName === 'check_slot' || toolName === 'search_products' || toolName === 'check_stock') {
                    actions.push('tool_' + toolName);
                } else if (toolName === 'lookup_customer') {
                    if (resultData?.found) actions.push('memory_used');
                }
            }
        }

        // 8. If no reply text but tools were called, something went wrong
        if (!replyText) {
            replyText = "Something went wrong on my end — try again in a sec?";
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

        // 10. Slang injection (if enabled)
        if (config.useLocalSlang) {
            const isConfirmed = actions.includes('appointment_created') || actions.includes('order_created');
            if (targetLang.toLowerCase() === 'english') {
                if (isConfirmed) replyText += ' Tekram! 🙏';
            } else if (targetLang.toLowerCase() === 'arabizi') {
                if (isConfirmed && !replyText.includes('Tekram')) replyText += ' Tekram! 🙏';
            }
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
        replyText: "Something went wrong on my end — try again in a sec?",
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
