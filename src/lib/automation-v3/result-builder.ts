import type { AutomationInput, AutomationResult, WorkspaceConfig } from '@/lib/ai/types';
import type { SessionData, SessionContext, FsmResult } from './types';
import { validateTransition } from '@/lib/ai/state-validator';
import { generateResponse } from './response-generator';
import { saveSession } from './session-manager';
import { emitMetric, MetricBuilder } from '@/lib/ai/metrics';
import { buildPrompt } from './prompt-builder';

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

    session.lastBotMessage = responseGenResult.text;
    await saveSession(input.supabase, session, config.businessType);

    return {
      shouldReply: true,
      replyText: responseGenResult.text,
      actions: [...fsmRes.actions, 'force_menu_reset', 'llm_contextual_reply'],
      stateBefore: stateBefore as any,
      stateAfter: 'idle',
      debug: {
        requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType,
        chatId: input.chatId, language: detected as any, dbWriteAttempted: false, dbWriteSuccess: false,
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
        productName: fsmRes.context.payload?.productName,
        serviceName: fsmRes.context.payload?.serviceName,
        price: fsmRes.context.payload?.price,
        date: fsmRes.context.payload?.date,
        time: fsmRes.context.payload?.time,
        missingDetails: fsmRes.context.payload?.missingDetails,
        isReadyToConfirm: fsmRes.context.payload?.isReadyToConfirm,
        isAwaitingVariant: fsmRes.context.payload?.isAwaitingVariant,
      }
    } : undefined
  });

  const reply = responseGenResult.text;
  session.lastBotMessage = reply;
  session.stateEnteredAt = new Date().toISOString();

  await saveSession(input.supabase, session, config.businessType);

  // Save metrics
  metrics.addActions(fsmRes.actions).addLlmCall(0);
  if (fsmRes.dbWriteSuccess) {
    if (config.businessType === 'ecommerce') metrics.setOrderCreated();
    if (config.businessType === 'appointments') metrics.setAppointmentCreated();
  }
  await emitMetric(input.supabase, metrics.setState(stateBefore, finalState).build());

  const responseActions = [...fsmRes.actions];
  if (!responseActions.includes('v3_brain_reply')) responseActions.push('v3_brain_reply');
  if (!responseActions.includes('llm_reply')) responseActions.push('llm_reply');

  return {
    shouldReply: true,
    replyText: reply,
    actions: responseActions,
    stateBefore: stateBefore as any,
    stateAfter: finalState as any,
    debug: {
      requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType,
      chatId: input.chatId, language: detected as any, dbWriteAttempted: fsmRes.dbWriteAttempted, dbWriteSuccess: fsmRes.dbWriteSuccess,
      intent: responseActions[0] || 'fsm_flow', durationMs: Date.now() - startTime
    }
  };
}
