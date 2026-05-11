/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — The Brain
 * ═══════════════════════════════════════════════════════════════
 * Single LLM call with tool access. Replies in the user's language
 * natively — no translate-after pipeline.
 *
 * Architecture:
 *   1. Load conversation history (last 8 messages)
 *   2. Detect language → build prompt in that language
 *   3. Single LLM call with tools
 *   4. Post-process (emoji strip, slang injection)
 */

import { generateText, stepCountIs } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import type { AutomationInput, AutomationResult, WorkspaceConfig } from './types';
import { loadConversationHistory } from './history';
import { createAppointmentToolsReadOnly, createEcommerceToolsReadOnly, TRANSACTIONAL_TOOL_NAMES, type ToolContext } from './tools';
import { detectLanguage } from './language';
import { buildTimeContext } from './time';
import { v2log } from './logger';
import { LEBANESE_VOCABULARY } from './dictionaries';
import { validateReply } from './validation/reply-validator';
import { guardFinalReply, safeErrorReply } from './validation/final-reply-guard';
import { classifyIntent } from './classify/intent-classifier';

// ── Model ────────────────────────────────────────────────────

const MODEL = 'llama-3.3-70b-versatile';

const TRANSACTIONAL_INTENTS = new Set([
    'purchase_intent',
    'booking_intent',
    'cancel_order',
    'cancel_appointment',
    'modify_order',
    'modify_appointment',
    'reschedule_appointment',
]);

function getGroq() {
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    return createGroq({ apiKey: key });
}

// ── Prompt Builder ───────────────────────────────────────────

function buildPrompt(
    config: WorkspaceConfig,
    timeCtx: any,
    replyLanguage: string
): string {
    const isArabizi = replyLanguage === 'arabizi' || replyLanguage === 'lebanese franco';

    const businessDesc = config.businessType === 'appointments'
        ? 'a service-based business that takes appointments'
        : config.businessType === 'saas_support'
            ? 'an official AI representative for GhostAgent, a SaaS platform for AI customer service'
            : 'an online store that sells products';

    // ── Tone ─────────────────────────────────────────────────
    const toneMap: Record<string, string> = {
        'Casual': 'Casual & friendly — like a cool employee texting a friend.',
        'Professional': 'Professional & polished — courteous, precise, zero slang.',
        'Luxury': 'Luxury & premium — elegant, refined, exclusive language.',
        'Sarcastic': 'Sarcastic & witty — helpful but with dry humor. Never rude.',
    };
    const tone = toneMap[config.tone] || toneMap['Professional'];

    // ── Emoji ────────────────────────────────────────────────
    const emojiRule = config.useEmojis
        ? 'You may use up to 1 emoji per message, only when it feels natural.'
        : 'Do NOT use any emojis. Zero. No exceptions.';

    // ── Discount ─────────────────────────────────────────────
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

    // ── Tool instructions ────────────────────────────────────
    const toolBlock = config.businessType === 'appointments'
        ? `TOOLS:
- Use check_slot BEFORE confirming any booking.
- Use lookup_customer to check if they've been here before — skip asking info you already have.
- Use book_appointment ONLY after the customer explicitly confirms.
- NEVER say "booked" or "confirmed" unless book_appointment returned success.`
        : config.businessType === 'saas_support'
            ? `TOOLS:
- Use search_knowledge for ANY question about GhostAgent pricing, features, or capabilities.
- Use lookup_account to see if the user has an account.
- NEVER make up features or prices. Always search the knowledge base.
- If you cannot find the information in the knowledge base, say you are not sure and offer to connect them with a human team member.`
            : `TOOLS:
- Use search_products for ANY question about products, prices, or stock.
- IMPORTANT: Even casual statements like "I saw the [Product]" or "Do you have it in black?" mean you MUST use search_products first. Read available colors, sizes, prices, and stock from the result.
- Use lookup_customer to check if they've ordered before — skip asking info you already have.
- Use place_order ONLY after the customer explicitly confirms.
- NEVER say "ordered" or "confirmed" unless place_order returned success.
- Use get_business_hours when they ask about working hours.
- Use cancel_order if they want to cancel.`;

    // ── Language block ───────────────────────────────────────
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
- "Tmm t2akad el order ✅"
- "Hala! Kif fiye se3dak?"`;
    } else if (replyLanguage === 'unknown' || replyLanguage === 'mixed') {
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
4. NEVER echo back what the customer just said.
5. NEVER make up prices, stock, or availability. Use tools to check.
6. For greetings (hey, hi, salam, kifak, hello): reply naturally with a warm, short greeting. No tools needed.
7. For small talk (how are you, what's up, wsh, etc.): respond like a human — briefly and naturally (e.g. "Good thanks! How can I help you today?"). Don't just repeat "how can I help".
8. ONLY reply EXACTLY with [HANDOFF] if the user explicitly asks for a human agent (e.g. "talk to agent", "speak to someone"). Do NOT use [HANDOFF] just because you don't know the answer.
9. You are HUMAN. Never say you're an AI or bot.
10. NEVER retry or re-attempt a tool call that already failed in the conversation history. Answer the CURRENT question only.
11. If a customer says something off-topic or unexpected, respond naturally and briefly — use your judgment. Don't be robotic about it.
12. If you cannot find a product or service, say so naturally and ask if they meant something else. Never leave a blank reply.

${languageBlock}

${toolBlock}
${discountRules}

${config.systemInstructions ? `BUSINESS INFO:\n${config.systemInstructions}` : ''}
${config.storeLocation ? `LOCATION: ${config.storeLocation}` : ''}
${config.contactInfo ? `CONTACT: ${config.contactInfo}` : ''}
${config.businessType === 'ecommerce' && config.shippingRules ? `SHIPPING: ${config.shippingRules}` : ''}`;
}

