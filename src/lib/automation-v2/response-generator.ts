/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Response Generator
 * ═══════════════════════════════════════════════════════════════
 * Single LLM text generation function — no tools, no DB access,
 * no state changes. Receives a fully assembled context object
 * and returns a text reply.
 *
 * Used ONLY when templates cannot handle the response
 * (general conversation, complex follow-ups, FAQ).
 */

import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import type { WorkspaceConfig, DetectedLanguage } from './types';
import { buildTimeContext } from './time';
import { LEBANESE_VOCABULARY } from './dictionaries';
import { v2log } from './logger';

// ── Response Context ─────────────────────────────────────────

export interface ResponseContext {
    /** Business config */
    config: WorkspaceConfig;
    /** Detected language */
    language: DetectedLanguage;
    /** The user's message */
    userMessage: string;
    /** Recent conversation history (last 5-10 messages) */
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    /** System instructions from workspace settings */
    systemInstructions?: string | null;
    /** Additional context (product info, order status, etc.) */
    additionalContext?: string;
    /** Max tokens for the response */
    maxTokens?: number;
}

// ── Legacy Prompt Parity Builder ─────────────────────────────

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
    } else if (replyLanguage === 'mixed') {
        languageBlock = `
LANGUAGE: The user is mixing Arabic and Latin scripts.
Reply in Lebanese Arabizi (Latin letters + numbers like 3, 7, 5, 2).
Mirror the user's language mix. If they use Arabic script, you can too.
Use this vocabulary naturally:
${LEBANESE_VOCABULARY}`;
    } else if (replyLanguage === 'unknown') {
        languageBlock = `LANGUAGE: Reply in English.`;
    } else {
        const langName = replyLanguage.charAt(0).toUpperCase() + replyLanguage.slice(1);
        languageBlock = `LANGUAGE: Reply strictly in ${langName}.`;
    }

    const lengthRule = config.businessType === 'saas_support'
        ? 'Reply in 1–3 short DM-style sentences. Be clear, concise, and do not invent facts.'
        : 'Keep replies short and DM-style. 1–3 sentences max. No paragraphs. Be natural, not robotic.';

    const basePrompt = `You are the DM manager of "${config.businessName}", ${businessDesc}.
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

    return basePrompt;
}

// ── Generate Response ────────────────────────────────────────

/**
 * Generate a text response using the LLM.
 * This is the ONLY place LLM text generation happens in v3.
 * No tools, no state changes, no DB writes.
 */
export async function generateResponse(ctx: ResponseContext): Promise<string> {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });
    const timeCtx = buildTimeContext(ctx.config.timezone);

    // Build system prompt using legacy byte-for-byte parity builder
    const systemPromptText = buildPrompt(ctx.config, timeCtx, ctx.language);
    const fullSystemPrompt = [
        systemPromptText,
        ctx.additionalContext || '',
    ].filter(Boolean).join('\n\n');

    // Build messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: fullSystemPrompt },
    ];

    // Add history (last 5 messages)
    if (ctx.history && ctx.history.length > 0) {
        const recent = ctx.history.slice(-5);
        for (const msg of recent) {
            messages.push({ role: msg.role, content: msg.content });
        }
    }

    // Add current message
    messages.push({ role: 'user', content: ctx.userMessage });

    try {
        const startMs = Date.now();
        const result = await generateText({
            model: groq('llama-3.3-70b-versatile'),
            messages,
            maxOutputTokens: ctx.maxTokens || 200,
            temperature: 0.3,
        });

        const durationMs = Date.now() - startMs;
        v2log.info('RESPONSE_GEN', `LLM response generated in ${durationMs}ms`, {
            tokens: result.usage?.totalTokens,
        });

        return result.text || "Sorry, I couldn't generate a response.";
    } catch (error: any) {
        v2log.error('RESPONSE_GEN', 'LLM generation failed', { error: error.message });
        // Fallback to a safe template response
        return ctx.language === 'arabizi' || ctx.language === 'arabic' || ctx.language === 'mixed'
            ? 'Fi moshkle mo2aqate. Jarreb kamen ba3d shway.'
            : "I'm having a temporary issue. Please try again in a moment.";
    }
}
