/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — SaaS Support Responder
 * ═══════════════════════════════════════════════════════════════
 * Dedicated, simple responder for the official SaaS support bot.
 *
 * This module is the ONLY brain for workspace_type = 'saas_support'.
 * It does NOT use:
 *   - Ecommerce FSM / order state / inventory search
 *   - Appointment FSM / booking state / service search
 *   - conversation_states table
 *   - [HANDOFF] tokens
 *   - Transactional tools
 *
 * It ONLY:
 *   1. Detects greetings / human-handoff deterministically
 *   2. Fetches public knowledge docs from business_knowledge
 *   3. Injects docs into a simple LLM prompt
 *   4. Returns a short, DM-style answer
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import type { AutomationResult, WorkspaceConfig } from '../types';
import { searchSaasKnowledge } from './knowledge';
import { detectLanguage } from '../language';
import { v2log } from '../logger';

const MODEL = 'llama-3.3-70b-versatile';

function getGroq() {
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    return createGroq({ apiKey: key });
}

// ── Deterministic patterns ──────────────────────────────────

const GREETING_PATTERN = /^(hey|hi|hello|yo|sup|salam|marhaba|hala|ahla|kifak|kifik|bonjour|hola|good\s*(morning|evening|afternoon)|bonsoir)[\s!?.]*$/i;

const HANDOFF_PATTERN = /\b(human|agent|real\s*person|talk\s*to\s*someone|call\s*me|support\s*team|bade\s*e?hke\s*ma3|manager|mwazaf)\b/i;

// ── System prompt ───────────────────────────────────────────

const SAAS_SYSTEM_PROMPT = `You are the official GhostAgent support assistant.
Answer questions about GhostAgent using ONLY the provided knowledge base.
Keep replies short and clear for Instagram/WhatsApp DMs.
If the answer is not in the knowledge base, say you are not sure and offer to connect them with the team.
Do NOT invent pricing, features, or guarantees.
Do NOT output [HANDOFF] or any internal tokens.
Do NOT ask for order details, appointment dates, inventory, or services.
Reply in the same language the user is using.`;

// ── Main entry point ────────────────────────────────────────

export interface SaasResponderInput {
    supabase: SupabaseClient;
    userId: string;
    workspaceId: string;
    chatId: string;
    message: string;
    platform: 'instagram' | 'whatsapp';
    config: WorkspaceConfig;
}