// ── Determine reply language ─────────────────────────────────

function resolveReplyLanguage(config: WorkspaceConfig, detected: string): string {
    if (config.language === 'Auto-Detect') return detected;
    const lang = config.language.toLowerCase();
    // 'Lebanese Franco' → 'arabizi' for consistent internal handling
    if (lang === 'lebanese franco') return 'arabizi';
    return lang;
}

// ── Main Agent ───────────────────────────────────────────────

export async function runAgent(
    input: AutomationInput,
    config: WorkspaceConfig
): Promise<AutomationResult> {
    const startTime = Date.now();
    const detected = detectLanguage(input.message);
    const replyLang = resolveReplyLanguage(config, detected);
    const timeCtx = buildTimeContext(config.timezone);

    // ── DECISION ENGINE (State before classifier) ────────────
    // If there's an active conversation state, or a clear booking/purchase
    // intent is detected, the FSM handles it deterministically.
    const { runDecisionEngine } = await import('./decision-engine');
    const decision = await runDecisionEngine(input, config);

    if (decision.handledByFSM && decision.fsmResult) {
        const fsm = decision.fsmResult;
        v2log.info('AGENT', `FSM handled: ${decision.stateBefore} → ${decision.stateAfter}`, {
            actions: fsm.actions,
            replyPreview: fsm.replyText?.slice(0, 60),
        });

        // Validate FSM reply before returning
        let finalReply = fsm.replyText;
        if (finalReply) {
            const validation = validateReply(finalReply, {
                isConfirmed: fsm.dbWriteSuccess,
                language: replyLang,
            });
            if (!validation.isValid) {
                v2log.warn('AGENT', `FSM reply validation failed: ${validation.reason}`, { reply: finalReply });
                finalReply = validation.repaired || finalReply;
            }
        }

        return {
            shouldReply: fsm.shouldReply,
            replyText: finalReply,
            actions: fsm.actions,
            stateBefore: decision.stateBefore,
            stateAfter: decision.stateAfter,
            debug: {
                requestId: '',
                engineVersion: 'v2',
                workspaceId: input.workspaceId,
                workspaceType: config.businessType as 'appointments' | 'ecommerce',
                chatId: input.chatId,
                language: detected,
                intent: decision.classifiedIntent || fsm.actions[0] || 'fsm_continuation',
                dbWriteAttempted: fsm.dbWriteAttempted,
                dbWriteSuccess: fsm.dbWriteSuccess,
                durationMs: Date.now() - startTime,
                classifierSource: decision.classifierSource,
                classifierConfidence: decision.classifierConfidence,
                classifierResult: decision.classifierResult,
            },
            cancelMeta: fsm.cancelMeta,
        };
    }

    // ── LLM PATH (General conversation, FAQs, tool-based queries) ──
    // Only reached when state is idle and no clear booking/purchase intent.

    // 1. History
    const history = await loadConversationHistory(
        input.supabase, input.userId, input.workspaceId, input.chatId
    );

    // 2. System prompt
    // NOTE: saas_support is handled by the dedicated responder in router.ts
    //       and never reaches this agent.
    const system = buildPrompt(config, timeCtx, replyLang);

    // 3. Messages
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
        ...history,
        { role: 'user' as const, content: input.message },
    ];

    // 4. Tools — READ-ONLY: no transactional tools in fallback LLM agent
    //    All transactional actions (orders, bookings, cancellations) go through
    //    deterministic handlers/FSM only. The fallback agent can only answer
    //    non-transactional questions (product info, hours, location, policy).
    const toolCtx: ToolContext = {
        supabase: input.supabase,
        userId: input.userId,
        workspaceId: input.workspaceId,
        chatId: input.chatId,
        config,
        platform: input.platform,
    };
    const tools = config.businessType === 'appointments'
        ? createAppointmentToolsReadOnly(toolCtx)
        : createEcommerceToolsReadOnly(toolCtx);

    // 5. LLM call
    const groq = getGroq();
    if (!groq) {
        v2log.error('AGENT', 'No GROQ_API_KEY');
        return errorResult(input, startTime, 'No API key');
    }

    try {
        const result = await generateText({
            model: groq(MODEL),
            system,
            messages,
            tools: tools as any,
            stopWhen: stepCountIs(6),
            temperature: 0.3,
        });

        let reply = result.text?.trim() || '';

        // ── Handoff ──────────────────────────────────────────
        if (reply.includes('[HANDOFF]')) {
            return {
                shouldReply: false,
                actions: ['handoff'],
                stateBefore: 'idle',
                stateAfter: 'handoff',
                debug: makeDebug(input, detected, Date.now() - startTime, 'handoff'),
            };
        }

        // ── Parse tool results ───────────────────────────────
        const actions: string[] = [];
        let dbWriteAttempted = false;
        let dbWriteSuccess = false;
        let lastToolResult: any = null;

        for (const step of result.steps || []) {
            for (const tr of step.toolResults || []) {
                const toolName = (tr as any).toolName as string;
                const data = (tr as any).result ?? (tr as any).output;
                lastToolResult = { toolName, data };

                v2log.info('AGENT', `Tool: ${toolName}`, {
                    result: JSON.stringify(data)?.slice(0, 200),
                });

                if (toolName === 'book_appointment' || toolName === 'place_order') {
                    dbWriteAttempted = true;
                    if (data?.success) {
                        dbWriteSuccess = true;
                        actions.push(toolName === 'book_appointment' ? 'appointment_created' : 'order_created');
                    } else {
                        actions.push(toolName === 'book_appointment' ? 'appointment_failed' : 'order_failed');
                    }
                } else if (toolName === 'cancel_appointment' || toolName === 'cancel_order') {
                    dbWriteAttempted = true;
                    if (data?.success) {
                        dbWriteSuccess = true;
                        actions.push('cancelled');
                    } else {
                        actions.push(toolName === 'cancel_appointment' ? 'appointment_cancel_failed' : 'order_cancel_failed');
                    }
                } else if (toolName === 'lookup_customer' && data?.found) {
                    actions.push('memory_used');
                } else {
                    actions.push('tool_' + toolName);
                }
            }
        }

        // ── Fallback if LLM returned no text ─────────────────
        if (!reply) {
            if (lastToolResult?.toolName === 'search_products') {
                const products = lastToolResult.data?.products;
                if (products?.length > 0) {
                    const p = products[0];
                    reply = replyLang === 'arabizi'
                        ? (p.inStock ? `${p.name} — $${p.price}, mawjoud.` : `${p.name} — ma fi halla2.`)
                        : (p.inStock ? `${p.name} — $${p.price}, in stock.` : `${p.name} — out of stock.`);
                } else {
                    reply = replyLang === 'arabizi'
                        ? '3am dawar 3aleya bas mish mabyane 3ande. Baddak shi tene?'
                        : "I'm looking for that right now, but I'm not seeing it in our current catalog. Did you mean a different item, or do you have a specific SKU?";
                }
            } else if (lastToolResult?.toolName === 'search_knowledge') {
                const results = lastToolResult.data?.results;
                if (results?.length > 0) {
                    reply = replyLang === 'arabizi' ? 'Fik tshufo hon, aw is2alni shu baddak' : 'I found some information. How can I help?';
                } else {
                    reply = replyLang === 'arabizi' ? 'Ma 3ende fekra 3an hek' : 'I don\'t have information on that right now.';
                }
            } else {
                // Generic fallback — do NOT treat short messages as greetings
                reply = replyLang === 'arabizi' ? 'Kif fiyi se3dak?' : 'How can I help?';
            }
        }

        // ── Emoji strip (safety net) ─────────────────────────
        if (!config.useEmojis) {
            reply = reply.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu, '').replace(/\s{2,}/g, ' ').trim();
        }

        // ── Strip leaked function-call XML tags ─────────────────
        // Some models inline tool calls as <function=name></function> text.
        // Strip these before sending to the customer.
        reply = reply.replace(/<function=[^>]*>[\s\S]*?<\/function>/g, '').replace(/\s{2,}/g, ' ').trim();

        // ── Confirmation safety net ──────────────────────────
        // Block "confirmed/booked/placed" words if DB write didn't succeed
        if (!dbWriteSuccess) {
            const lower = reply.toLowerCase();
            const confirmWords = ['confirmed', 'booked', 'scheduled', 'placed', 't2akad', 't2akkad'];
            if (confirmWords.some(w => lower.includes(w))) {
                v2log.warn('AGENT', 'Blocked false confirmation', { reply });
                reply = safeErrorReply(replyLang);
            }
        }

        // ── Reply validator (final safety net) ────────────────
        const validation = validateReply(reply, {
            isConfirmed: dbWriteSuccess,
            language: replyLang,
        });
        if (!validation.isValid) {
            v2log.warn('AGENT', `LLM reply validation failed: ${validation.reason}`, { reply });
            reply = validation.repaired || reply;
        }

        v2log.info('AGENT', `Done in ${Date.now() - startTime}ms`, {
            steps: result.steps?.length || 0,
            actions,
            replyPreview: reply.slice(0, 60),
        });

        return {
            shouldReply: true,
            replyText: reply,
            actions,
            stateBefore: 'idle',
            stateAfter: dbWriteSuccess ? 'idle' : 'idle',
            debug: {
                requestId: '',
                engineVersion: 'v2',
                workspaceId: input.workspaceId,
                workspaceType: config.businessType as 'appointments' | 'ecommerce',
                chatId: input.chatId,
                language: detected,
                intent: actions[0] || 'conversation',
                dbWriteAttempted,
                dbWriteSuccess,
                durationMs: Date.now() - startTime,
            },
        };

    } catch (err: any) {
        const errMsg = err?.message || String(err);
        v2log.error('AGENT', 'LLM call failed', { error: errMsg });

        // ── Retry WITHOUT tools if it was a function-calling failure ──
        // Groq/Llama sometimes fails on tool schemas. Fall back to a
        // plain conversation so the customer isn't left hanging.
        if (errMsg.includes('function') || errMsg.includes('tool') || errMsg.includes('failed_generation')) {
            const intent = classifyIntent(input.message).intent;
            if (TRANSACTIONAL_INTENTS.has(intent)) {
                v2log.warn('AGENT', 'Blocked retry without tools for transactional intent', { intent });
                return {
                    shouldReply: true,
                    replyText: safeErrorReply(replyLang),
                    actions: ['agent_retry_no_tools_blocked_transactional'],
                    stateBefore: 'idle',
                    stateAfter: 'idle',
                    debug: makeDebug(input, detected, Date.now() - startTime, intent),
                };
            }

            try {
                v2log.info('AGENT', 'Retrying without tools...');
                const retryResult = await generateText({
                    model: groq!(MODEL),
                    system: system + '\n\nIMPORTANT: You have no tools available right now. Answer using only the business info above. If you don\'t know something, say so honestly.',
                    messages,
                    temperature: 0.3,
                });

                let retryReply = retryResult.text?.trim();
                if (retryReply) {
                    const guarded = guardFinalReply({
                        replyText: retryReply,
                        language: replyLang,
                        dbWriteAttempted: false,
                        dbWriteSuccess: false,
                        actionType: 'retry_without_tools',
                        sourcePath: 'agent_retry_without_tools',
                    });
                    if (!guarded.shouldReply) {
                        return {
                            shouldReply: false,
                            actions: ['agent_retry_no_tools', ...guarded.actionsToAdd],
                            stateBefore: 'idle',
                            stateAfter: 'handoff',
                            debug: makeDebug(input, detected, Date.now() - startTime, guarded.blockedReason || 'handoff'),
                        };
                    }
                    retryReply = guarded.replyText || '';
                    const validation = validateReply(retryReply, {
                        isConfirmed: false,
                        language: replyLang,
                    });
                    if (!validation.isValid) {
                        retryReply = validation.repaired || safeErrorReply(replyLang);
                    }
                    v2log.info('AGENT', `Retry succeeded in ${Date.now() - startTime}ms`, {
                        replyPreview: retryReply.slice(0, 60),
                    });
                    return {
                        shouldReply: true,
                        replyText: retryReply,
                        actions: ['agent_retry_no_tools'],
                        stateBefore: 'idle',
                        stateAfter: 'idle',
                        debug: makeDebug(input, detected, Date.now() - startTime, 'conversation'),
                    };
                }
            } catch (retryErr: any) {
                v2log.error('AGENT', 'Retry also failed', { error: retryErr?.message });
            }
        }

        return errorResult(input, startTime, errMsg);
    }
}

// ── Helpers ──────────────────────────────────────────────────

function errorResult(input: AutomationInput, startTime: number, error: string): AutomationResult {
    return {
        shouldReply: true,
        replyText: "I'm looking for that right now, but I'm not seeing it in our current catalog. Did you mean a different item, or do you have a specific SKU?",
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
