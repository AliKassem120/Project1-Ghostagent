/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — V3 Orchestrator
 * ═══════════════════════════════════════════════════════════════
 * Clean main flow controller (~200 lines vs 1828 in decision-engine).
 *
 * Flow: loadSession → checkRateLimit → classifyIntent →
 *       route → generateResponse → validateTransition →
 *       saveSession → emitMetric
 *
 * Opt-in per workspace via `automation_engine_version: 'v3'`.
 * Falls back to v2 decision engine for any unhandled case.
 */

import type { AutomationInput, AutomationResult, WorkspaceConfig } from './types';
import { loadWorkspaceConfig } from './router';
import { loadSession, saveSession, updateLoopTracking, isGreeting } from './session-manager';
import { validateTransition, getLoopMenuMessage, getStateConfig } from './state-validator';
import { classifyIntentV3 } from './classify/intent-classifier-v3';
import { handleDeterministic, handleCancel, detectCancelScope } from './handlers/deterministic';
import { routeToFSM, continueActiveFSM } from './handlers/fsm-router';
import { handlePostContext } from './handlers/post-context';
import { checkRateLimit } from './guardrails/rate-limiter';
import { generateResponse } from './response-generator';
import { MetricBuilder, emitMetric } from './metrics';
import { getTemplate } from './templates';
import { detectLanguage } from './language';
import { classifyIntent } from './classify/intent-classifier';
import { persistFsmResultV3 } from './orchestrator-persist';
import { v2log } from './logger';

// ── V3 Orchestrator ──────────────────────────────────────────

