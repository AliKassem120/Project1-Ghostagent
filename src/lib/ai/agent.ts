import { generateText, stepCountIs, tool } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import type { AutomationInput, AutomationResult, WorkspaceConfig } from '@/lib/ai/types';
import { loadConversationHistory } from '@/lib/ai/history';
import { createAppointmentTools, createEcommerceTools, type ToolContext } from '@/lib/ai/tools';
import { detectLanguage } from '@/lib/ai/language';
import { buildTimeContext } from '@/lib/ai/time';
import { checkRateLimit } from '@/lib/ai/guardrails/rate-limiter';
import { MetricBuilder, emitMetric } from '@/lib/ai/metrics';
import { v2log } from '@/lib/ai/logger';
import { LEBANESE_VOCABULARY, ARABIZI_DICTIONARY } from '@/lib/ai/dictionaries';

const MODEL = 'llama-3.3-70b-versatile';

function getGroq() {
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    return createGroq({ apiKey: key });
}

function buildPrompt(config: WorkspaceConfig, replyLanguage: string, ragExamples: {customer_message: string, owner_reply: string}[] | undefined, platform: 'instagram' | 'whatsapp'): string {
    const isArabizi = replyLanguage === 'arabizi' || replyLanguage === 'lebanese franco';

    const businessDesc = config.businessType === 'appointments'
        ? 'a service-based business that takes appointments'
        : 'an online store that sells products';

    const toneMap: Record<string, string> = {
        'Casual': 'Casual & friendly — like a cool employee texting a friend.',
        'Professional': 'Professional & polished — courteous, precise, zero slang.',
        'Luxury': 'Luxury & premium — elegant, refined, exclusive language.',
        'Sarcastic': 'Sarcastic & witty — helpful but with dry humor. Never rude.',
    };
    const tone = toneMap[config.tone] || toneMap['Professional'];

    const emojiRule = config.useEmojis
        ? 'You may use up to 1 emoji per message, only when it feels natural.'
        : 'Do NOT use any emojis. Zero. No exceptions.';

    const discountRules = config.maxDiscount && config.maxDiscount > 0
        ? `
DISCOUNTS:
- Max discount: ${config.maxDiscount}%${config.minOrderForDiscount ? ` (only on orders above $${config.minOrderForDiscount})` : ''}
- Only offer if they ASK. Never volunteer a discount.
- If they want more than ${config.maxDiscount}%: "Sorry, best price."`
        : `\nDISCOUNTS: None. Prices are fixed. If they ask: "ekhir se3er" / "final price."`;

    const toolBlock = config.businessType === 'appointments'
        ? `TOOLS:
- You have full access to database tools. Use them to help the customer.
- Use check_slot BEFORE confirming any booking.
- Use lookup_customer to check if they've been here before — skip asking info you already have.
- Use book_appointment ONLY after the customer explicitly confirms the date, time, and service.
- NEVER say "booked" or "confirmed" unless book_appointment returned success.
- ALWAYS generate a conversational text reply to the customer after using any tool. Never output just a tool call.
- ${platform === 'whatsapp' ? 'On WhatsApp: Use send_booking_flow ONCE when the customer first expresses interest in booking. After sending the booking button, do NOT call send_booking_flow again. If the user clicks the button (their message will be "📅 Book Now" or "Book Now"), respond in TEXT asking which date and time they prefer — do NOT send the button again.' : 'Ask for date/time manually.'}

CONTEXT RECOVERY:
- If you previously suggested a date/time (e.g. "How about tomorrow?" or "What about 3 PM?") and the customer replies with a confirmation like "yeah", "sure", "ok", "yep", "that works", "sounds good", "perfect" — treat their answer as confirming the date/time YOU proposed. Extract it from YOUR previous message and proceed with the booking.
- Do NOT re-ask for information you already proposed and they confirmed.`
        : `TOOLS:
- You have full access to database tools. You are the orchestrator.
- Use search_products for ANY question about products, prices, or stock.
- Use lookup_customer to check if they've ordered before — skip asking info you already have.
- If you need their address or phone, ask for it naturally. Once you have it, call place_order.
- Use place_order ONLY after the customer explicitly confirms the product and you have their details.
- NEVER say "ordered" or "confirmed" unless place_order returned success.
- Use cancel_order if they want to cancel.
- ${platform === 'whatsapp' ? 'On WhatsApp: Use send_product_card ONCE when the customer asks about a specific product. After sending the product card, do NOT call send_product_card again for the same product. If the user clicks "🛍️ Order Now" or "Order Now", proceed with the order flow in TEXT — ask for their details naturally.' : 'Describe products manually.'}

CONTEXT RECOVERY:
- If you previously suggested something (e.g. a product variant, a delivery option) and the customer replies with a confirmation like "yeah", "sure", "ok", "yep", "that works", "sounds good", "perfect" — treat their answer as confirming what YOU proposed. Extract it from YOUR previous message and proceed.
- Do NOT re-ask for information you already proposed and they confirmed.`;

    let languageBlock: string;
    
    const arabiziPhrases = Object.entries(ARABIZI_DICTIONARY)
        .map(([eng, arabizi]) => `- To say "${eng}" -> say EXACTLY: "${arabizi}"`)
        .join('\n');

    if (isArabizi) {
        languageBlock = `
LANGUAGE: Reply in Lebanese Arabizi (Latin letters + numbers like 3, 7, 5, 2).

VOCABULARY (Word by Word):
${LEBANESE_VOCABULARY}

EXACT PHRASING RULES (MANDATORY):
Do NOT translate word-by-word like a robot. You MUST use these exact sentence structures:
${arabiziPhrases}

When in doubt, keep sentences very short and copy the exact formatting from the rules above.`;
    } else if (replyLanguage === 'mixed') {
        languageBlock = `LANGUAGE: Reply in Lebanese Arabizi. Mirror the user's language mix.\nVOCABULARY:\n${LEBANESE_VOCABULARY}\n\nEXACT PHRASES (Use these exact structures):\n${arabiziPhrases}`;
    } else if (replyLanguage === 'unknown') {
        languageBlock = `LANGUAGE: Reply in English.`;
    } else {
        const langName = replyLanguage.charAt(0).toUpperCase() + replyLanguage.slice(1);
        languageBlock = `LANGUAGE: Reply strictly in ${langName}.`;
    }

    if (ragExamples && ragExamples.length > 0) {
        const ragText = ragExamples.map(e => `Customer: "${e.customer_message}"\nYou: "${e.owner_reply}"`).join('\n\n');
        languageBlock += `\n\nEXACT COMMUNICATION STYLE (RAG TRAINING):\nYou must mimic the exact sentence structure, spelling, and tone of these past examples from the business owner:\n${ragText}`;
    }

    const lengthRule = 'Keep replies short and DM-style. 1–3 sentences max. No paragraphs. Be natural, not robotic.';

    return `You are the DM manager of "${config.businessName}", ${businessDesc}.
You're chatting with a customer on ${platform === 'whatsapp' ? 'WhatsApp' : 'Instagram DMs'}.

RULES:
1. ${lengthRule}
2. ${tone}
3. ${emojiRule}
4. NEVER make up prices, stock, or availability. Use tools to check.
5. Do NOT ask for all information at once like a robot. Ask naturally, one or two things at a time.
6. You are HUMAN. Never say you're an AI or bot.
7. When the customer says something casual like "thank you", "thanks", "ok", "cool", "great", "perfect", "merci", "yalla", "shu", "tamam", or any simple acknowledgment — just reply naturally. Do NOT call any tools or create any bookings/orders. These are NOT requests.
8. ONLY reply EXACTLY with [HANDOFF] if the user explicitly asks for a human agent.

${languageBlock}

${toolBlock}
${discountRules}

${config.systemInstructions ? `BUSINESS INFO:\n${config.systemInstructions}` : ''}
${config.storeLocation ? `LOCATION: ${config.storeLocation}` : ''}
${config.contactInfo ? `CONTACT: ${config.contactInfo}` : ''}
${config.businessType === 'ecommerce' && config.shippingRules ? `SHIPPING: ${config.shippingRules}` : ''}`;
}