export async function answerSaasSupportMessage(
    input: SaasResponderInput
): Promise<AutomationResult> {
    const startTime = Date.now();
    const detected = detectLanguage(input.message);
    const msg = input.message.trim();

    const makeDebug = (intent?: string, durationMs?: number) => ({
        requestId: crypto.randomUUID(),
        engineVersion: 'v2' as const,
        workspaceId: input.workspaceId,
        workspaceType: 'saas_support' as const,
        chatId: input.chatId,
        language: detected,
        intent,
        dbWriteAttempted: false,
        dbWriteSuccess: false,
        durationMs: durationMs ?? Date.now() - startTime,
    });

    v2log.info('SAAS_RESPONDER', 'Processing message', {
        workspaceId: input.workspaceId,
        chatId: input.chatId,
        platform: input.platform,
        messageLength: msg.length,
    });

    // ── 1. Greeting ─────────────────────────────────────────
    if (GREETING_PATTERN.test(msg)) {
        const reply = detected === 'arabizi' || detected === 'arabic'
            ? 'Hala! Fiyi se3dak b GhostAgent — features, pricing, setup, Instagram, WhatsApp, orders, w appointments. Shu baddak ta3ref?'
            : 'Hey! I can help with GhostAgent features, pricing, setup, Instagram, WhatsApp, orders, and appointments. What would you like to know?';

        v2log.info('SAAS_RESPONDER', 'Greeting detected', {
            chatId: input.chatId,
            reply: reply.slice(0, 60),
        });

        return {
            shouldReply: true,
            replyText: reply,
            actions: ['greeting'],
            stateBefore: 'idle',
            stateAfter: 'idle',
            debug: makeDebug('greeting'),
        };
    }

    // ── 2. Human handoff request ────────────────────────────
    if (HANDOFF_PATTERN.test(msg)) {
        const reply = detected === 'arabizi' || detected === 'arabic'
            ? 'Akid, fiyi waselek bel team. Shu a7san tarika nwaselek fiya?'
            : 'I can connect you with the team. What\'s the best way to reach you?';

        v2log.info('SAAS_RESPONDER', 'Human handoff request', {
            chatId: input.chatId,
        });

        return {
            shouldReply: true,
            replyText: reply,
            actions: ['human_handoff_request'],
            stateBefore: 'idle',
            stateAfter: 'idle',
            debug: makeDebug('human_handoff'),
        };
    }

    // ── 3. Knowledge retrieval ──────────────────────────────
    const knowledgeDocs = await searchSaasKnowledge(
        input.supabase as any,
        input.workspaceId,
        msg
    );

    v2log.info('SAAS_RESPONDER', `Knowledge: ${knowledgeDocs.length} docs`, {
        workspaceId: input.workspaceId,
        query: msg.slice(0, 80),
        resultCount: knowledgeDocs.length,
        matchedTitles: knowledgeDocs.map(d => d.title),
    });

    // ── 4. LLM call with injected knowledge ─────────────────
    const groq = getGroq();
    if (!groq) {
        v2log.error('SAAS_RESPONDER', 'No GROQ_API_KEY');
        return {
            shouldReply: true,
            replyText: 'I\'m having trouble right now. Please try again in a moment.',
            actions: ['error_no_api_key'],
            stateBefore: 'idle',
            stateAfter: 'idle',
            debug: makeDebug('error'),
            error: 'No GROQ_API_KEY',
        };
    }

    // Build knowledge block
    let knowledgeBlock = '';
    if (knowledgeDocs.length > 0) {
        knowledgeBlock = knowledgeDocs.map(d =>
            `<knowledge>\ntitle: ${d.title}\ncontent: ${d.content}\n</knowledge>`
        ).join('\n\n');
    }

    const systemPrompt = knowledgeBlock
        ? `${SAAS_SYSTEM_PROMPT}\n\n${knowledgeBlock}`
        : `${SAAS_SYSTEM_PROMPT}\n\nNo knowledge docs found for this query. Tell the user you're not fully sure and offer to connect them with the team.`;

    try {
        const result = await generateText({
            model: groq(MODEL),
            system: systemPrompt,
            messages: [{ role: 'user', content: msg }],
            temperature: 0.3,
        });

        let reply = result.text?.trim() || '';

        // Safety: strip any [HANDOFF] tokens that the LLM might emit
        reply = reply.replace(/\[HANDOFF\]/gi, '').trim();

        // Safety: if reply is empty after stripping
        if (!reply) {
            reply = detected === 'arabizi' || detected === 'arabic'
                ? 'Ma 3ende ma3loumet kefiye 3an hal mawdou3. Baddak waslek bel team la yse3douk?'
                : 'I\'m not fully sure about that from the docs I have. I can connect you with the team for the exact answer.';
        }

        const fallbackUsed = knowledgeDocs.length === 0;

        v2log.info('SAAS_RESPONDER', 'Reply generated', {
            workspaceId: input.workspaceId,
            chatId: input.chatId,
            platform: input.platform,
            inputMessage: msg.slice(0, 80),
            knowledgeResultCount: knowledgeDocs.length,
            matchedTitles: knowledgeDocs.map(d => d.title),
            finalReply: reply.slice(0, 100),
            fallbackUsed,
        });

        return {
            shouldReply: true,
            replyText: reply,
            actions: fallbackUsed ? ['saas_knowledge_fallback'] : ['saas_knowledge_answer'],
            stateBefore: 'idle',
            stateAfter: 'idle',
            debug: makeDebug('saas_support'),
        };

    } catch (err: any) {
        v2log.error('SAAS_RESPONDER', 'LLM call failed', {
            error: err?.message,
            chatId: input.chatId,
        });

        return {
            shouldReply: true,
            replyText: 'I\'m having trouble right now. Please try again in a moment.',
            actions: ['error_llm_failed'],
            stateBefore: 'idle',
            stateAfter: 'idle',
            debug: makeDebug('error'),
            error: err?.message || 'LLM call failed',
        };
    }
}