export async function runV3Orchestrator(
    input: AutomationInput,
    config: WorkspaceConfig
): Promise<AutomationResult> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    const metrics = new MetricBuilder(input.workspaceId, input.chatId, input.platform);

    // 1. Language detection
    const detected = detectLanguage(input.message);
    let lang = config.language === 'Auto-Detect' ? detected : config.language.toLowerCase();
    if (lang === 'lebanese franco') lang = 'arabizi';

    // 2. Rate limiting
    const rateCheck = await checkRateLimit(
        input.supabase, input.workspaceId, input.chatId, input.message, lang
    );
    if (!rateCheck.allowed) {
        metrics.setRateLimited();
        await emitMetric(input.supabase, metrics.setState('idle', 'idle').build());
        return buildResult(requestId, input, lang, startTime, {
            shouldReply: !!rateCheck.replyText,
            replyText: rateCheck.replyText || undefined,
            actions: [`rate_limited_${rateCheck.reason}`],
            stateBefore: 'idle', stateAfter: 'idle',
            intent: 'rate_limited',
        });
    }

    // 3. Load session
    const session = await loadSession(
        input.supabase, input.userId, input.workspaceId,
        input.chatId, input.workspaceType, input.platform
    );

    if (session.loadFailed) {
        const reply = getTemplate('error_generic', lang) || "I'm having a temporary issue.";
        metrics.setError('session_load_failed');
        await emitMetric(input.supabase, metrics.setState('idle', 'idle').build());
        return buildResult(requestId, input, lang, startTime, {
            shouldReply: true, replyText: reply,
            actions: ['state_load_failure'], stateBefore: 'idle', stateAfter: 'idle',
            intent: 'error_session',
        });
    }

    metrics.setState(session.state, session.state);

    // 4. Fresh session greeting (stale session recovery)
    if (session.isFreshSession && isGreeting(input.message)) {
        const reply = getTemplate('greeting_fresh', lang) || 'Hey! How can I help?';
        metrics.setTemplate('greeting_fresh').addActions(['fresh_session_greeting']);
        session.lastBotMessage = reply;
        await saveSession(input.supabase, input.userId, input.workspaceId, input.chatId, input.workspaceType, session, input.platform);
        await emitMetric(input.supabase, metrics.build());
        return buildResult(requestId, input, lang, startTime, {
            shouldReply: true, replyText: reply,
            actions: ['fresh_session_greeting'], stateBefore: 'idle', stateAfter: 'idle',
            intent: 'greeting',
        });
    }

    // 3. Global interrupts (handoff, frustration_stop, scoped cancel)
    const interruptCheck = classifyIntent(input.message);
    if (['cancel_order', 'cancel_appointment'].includes(interruptCheck.intent)) {
        const cancelScope = detectCancelScope(input.message);
        const cancelRes = await handleCancel(input, config, lang, cancelScope);
        await saveSession(input.supabase, input.userId, input.workspaceId, input.chatId, input.workspaceType, { ...session, state: 'idle', data: null, lastBotMessage: cancelRes.replyText || 'Cancelled.' }, input.platform);
        metrics.setState(session.state, 'idle').addActions(cancelRes.actions);
        await emitMetric(input.supabase, metrics.build());
        return buildResult(requestId, input, lang, startTime, {
            shouldReply: cancelRes.shouldReply, replyText: cancelRes.replyText,
            actions: cancelRes.actions, stateBefore: session.state, stateAfter: 'idle',
            intent: interruptCheck.intent,
        });
    }
    if (['human_handoff', 'frustration_stop'].includes(interruptCheck.intent)) {
        const det = await handleDeterministic(interruptCheck.intent, input, config, lang, session.postContext);
        if (det.handled && det.fsmResult) {
            await saveSession(input.supabase, input.userId, input.workspaceId, input.chatId, input.workspaceType, { ...session, state: 'idle', data: null, lastBotMessage: det.fsmResult.replyText }, input.platform);
            metrics.setState(session.state, 'idle').addActions(det.fsmResult.actions);
            await emitMetric(input.supabase, metrics.build());
            return buildResult(requestId, input, lang, startTime, {
                shouldReply: det.fsmResult.shouldReply, replyText: det.fsmResult.replyText,
                actions: det.fsmResult.actions, stateBefore: session.state, stateAfter: 'idle',
                intent: interruptCheck.intent,
            });
        }
    }

    // 4. Active FSM continuation (with loop detection)
    if (session.state !== 'idle' && session.state !== 'handoff' && session.data) {
        let fsmResult = await continueActiveFSM(input, config, lang, session.data);

        // Validate transition + loop detection
        const validation = validateTransition(session.state, fsmResult.nextStage, session.loopCount, getStateConfig(session.state), session.stateEnteredAt);
        if (validation.forceMenu) {
            v2log.warn('V3_ORCH', `Loop detected: ${validation.reason}`, { chatId: input.chatId });
            fsmResult = {
                replyText: getLoopMenuMessage(input.workspaceType, lang),
                nextStage: 'idle', nextData: null,
                actions: [...fsmResult.actions, 'loop_detected', 'force_menu'],
                dbWriteAttempted: false, dbWriteSuccess: false, shouldReply: true,
            };
            metrics.setLoop(true, session.loopCount);
        }

        const updatedSession = updateLoopTracking(session, fsmResult.nextStage, fsmResult.replyText);
        updatedSession.data = fsmResult.nextData;
        updatedSession.postContext = fsmResult.postContext || session.postContext;
        updatedSession.state = validation.approvedStage || fsmResult.nextStage;
        updatedSession.lastBotMessage = fsmResult.replyText;

        await saveSession(
            input.supabase, input.userId, input.workspaceId, input.chatId, input.workspaceType,
            updatedSession, input.platform
        );

        metrics.setState(session.state, fsmResult.nextStage).addActions(fsmResult.actions);
        if (fsmResult.actions.includes('order_created')) metrics.setOrderCreated();
        if (fsmResult.actions.includes('appointment_created')) metrics.setAppointmentCreated();
        await emitMetric(input.supabase, metrics.build());

        return buildResult(requestId, input, lang, startTime, {
            shouldReply: fsmResult.shouldReply, replyText: fsmResult.replyText,
            actions: fsmResult.actions, stateBefore: session.state, stateAfter: fsmResult.nextStage,
            intent: session.state, // Continuation of active state
        });
    }

    // 5. Post-context handlers (MUST check before classifier)
    if (session.postContext) {
        const pcResult = await handlePostContext(input, config, lang, session.postContext);
        if (pcResult.handled && pcResult.fsmResult) {
            await persistFsmResultV3(input, pcResult.fsmResult, session.postContext, lang);
            metrics.addActions(pcResult.fsmResult.actions);
            await emitMetric(input.supabase, metrics.setState('idle', pcResult.fsmResult.nextStage).build());
            return buildResult(requestId, input, lang, startTime, {
                shouldReply: pcResult.fsmResult.shouldReply, replyText: pcResult.fsmResult.replyText,
                actions: pcResult.fsmResult.actions, stateBefore: 'idle', stateAfter: pcResult.fsmResult.nextStage,
                intent: 'post_context_resolution',
            });
        }
    }

    // 7. Classify intent (regex → 8b LLM)
    const classifyStart = Date.now();
    const classification = await classifyIntentV3(input.message, input.workspaceType);
    const metricSource = classification.source === 'llm-8b' ? 'llm' : classification.source;
    metrics.setIntent(classification.intent, metricSource as 'regex' | 'llm' | 'template', classification.confidence, Date.now() - classifyStart);

    // 8. Deterministic handler
    const det = await handleDeterministic(classification.intent, input, config, lang, session.postContext);
    if (det.handled && det.fsmResult) {
        metrics.setTemplate(classification.intent).addActions(det.fsmResult.actions);
        await emitMetric(input.supabase, metrics.setState('idle', 'idle').build());
        return buildResult(requestId, input, lang, startTime, {
            shouldReply: det.fsmResult.shouldReply, replyText: det.fsmResult.replyText,
            actions: det.fsmResult.actions, stateBefore: 'idle', stateAfter: det.fsmResult.nextStage,
            intent: classification.intent,
        });
    }

    // 9. FSM entry (purchase/booking intent)
    const fsmEntry = await routeToFSM(classification.intent, input, config, lang, session.postContext);
    if (fsmEntry.handled && fsmEntry.fsmResult) {
        await persistFsmResultV3(input, fsmEntry.fsmResult, session.postContext, lang);
        metrics.addActions(fsmEntry.fsmResult.actions);
        await emitMetric(input.supabase, metrics.setState('idle', fsmEntry.fsmResult.nextStage).build());
        return buildResult(requestId, input, lang, startTime, {
            shouldReply: fsmEntry.fsmResult.shouldReply, replyText: fsmEntry.fsmResult.replyText,
            actions: fsmEntry.fsmResult.actions, stateBefore: 'idle', stateAfter: fsmEntry.fsmResult.nextStage,
            intent: classification.intent,
        });
    }

    // 10. LLM fallback (general conversation)
    const llmStart = Date.now();
    const llmReply = await generateResponse({
        config, language: detected, userMessage: input.message,
        systemInstructions: config.systemInstructions,
    });
    metrics.addLlmCall(Date.now() - llmStart).addActions(['llm_fallback']);
    await emitMetric(input.supabase, metrics.setState('idle', 'idle').build());

    return buildResult(requestId, input, lang, startTime, {
        shouldReply: true, replyText: llmReply,
        actions: ['llm_fallback'], stateBefore: 'idle', stateAfter: 'idle',
        intent: 'general_conversation',
    });
}

// ── Result Builder ───────────────────────────────────────────

function buildResult(
    requestId: string, input: AutomationInput, lang: string, startTime: number,
    partial: { shouldReply: boolean; replyText?: string; actions: string[]; stateBefore: string; stateAfter: string; intent?: string }
): AutomationResult {
    return {
        shouldReply: partial.shouldReply,
        replyText: partial.replyText,
        actions: partial.actions,
        stateBefore: partial.stateBefore as any,
        stateAfter: partial.stateAfter as any,
        debug: {
            requestId,
            engineVersion: 'v2', // Still 'v2' for type compat; actual version tracked in metrics
            workspaceId: input.workspaceId,
            workspaceType: input.workspaceType,
            chatId: input.chatId,
            language: lang as any,
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            intent: partial.intent,
            durationMs: Date.now() - startTime,
        },
    };
}