export async function runV3Agent(
    input: AutomationInput,
    config: WorkspaceConfig
): Promise<AutomationResult> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    const metrics = new MetricBuilder(input.workspaceId, input.chatId, input.platform);

    const detected = detectLanguage(input.message);
    const replyLang = config.language === 'Auto-Detect' ? detected : config.language.toLowerCase();
    const timeCtx = buildTimeContext(config.timezone);

    // 1. Rate Limiting
    const rateCheck = await checkRateLimit(
        input.supabase, input.workspaceId, input.chatId, input.message, replyLang
    );
    if (!rateCheck.allowed) {
        metrics.setRateLimited();
        await emitMetric(input.supabase, metrics.setState('idle', 'idle').build());
        return {
            shouldReply: !!rateCheck.replyText,
            replyText: rateCheck.replyText || undefined,
            actions: [`rate_limited_${rateCheck.reason}`],
            stateBefore: 'idle', stateAfter: 'idle',
            debug: {
                requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType as any,
                chatId: input.chatId, language: detected, dbWriteAttempted: false, dbWriteSuccess: false,
                intent: 'rate_limited', durationMs: Date.now() - startTime
            }
        };
    }

    // 2. Load History
    const history = await loadConversationHistory(
        input.supabase, input.userId, input.workspaceId, input.chatId
    );

    // 3. Prepare Tools (FULL access)
    const toolCtx: ToolContext = {
        supabase: input.supabase,
        userId: input.userId,
        workspaceId: input.workspaceId,
        chatId: input.chatId,
        config,
        platform: input.platform,
    };
    
    // Convert generic tool objects into AI SDK tool() wrappers
    const rawTools = config.businessType === 'appointments'
        ? createAppointmentTools(toolCtx)
        : createEcommerceTools(toolCtx);
            
    const wrappedTools = Object.fromEntries(
        Object.entries(rawTools).map(([name, def]: [string, any]) => {
            // Support both 'parameters' (V2 style) and 'inputSchema' (V3/V4 style)
            const schema = def.inputSchema || def.parameters;
            return [name, tool({
                ...def,
                parameters: schema // Vercel AI SDK internally might still use 'parameters' in some contexts, but tool() helper handles it
            } as any)];
        })
    );

    // 2.5 Load RAG Examples & Customer details
    const { data: ragExamples } = await input.supabase
        .from('business_training_data')
        .select('customer_message, owner_reply')
        .eq('workspace_id', input.workspaceId)
        .order('created_at', { ascending: false })
        .limit(10);

    const { getCustomerFromStore } = await import('@/lib/ai/customer-store');
    const customer = await getCustomerFromStore(input.supabase, input.workspaceId, input.chatId);

    const system = buildPrompt(config, replyLang, ragExamples || [], input.platform);

    const customerBlock = customer && (customer.name || customer.phone || customer.address)
        ? `\nKNOWN CUSTOMER DETAILS:\n- Name: ${customer.name || 'Unknown'}\n- Phone: ${customer.phone || 'Unknown'}\n- Address: ${customer.address || 'Unknown'}\n(Do NOT ask the customer for their name, phone, or address if you already know it. Skip asking and proceed with checkout/booking directly.)`
        : '';

    const messages: any[] = [
        {
            role: 'system',
            content: `Current context:\nDate: ${timeCtx.dayName}, ${timeCtx.isoDate} at ${timeCtx.isoTime}.${customerBlock}`
        },
        ...history,
        { role: 'user', content: input.message },
    ];

    const groq = getGroq();
    if (!groq) throw new Error('GROQ_API_KEY is missing');

    try {
        let result;
        try {
            result = await generateText({
                model: groq(MODEL),
                system,
                messages,
                tools: wrappedTools,
                stopWhen: stepCountIs(5),
                temperature: 0.3,
            });
        } catch (primaryErr: any) {
            v2log.warn('V3_AGENT', `Primary model ${MODEL} failed, attempting fallback to llama-3.1-70b-versatile`, { error: primaryErr.message });
            result = await generateText({
                model: groq('llama-3.1-70b-versatile'),
                system,
                messages,
                tools: wrappedTools,
                stopWhen: stepCountIs(5),
                temperature: 0.3,
            });
        }

        let reply = result.text?.trim() || '';
        const actions: string[] = [];
        let dbWriteAttempted = false;
        let dbWriteSuccess = false;

        if (reply.includes('[HANDOFF]')) {
            await input.supabase.from('conversation_states').upsert({
                user_id: input.userId,
                workspace_id: input.workspaceId,
                workspace_type: input.workspaceType,
                external_chat_id: input.chatId,
                is_muted: true,
                stage: 'handoff',
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,external_chat_id' });

            try {
                const { createHandoff, determineHandoffPriority } = await import('@/lib/ai/guardrails/handoff-manager');
                const { getKnownCustomerDetails } = await import('@/lib/ai/customer-history');
                const known = await getKnownCustomerDetails(input.supabase, input.workspaceId, input.chatId);
                const recent = history.slice(-5).map(m => ({
                    role: m.role,
                    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
                }));
                const priority = determineHandoffPriority('human_handoff', 0, false);
                await createHandoff(input.supabase, {
                    workspaceId: input.workspaceId,
                    chatId: input.chatId,
                    platform: input.platform,
                    priority,
                    reason: 'human_handoff',
                    conversationSummary: 'Customer requested human agent.',
                    customerName: known?.name || undefined,
                    customerPhone: known?.phone || undefined,
                    recentMessages: recent,
                    currentState: 'idle',
                    actionsTaken: actions
                });
            } catch (e) {
                v2log.warn('AGENT', 'Failed to auto-create handoff queue entry', { error: e });
            }

            return {
                shouldReply: false,
                actions: ['handoff'],
                stateBefore: 'idle', stateAfter: 'handoff',
                debug: {
                    requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType as any,
                    chatId: input.chatId, language: detected, dbWriteAttempted: true, dbWriteSuccess: true,
                    intent: 'handoff', durationMs: Date.now() - startTime
                }
            };
        }

        for (const step of result.steps || []) {
            for (const tr of step.toolResults || []) {
                const toolName = (tr as any).toolName as string;
                const data = (tr as any).result ?? (tr as any).output;
                
                v2log.info('AGENT', `Tool Executed: ${toolName}`, { result: JSON.stringify(data)?.slice(0, 100) });

                if (['book_appointment', 'place_order', 'cancel_appointment', 'cancel_order'].includes(toolName)) {
                    dbWriteAttempted = true;
                    if (data?.success) {
                        dbWriteSuccess = true;
                        actions.push(toolName + '_success');
                        if (toolName === 'place_order') metrics.setOrderCreated();
                        if (toolName === 'book_appointment') metrics.setAppointmentCreated();
                    } else {
                        actions.push(toolName + '_failed');
                    }
                } else {
                    actions.push('tool_' + toolName);
                }
            }
        }

        metrics.addActions(actions).addLlmCall(Date.now() - startTime);
        await emitMetric(input.supabase, metrics.setState('idle', 'idle').build());

        return {
            shouldReply: true,
            replyText: reply,
            actions: actions.length > 0 ? actions : ['llm_reply'],
            stateBefore: 'idle', stateAfter: 'idle',
            debug: {
                requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType as any,
                chatId: input.chatId, language: detected, dbWriteAttempted, dbWriteSuccess,
                intent: actions.length > 0 ? actions[0] : 'conversation', durationMs: Date.now() - startTime
            }
        };

    } catch (error: any) {
        v2log.error('V3_AGENT', 'Agent generation failed', { error: error.message });
        const fallback = replyLang === 'arabizi' ? 'Fi moshkle. Jarreb kamen ba3d shway.' : "I'm having a temporary issue. Please try again.";
        return {
            shouldReply: true, replyText: fallback, actions: ['error_llm_failed'],
            stateBefore: 'idle', stateAfter: 'idle',
            debug: {
                requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType as any,
                chatId: input.chatId, language: detected, dbWriteAttempted: false, dbWriteSuccess: false,
                intent: 'error', durationMs: Date.now() - startTime
            }
        };
    }
}
