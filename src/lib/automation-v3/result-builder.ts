import type { AutomationInput, AutomationResult, WorkspaceConfig } from '@/lib/ai/types';
import type { SessionData, SessionContext, FsmResult } from './types';
import { validateTransition } from '@/lib/ai/state-validator';
import { generateResponse } from './response-generator';
import { saveSession } from './session-manager';
import { emitMetric, MetricBuilder } from '@/lib/ai/metrics';
import { buildPrompt } from './prompt-builder';
import { checkVoiceConsistency } from './voice-consistency-guard';
import { v2log } from '@/lib/ai/logger';
import { verifyAgentReply } from '@/lib/ai/guardrails/reply-verifier';
import { alertDbWriteFailure } from '@/lib/ai/guardrails/db-write-alerting';

export interface FsmMappingContext {
  fsmRes: FsmResult;
  stateBefore: string;
  session: SessionContext;
  history: Array<{ role: 'user' | 'assistant'; content: string | any }>;
  input: AutomationInput;
  config: WorkspaceConfig;
  replyLang: string;
  timeCtx: { dayName: string; isoDate: string; isoTime: string };
  activeServices?: any[];
  activeProducts?: any[];
  recentSummaries?: string[];
  customerNotes?: string[];
  emotionBlock?: string;
  proactiveBlock?: string;
  crossChannelNote?: string;
  metrics: MetricBuilder;
  startTime: number;
  requestId: string;
  detected: string;
  returnHandoff: (reply: string, actionsList: string[]) => Promise<AutomationResult>;
}

