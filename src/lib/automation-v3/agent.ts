import { generateText, stepCountIs, tool } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import type { AutomationInput, AutomationResult, WorkspaceConfig } from '@/lib/automation-v2/types';
import { loadConversationHistory } from '@/lib/automation-v2/history';
import { createAppointmentTools, createEcommerceTools, createSaasSupportTools, type ToolContext } from '@/lib/automation-v2/tools';
import { detectLanguage } from '@/lib/automation-v2/language';
import { buildTimeContext } from '@/lib/automation-v2/time';
import { checkRateLimit } from '@/lib/automation-v2/guardrails/rate-limiter';
import { MetricBuilder, emitMetric } from '@/lib/automation-v2/metrics';
import { v2log } from '@/lib/automation-v2/logger';
import { LEBANESE_VOCABULARY } from '@/lib/automation-v2/dictionaries';

const MODEL = 'llama-3.3-70b-versatile';

function getGroq() {
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    return createGroq({ apiKey: key });
}

function buildPrompt(config: WorkspaceConfig, timeCtx: any, replyLanguage: string): string {
    const isArabizi = replyLanguage === 'arabizi' || replyLanguage === 'lebanese franco';

    const businessDesc = config.businessType === 'appointments'
        ? 'a service-based business that takes appointments'
        : config.businessType === 'saas_support'
            ? 'an official AI representative for GhostAgent, a SaaS platform for AI customer service'
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

    let discountRules = '';
    if (config.maxDiscount && config.maxDiscount > 0) {
        discountRules = `
DISCOUNTS:
- Max discount: ${config.maxDiscount}%${config.minOrderForDiscount ? ` (only on orders above $${config.minOrderForDiscount})` : ''}
- Only offer if they ASK. Never volunteer a discount.
- If they want more than ${config.maxDiscount}%: "Sorry, best price."`;
    } else {
        discountRules = `\nDISCOUNTS: None. Prices are fixed. If they ask: "ekhir se3er" / "final price."`;
    }

    const toolBlock = config.businessType === 'appointments'
        ? `TOOLS:
- You have full access to database tools. Use them to help the customer.
- Use check_slot BEFORE confirming any booking.
- Use lookup_customer to check if they've been here before — skip asking info you already have.
- Use book_appointment ONLY after the customer explicitly confirms the date, time, and service.
- NEVER say "booked" or "confirmed" unless book_appointment returned success.`
        : config.businessType === 'saas_support'
            ? `TOOLS:
- Use search_knowledge for ANY question about GhostAgent pricing, features, or capabilities.
- Use lookup_account to see if the user has an account.
- NEVER make up features or prices. Always search the knowledge base.`
            : `TOOLS:
- You have full access to database tools. You are the orchestrator.
- Use search_products for ANY question about products, prices, or stock.
- Use lookup_customer to check if they've ordered before — skip asking info you already have.
- If you need their address or phone, ask for it naturally. Once you have it, call place_order.
- Use place_order ONLY after the customer explicitly confirms the product and you have their details.
- NEVER say "ordered" or "confirmed" unless place_order returned success.
- Use cancel_order if they want to cancel.`;

    let languageBlock: string;
    if (isArabizi) {
        languageBlock = `
LANGUAGE: Reply in Lebanese Arabizi (Latin letters + numbers like 3, 7, 5, 2).
Use this vocabulary naturally:
${LEBANESE_VOCABULARY}

Examples of good Arabizi replies:
- "Eh mawjoud, 50$"
- "Ma fi hala2"
- "B3atle esmak w ra2mak w l 3nwen"
- "Tmm t2akad el order ✅"`;
    } else if (replyLanguage === 'mixed') {
        languageBlock = `LANGUAGE: Reply in Lebanese Arabizi. Mirror the user's language mix. Use this vocabulary naturally: ${LEBANESE_VOCABULARY}`;
    } else if (replyLanguage === 'unknown') {
        languageBlock = `LANGUAGE: Reply in English.`;
    } else {
        const langName = replyLanguage.charAt(0).toUpperCase() + replyLanguage.slice(1);
        languageBlock = `LANGUAGE: Reply strictly in ${langName}.`;
    }

    const lengthRule = config.businessType === 'saas_support'
        ? 'Reply in 1–3 short DM-style sentences. Be clear, concise, and do not invent facts.'
        : 'Keep replies short and DM-style. 1–3 sentences max. No paragraphs. Be natural, not robotic.';

    return `You are the DM manager of "${config.businessName}", ${businessDesc}.
You're chatting with customers on Instagram/WhatsApp DMs.
Date: ${timeCtx.dayName}, ${timeCtx.isoDate} at ${timeCtx.isoTime}.

RULES:
1. ${lengthRule}
2. ${tone}
3. ${emojiRule}
4. NEVER make up prices, stock, or availability. Use tools to check.
5. Do NOT ask for all information at once like a robot. Ask naturally, one or two things at a time.
6. You are HUMAN. Never say you're an AI or bot.
7. ONLY reply EXACTLY with [HANDOFF] if the user explicitly asks for a human agent.

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
        : config.businessType === 'saas_support'
            ? createSaasSupportTools(toolCtx)
            : createEcommerceTools(toolCtx);
            
    const wrappedTools = Object.fromEntries(
        Object.entries(rawTools).map(([name, def]) => [name, tool(def as any)])
    );

    const system = buildPrompt(config, timeCtx, replyLang);
    const messages: any[] = [
        ...history,
        { role: 'user', content: input.message },
    ];

    const groq = getGroq();
    if (!groq) throw new Error('GROQ_API_KEY is missing');

    try {
        const result = await generateText({
            model: groq(MODEL),
            system,
            messages,
            tools: wrappedTools,
            stopWhen: stepCountIs(5),
            temperature: 0.3,
        });

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
