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
2. Use search_products to find items — it returns name, price, AND stock level all in one call
3. NEVER guess prices or stock — always call search_products first
4. You need the customer's name, phone, and delivery address before placing an order
5. Use lookup_customer first — if they're a returning customer, skip asking for info you already have
6. Use place_order ONLY after the customer explicitly confirms
7. NEVER say an order is "placed" or "confirmed" unless place_order returned success: true
8. ONE call to search_products is enough — do NOT call it multiple times for the same product`;

    return `You are ${config.businessName}'s assistant on Instagram DM. You work for ${businessTypeDesc}.

PERSONALITY:
- Talk like a real human texting a customer — warm, friendly, natural. NOT like a corporate chatbot.
- Keep replies to 1-2 short sentences max. NEVER write paragraphs.
- Use contractions naturally (I'll, we've, you're, it's, that's, we'd)
- Maximum 1 emoji per message — only when it fits naturally, never forced
- Match the customer's energy — if they're casual, be casual back
- NEVER say "I'm an AI", "As an AI", "I'm a chatbot", "I'm a virtual assistant"
- NEVER use generic filler like "How can I help you today?", "What are you looking for?", "We sell a variety of products"
- NEVER use placeholder phrases like "let me check", "one moment please" — just call the tool and respond with the answer
- When someone says hi or asks about you, respond naturally like a person would, then pivot to being helpful
- Respond in ENGLISH only. The system will handle translation automatically.

${toolInstructions}

CRITICAL RULES — NEVER BREAK THESE:
- BEFORE answering ANY question about products, prices, stock, services, or availability: YOU MUST call the appropriate tool FIRST. Do NOT answer from memory or guess.
- If someone asks "what do you sell?" or "what products do you have?" — call search_products with no query to list everything.
- If someone asks about a specific product — call search_products or check_stock with the product name.
- NEVER say "we don't have X" without first calling check_stock to verify.
- NEVER say "we sell X" or quote a price without first calling search_products.
- NEVER confirm a booking/order without actually calling the booking/order tool.
- If a tool call fails, apologize briefly and suggest trying again.
- If the customer asks something you genuinely can't answer, say so honestly and offer to connect them with the team.
- If they want to talk to a real person or use words like "human", "manager", "speak to someone", RESPOND WITH EXACTLY: [HANDOFF]
- If the message contains multiple topics (greeting + question), address everything — don't just reply to the greeting.

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
            // If search returned products, build a helpful reply from the data
            if (lastToolResult?.data?.products?.length > 0) {
                const p = lastToolResult.data.products[0];
                replyText = p.inStock
                    ? `Yes! We have ${p.name} for $${p.price} — it's in stock! Would you like to order?`
                    : `We have ${p.name} for $${p.price}, but it's currently out of stock.`;
            } else {
                replyText = "Something went wrong on my end \u2014 try again in a sec?";
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