export async function runFSMAndGenerateResponse(ctx: FsmMappingContext): Promise<AutomationResult> {
  const {
    fsmRes, stateBefore, session, history, input, config, replyLang,
    timeCtx, activeServices, activeProducts, recentSummaries, customerNotes,
    emotionBlock, proactiveBlock, crossChannelNote, metrics, startTime, requestId,
    detected, returnHandoff
  } = ctx;

  const validation = validateTransition(stateBefore, fsmRes.nextState as any, session.loopCount, session.stateEnteredAt);
  let finalState = validation.approvedStage;
  let loopCount = validation.resetLoop ? 0 : (fsmRes.nextState === stateBefore ? session.loopCount + 1 : 0);

  v2log.info('PIPELINE', 'FSM_EVALUATED', {
    userId: input.userId, currentState: fsmRes.nextState, collectedData: Object.keys(session.data || {})
  });

  if (validation.forceMenu) {
    // FIX: Reset state to idle but PRESERVE session.data so the LLM can reference
    // existing order context (product, customer details). Generate a contextual reply
    // via the LLM instead of a hardcoded generic greeting.
    session.state = 'idle';
    session.loopCount = 0;
    session.lastBotMessage = null;
    session.stateEnteredAt = new Date().toISOString();
    // NOTE: session.data is intentionally NOT wiped — it contains order context

    const systemPrompt = buildPrompt(
      config,
      replyLang,
      [],
      input.platform,
      true,
      activeServices || activeProducts,
      recentSummaries,
      session,
      customerNotes,
      emotionBlock,
      proactiveBlock,
      crossChannelNote,
      config.language
    );

    const responseGenResult = await generateResponse({
      systemInstruction: systemPrompt,
      conversationHistory: history.map(h => ({
        role: h.role as 'user' | 'assistant',
        content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content)
      })).concat([{ role: 'user', content: input.message }]),
      currentState: 'idle',
      customerProfile: session.customerProfile,
      toolResults: [],
      requiredLanguageScript: replyLang as any,
      channel: input.platform,
      strategy: null,
      workspaceConfig: config,
      timeContext: {
        dayName: timeCtx.dayName,
        isoDate: timeCtx.isoDate,
        isoTime: timeCtx.isoTime
      },
    });

    let reply = responseGenResult.text;
    v2log.info('PIPELINE', 'RESPONSE_GENERATED', {
      userId: input.userId, replyLength: reply.length
    });
    const voiceCheck = checkVoiceConsistency(reply, config, []);
    v2log.info('PIPELINE', 'VOICE_GUARD_RESULT', {
      userId: input.userId, passed: voiceCheck.approved, adjustments: voiceCheck.violations?.length || 0
    });
    if (!voiceCheck.approved && voiceCheck.correctedText) {
      reply = voiceCheck.correctedText;
    }

    if (reply.includes('[HANDOFF]')) {
      return await returnHandoff(reply, [...fsmRes.actions, 'force_menu_reset']);
    }

    session.lastBotMessage = reply;
    await saveSession(input.supabase, session, config.businessType);
    v2log.info('PIPELINE', 'SESSION_SAVED', {
      userId: input.userId, newFsmState: 'idle'
    });

    return {
      shouldReply: true,
      replyText: reply,
      actions: [...fsmRes.actions, 'force_menu_reset', 'llm_contextual_reply'],
      stateBefore: stateBefore as any,
      stateAfter: 'idle',
      debug: {
        requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType,
        chatId: input.chatId, language: detected as any, automationEngineVersion: config.automationEngineVersion,
        dbWriteAttempted: false, dbWriteSuccess: false,
        intent: 'force_menu_reset', durationMs: Date.now() - startTime
      }
    };
  }

  session.state = finalState;
  session.loopCount = loopCount;

  const systemPrompt = buildPrompt(
    config,
    replyLang,
    [],
    input.platform,
    true, // skipTools
    activeServices || activeProducts,
    recentSummaries,
    session,
    customerNotes,
    emotionBlock,
    proactiveBlock,
    crossChannelNote,
    config.language
  );

  const responseGenResult = await generateResponse({
    systemInstruction: systemPrompt,
    conversationHistory: history.map(h => ({
      role: h.role as 'user' | 'assistant',
      content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content)
    })).concat([{ role: 'user', content: input.message }]),
    currentState: session.state,
    customerProfile: session.customerProfile,
    toolResults: [],
    requiredLanguageScript: replyLang as any,
    channel: input.platform,
    strategy: null,
    workspaceConfig: config,
    timeContext: {
      dayName: timeCtx.dayName,
      isoDate: timeCtx.isoDate,
      isoTime: timeCtx.isoTime
    },
    fsmContext: fsmRes.context ? {
      actionType: fsmRes.context.actionType,
      payload: {
        ...fsmRes.context.payload,
        serviceName: fsmRes.context.payload?.serviceName || fsmRes.context.payload?.service,
      }
    } : undefined
  });

  let reply = responseGenResult.text;
  v2log.info('PIPELINE', 'RESPONSE_GENERATED', {
    userId: input.userId, replyLength: reply.length
  });
  const voiceCheck = checkVoiceConsistency(reply, config, []);
  v2log.info('PIPELINE', 'VOICE_GUARD_RESULT', {
    userId: input.userId, passed: voiceCheck.approved, adjustments: voiceCheck.violations?.length || 0
  });
  if (!voiceCheck.approved && voiceCheck.correctedText) {
    reply = voiceCheck.correctedText;
  }

  // Run Reply Verifier: catch FSM hallucinations before sending
  try {
    const verifierItems = activeServices?.map((s: any) => ({ name: s.name, price: s.price, durationMinutes: s.durationMinutes })) ||
      activeProducts?.map((p: any) => ({ name: p.itemName, price: p.price, stockLevel: p.stockLevel })) || [];
    const verifyResult = verifyAgentReply(
      reply,
      fsmRes.actions,
      verifierItems,
      config.businessType,
      Boolean(fsmRes.context?.payload?.success),
      Boolean(fsmRes.context?.payload?.success),
      replyLang
    );
    if (!verifyResult.verified) {
      v2log.warn('ORCHESTRATOR', 'Reply Verifier corrected FSM reply', { violations: verifyResult.violations });
      reply = verifyResult.correctedReply;
    }
  } catch (_e) { /* verifier is non-critical */ }

  const responseActions = [...fsmRes.actions];
  if (!responseActions.includes('v3_brain_reply')) responseActions.push('v3_brain_reply');
  if (!responseActions.includes('llm_reply')) responseActions.push('llm_reply');

  if (reply.includes('[HANDOFF]') || finalState === 'handoff') {
    return await returnHandoff(reply, responseActions);
  }

  session.lastBotMessage = reply;
  session.stateEnteredAt = new Date().toISOString();

  await saveSession(input.supabase, session, config.businessType);
  v2log.info('PIPELINE', 'SESSION_SAVED', {
    userId: input.userId, newFsmState: finalState
  });

  // Save metrics
  metrics.addActions(fsmRes.actions).addLlmCall(0);
  if (fsmRes.dbWriteSuccess) {
    if (config.businessType === 'ecommerce') metrics.setOrderCreated();
    if (config.businessType === 'appointments') metrics.setAppointmentCreated();
  }
  await emitMetric(input.supabase, metrics.setState(stateBefore, finalState).build());

  // Alert on DB write failures (was only in worker, now also fires from webhook path)
  if (fsmRes.dbWriteAttempted && !fsmRes.dbWriteSuccess) {
    alertDbWriteFailure(input.supabase, {
      workspaceId: input.workspaceId,
      chatId: input.chatId,
      platform: input.platform,
      businessType: config.businessType,
      stateBefore,
      stateAfter: finalState,
      actions: fsmRes.actions,
      requestId,
    }).catch(() => {});
  }

  return {
    shouldReply: true,
    replyText: reply,
    actions: responseActions,
    stateBefore: stateBefore as any,
    stateAfter: finalState as any,
    debug: {
      requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType,
      chatId: input.chatId, language: detected as any, automationEngineVersion: config.automationEngineVersion,
      dbWriteAttempted: fsmRes.dbWriteAttempted, dbWriteSuccess: fsmRes.dbWriteSuccess,
      intent: responseActions[0] || 'fsm_flow', durationMs: Date.now() - startTime
    }
  };
}
