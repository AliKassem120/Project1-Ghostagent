import { SupabaseClient } from '@supabase/supabase-js';
import type { AutomationInput, AutomationResult, WorkspaceConfig, ConversationStage } from '@/lib/ai/types';
import { loadSession, saveSession, shouldDetectLoop } from './session-manager';
import { classifyIntent } from './intent-classifier';
import { runEcommerceFSM } from './fsm/ecommerce-fsm';
import { runAppointmentFSM } from './fsm/appointment-fsm';
import { runThinkingLayer, type ToolResult } from './thinking-layer';
import { generateResponse } from './response-generator';
import { checkVoiceConsistency } from './voice-consistency-guard';
import { getTemplate } from './templates';
import { buildTimeContext, formatTime12, resolveDateFromMessage, resolveTimeFromMessage, formatDateLabel } from '@/lib/ai/time';
import { detectLanguage, detectLanguageScript } from '@/lib/ai/language';
import { validateTransition } from '@/lib/ai/state-validator';
import { loadConversationHistory } from '@/lib/ai/history';
import { checkRateLimit } from '@/lib/ai/guardrails/rate-limiter';
import { MetricBuilder, emitMetric } from '@/lib/ai/metrics';
import { v2log } from '@/lib/ai/logger';
import { loadActiveServices } from '@/lib/ai/appointments/services';
import { searchProducts } from '@/lib/ai/ecommerce/products';

// Phase 3 Scale & Intelligence imports
import { detectEmotion, buildEmotionPromptBlock } from '@/lib/ai/emotional-intelligence';
import { loadCustomerNotes, extractNoteworthyFacts, saveCustomerNotes } from '@/lib/ai/customer-notes';
import { buildProactiveSuggestions, getNextAvailableSlotSuggestions } from '@/lib/ai/intent-chain';
import { checkAndProcessSessionSummary, loadRecentSummaries } from '@/lib/ai/memory';
import { buildPrompt } from './prompt-builder';
import { executeTool } from './tool-executor';
import { runFSMAndGenerateResponse } from './result-builder';

// Phase 4 Intelligence imports
import { compressConversationHistory } from './memory-compressor';
import { getVariant, isFeatureEnabled, trackRequestExperiments } from './experiments';
import { flushMetrics } from '@/lib/ai/metrics';



export async function orchestrate(
  input: AutomationInput,
  config: WorkspaceConfig
): Promise<AutomationResult> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  const metrics = new MetricBuilder(input.workspaceId, input.chatId, input.platform);

  const detected = detectLanguage(input.message);
  const replyLang = config.language === 'Auto-Detect' ? detected : config.language.toLowerCase();
  const timeCtx = buildTimeContext(config.timezone);

  // 1. Rate Limiting Check
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
        requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType,
        chatId: input.chatId, language: detected, dbWriteAttempted: false, dbWriteSuccess: false,
        intent: 'rate_limited', durationMs: Date.now() - startTime
      }
    };
  }

  // 2. Load Session
  const session = await loadSession(
    input.supabase,
    input.userId,
    input.workspaceId,
    input.chatId,
    config.businessType,
    input.platform
  );
  let stateBefore = session.state;

  // HANDOFF AUTO-RECOVERY: If customer messages us after handoff and isn't asking for human, treat as fresh
  if (stateBefore === 'handoff') {
    const isHandoffRequest = /human|agent|manager|7ada|\u0641\u0627\u0639\u0644|\u0634\u062e\u0635|\u0628\u0634\u0631/i.test(input.message);
    if (!isHandoffRequest) {
      v2log.info('ORCHESTRATOR', 'Auto-recovering from handoff to idle (new intent detected)', {
        message: input.message.substring(0, 50),
      });
      session.state = 'idle';
      session.loopCount = 0;
      session.lastBotMessage = null;
      session.data = {};
      session.stateEnteredAt = new Date().toISOString();
      stateBefore = 'idle';
      await saveSession(input.supabase, session, config.businessType);
    }
  }

  // Check for stage duration timeout before processing to prevent split-brain states
  if (session.state !== 'idle' && session.stateEnteredAt) {
    const { STATE_CONFIGS } = await import('@/lib/ai/state-validator');
    const stateConfig = STATE_CONFIGS[session.state];
    if (stateConfig && stateConfig.maxDurationMinutes !== Infinity) {
      const enteredTime = new Date(session.stateEnteredAt).getTime();
      const elapsedMinutes = (Date.now() - enteredTime) / (1000 * 60);
      if (elapsedMinutes > stateConfig.maxDurationMinutes) {
        v2log.warn('ORCHESTRATOR', 'Stage duration timeout detected before processing. Resetting to fallback state.', {
          currentState: session.state,
          elapsedMinutes,
          max: stateConfig.maxDurationMinutes,
          fallback: stateConfig.fallbackState
        });
        session.state = stateConfig.fallbackState || 'idle';
        session.loopCount = 0;
        session.lastBotMessage = null;
        session.stateEnteredAt = new Date().toISOString();
        stateBefore = session.state;
        await saveSession(input.supabase, session, config.businessType);
      }
    }
  }

  // 3. Load Conversation History
  const history = await loadConversationHistory(
    input.supabase, input.userId, input.workspaceId, input.chatId
  );

  const isSimulator = input.chatId.startsWith('sim_') || input.chatId.includes('simulator');

  // Define helpers for state updates and returns
  const returnHandoff = async (reply: string, actionsList: string[]): Promise<AutomationResult> => {
    session.state = 'handoff';
    session.loopCount = 0;
    session.lastBotMessage = reply;
    session.stateEnteredAt = new Date().toISOString();

    await saveSession(input.supabase, session, config.businessType);

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
        conversationSummary: 'Customer routed to handoff.',
        customerName: known?.name || undefined,
        customerPhone: known?.phone || undefined,
        recentMessages: recent,
        currentState: stateBefore,
        actionsTaken: actionsList
      });
    } catch (e) {
      v2log.warn('AGENT', 'Failed to create handoff entry', { error: e });
    }

    const handoffReply = replyLang === 'arabizi'
      ? 'La7za, 3am nwaslak ma3 7ada mn l team.'
      : 'Connecting you to a human agent shortly...';

    return {
      shouldReply: true,
      replyText: handoffReply,
      actions: [...actionsList, 'handoff'],
      stateBefore,
      stateAfter: 'handoff',
      debug: {
        requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType,
        chatId: input.chatId, language: detected, dbWriteAttempted: false, dbWriteSuccess: false,
        intent: 'handoff', durationMs: Date.now() - startTime
      }
    };
  };



  // Phase 3: Emotional Intelligence (rule-based, no LLM call)
  const emotionSignal = detectEmotion(input.message, history);
  const emotionBlock = buildEmotionPromptBlock(emotionSignal);

  // Phase 3: Early frustration-based handoff check
  if (emotionSignal.sentiment === 'frustrated' && session.loopCount >= 2) {
    v2log.info('ORCHESTRATOR', 'Frustrated customer with loops detected, forcing early handoff', {
      loopCount: session.loopCount,
      triggers: emotionSignal.triggers,
    });
    return await returnHandoff('[HANDOFF] Frustrated customer escalated to human agent.', ['emotion_frustration_detected', 'early_handoff']);
  }

  // Check loop detection (bot repeats questions)
  if (session.lastBotMessage && shouldDetectLoop(session, input.message)) {
    const fallbackMenu = getTemplate('loop_detected_menu', replyLang as any) || 'Let\'s start fresh!';
    return await returnHandoff(fallbackMenu, ['loop_detected_escalation']);
  }

  // Hydrate memory summaries
  try {
    await checkAndProcessSessionSummary(
      input.supabase,
      input.workspaceId,
      input.chatId,
      input.userId,
      input.platform
    );
  } catch (e) {
    v2log.warn('ORCHESTRATOR', 'Session summaries check failed', { error: e });
  }

  const recentSummaries = await loadRecentSummaries(
    input.supabase,
    input.workspaceId,
    input.chatId,
    3
  );

  // Load customer notes/preferences
  let customerNotes: string[] = [];
  try {
    customerNotes = await loadCustomerNotes(input.supabase, input.workspaceId, input.chatId, 10);
  } catch (e) {
    v2log.warn('ORCHESTRATOR', 'Failed to load customer notes', { error: e });
  }

  // Load cross-channel profile notes
  let crossChannelNote = '';
  try {
    const profile = session.customerProfile;
    if (profile) {
      const otherPlatform = input.platform === 'instagram' ? 'WhatsApp' : 'Instagram';
      const hasOtherPlatform = input.platform === 'instagram'
        ? !!profile.whatsappChatId
        : !!profile.instagramChatId;
      if (hasOtherPlatform) {
        crossChannelNote = `CROSS-CHANNEL: This customer also chats with you on ${otherPlatform}. Treat it as the same person — they may reference conversations from either platform.`;
      }
    }
  } catch (e) {
    v2log.warn('ORCHESTRATOR', 'Failed to load cross-channel profile note', { error: e });
  }

  // Pre-load services or products for toolResults / proactive suggestions
  let activeServices: any[] | undefined;
  if (config.businessType === 'appointments') {
    activeServices = await loadActiveServices(input.supabase, input.workspaceId);
  }
  let activeProducts: any[] | undefined;
  if (config.businessType === 'ecommerce') {
    activeProducts = await searchProducts({ supabase: input.supabase, workspaceId: input.workspaceId, limit: 50 });
  }

  // Phase 3: Proactive Suggestions
  let proactiveBlock = '';
  try {
    const availableSlots = config.businessType === 'appointments'
      ? getNextAvailableSlotSuggestions(timeCtx, config, 3)
      : undefined;
    proactiveBlock = buildProactiveSuggestions({
      config,
      sessionState: session.state,
      services: activeServices,
      products: activeProducts,
      recentSummaries,
      availableSlots,
      timeContext: timeCtx,
    });
  } catch (e) {
    v2log.warn('ORCHESTRATOR', 'Failed to build proactive suggestions', { error: e });
  }

  // 4. DETECT IF IN ACTIVE FSM FLOW
  const isAwaitingDetailsEcom = ['awaiting_product', 'awaiting_variant', 'awaiting_order_details', 'awaiting_checkout_confirmation', 'post_order_modify'].includes(stateBefore);
  const isAwaitingDetailsAppt = ['awaiting_service', 'awaiting_date_time', 'awaiting_customer_details', 'awaiting_booking_confirmation', 'post_appointment_modify'].includes(stateBefore);

  if ((config.businessType === 'ecommerce' && isAwaitingDetailsEcom) ||
    (config.businessType === 'appointments' && isAwaitingDetailsAppt)) {

    v2log.info('ORCHESTRATOR', `Routing to active deterministic FSM flow: ${stateBefore}`);
    let fsmRes: any;
    if (config.businessType === 'ecommerce') {
      fsmRes = await runEcommerceFSM(input.message, session, config, input.supabase);
    } else {
      fsmRes = await runAppointmentFSM(input.message, session, config, input.supabase);
    }

    return await runFSMAndGenerateResponse({
      fsmRes, stateBefore, session, history, input, config, replyLang, timeCtx,
      activeServices, activeProducts, recentSummaries, customerNotes, emotionBlock, proactiveBlock, crossChannelNote,
      metrics, startTime, requestId, detected, returnHandoff
    });
  }

  // 5. RUN INTENT CLASSIFICATION (using DeepSeek)
  v2log.info('ORCHESTRATOR', 'Running DeepSeek Intent Classifier');
  const classification = await classifyIntent(input.message, config.businessType, {
    currentState: stateBefore,
    customerProfile: session.customerProfile,
    recentProduct: session.data?.productName,
    recentService: session.data?.serviceName,
  });

  const intent = classification.intent;
  v2log.info('ORCHESTRATOR', `Intent classified: ${intent}`);

  // 6. DIRECT ROUTE TO FSM ON INITIATION INTENTS
  const isEcomIntent = intent === 'purchase_intent';
  const isApptIntent = intent === 'booking_intent';

  if ((config.businessType === 'ecommerce' && isEcomIntent) ||
    (config.businessType === 'appointments' && isApptIntent)) {

    v2log.info('ORCHESTRATOR', `Starting FSM flow based on intent: ${intent}`);
    let fsmRes: any;
    if (config.businessType === 'ecommerce') {
      fsmRes = await runEcommerceFSM(input.message, session, config, input.supabase);
    } else {
      fsmRes = await runAppointmentFSM(input.message, session, config, input.supabase);
    }
    return await runFSMAndGenerateResponse({
      fsmRes, stateBefore, session, history, input, config, replyLang, timeCtx,
      activeServices, activeProducts, recentSummaries, customerNotes, emotionBlock, proactiveBlock, crossChannelNote,
      metrics, startTime, requestId, detected, returnHandoff
    });
  }

  // 7. DIRECT ROUTE FOR CANCELLATION / RESCHEDULING INTENTS
  const isCancelOrder = intent === 'cancel_order';
  const isModifyOrder = intent === 'modify_order';
  const isCancelAppt = intent === 'cancel_appointment';
  const isReschedAppt = intent === 'reschedule_appointment' || intent === 'modify_appointment';

  if (config.businessType === 'ecommerce' && (isCancelOrder || isModifyOrder)) {
    session.state = 'post_order_modify';
    session.stateEnteredAt = new Date().toISOString();
    const fsmRes = await runEcommerceFSM(input.message, session, config, input.supabase);
    return await runFSMAndGenerateResponse({
      fsmRes, stateBefore, session, history, input, config, replyLang, timeCtx,
      activeServices, activeProducts, recentSummaries, customerNotes, emotionBlock, proactiveBlock, crossChannelNote,
      metrics, startTime, requestId, detected, returnHandoff
    });
  }

  if (config.businessType === 'appointments' && (isCancelAppt || isReschedAppt)) {
    session.state = 'post_appointment_modify';
    session.stateEnteredAt = new Date().toISOString();
    const fsmRes = await runAppointmentFSM(input.message, session, config, input.supabase);
    return await runFSMAndGenerateResponse({
      fsmRes, stateBefore, session, history, input, config, replyLang, timeCtx,
      activeServices, activeProducts, recentSummaries, customerNotes, emotionBlock, proactiveBlock, crossChannelNote,
      metrics, startTime, requestId, detected, returnHandoff
    });
  }

  // 8. HUMAN HANDOFF INTENT
  if (intent === 'human_handoff' || intent === 'frustration_stop') {
    return await returnHandoff('[HANDOFF] Customer requested human.', []);
  }

  // 9. FALLBACK DECOUPLED PIPELINE (Thinking Layer -> Executing Tools -> Response Generator)
  v2log.info('ORCHESTRATOR', 'Running Inverted Fallback Pipeline: Thinking Layer first');

  const toolResults: ToolResult[] = [];
  const actions: string[] = [];

  const toolCtxFallback = {
    supabase: input.supabase,
    userId: input.userId,
    workspaceId: input.workspaceId,
    chatId: input.chatId,
    config,
    platform: input.platform,
    session,
  };

  // PROACTIVE TOOL EXECUTION: Pre-execute tools for known intent patterns
  // so the response generator has real data from the start
  // Filtered by business type to avoid calling ecommerce tools on appointment workspaces
  const PROACTIVE_TOOLS: Record<string, string[]> = {
    product_question: ['search_products'],
    price_question: ['search_products'],
    product_availability: ['search_products'],
    purchase_intent: ['search_products'],
    service_question: ['get_services'],
    booking_intent: ['get_services'],
    business_hours: ['get_business_hours'],
    check_availability: ['check_slot'],
  };

  const proactiveTools = PROACTIVE_TOOLS[intent];
  if (proactiveTools && proactiveTools.length > 0) {
    // Filter tools by business type to avoid wrong-tool calls
    const isEcom = config.businessType === 'ecommerce';
    const allowedTools = proactiveTools.filter((t) => {
      if (isEcom) {
        // Ecommerce workspaces only use ecommerce + shared tools
        return ['search_products', 'check_stock', 'get_business_hours'].includes(t);
      }
      // Appointment workspaces only use appointment + shared tools
      return ['get_services', 'check_slot', 'get_business_hours', 'lookup_customer'].includes(t);
    });

    for (const toolName of allowedTools) {
      v2log.info('ORCHESTRATOR', `Proactive tool execution: ${toolName} (intent: ${intent})`);
      try {
        const res = await executeTool(toolName, input.message, classification.entities || {}, toolCtxFallback);
        if (res !== null) {
          toolResults.push({ tool: toolName, result: res });
          actions.push('proactive_tool_' + toolName);
        }
      } catch (err) {
        v2log.warn('ORCHESTRATOR', `Failed proactive tool: ${toolName}`, { error: err });
      }
    }
  }

  // Step 1: Execute Strategy/Thinking layer WITH pre-loaded tool results
  const strategy = await runThinkingLayer(
    input.message,
    session,
    detected,
    toolResults,
    config
  );

  // Step 2 & 3: Read additional toolsNeeded and execute tools sequentially
  const alreadyExecuted = new Set(toolResults.map(r => r.tool));
  for (const toolName of strategy.toolsNeeded) {
    if (alreadyExecuted.has(toolName)) continue; // Skip already-executed proactive tools
    v2log.info('ORCHESTRATOR', `Executing tool: ${toolName}`);
    try {
      const res = await executeTool(toolName, input.message, classification.entities || {}, toolCtxFallback);
      if (res !== null) {
        toolResults.push({ tool: toolName, result: res });
        actions.push('tool_' + toolName);
      }
    } catch (err) {
      v2log.warn('ORCHESTRATOR', `Failed to execute tool: ${toolName}`, { error: err });
    }
  }

  // Step 4: Pass toolResults directly into the Response Generator
  const systemPrompt = buildPrompt(
    config,
    replyLang,
    [],
    input.platform,
    false,
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
      role: h.role,
      content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content)
    })).concat([{ role: 'user', content: input.message }]),
    currentState: session.state,
    customerProfile: session.customerProfile,
    toolResults,
    requiredLanguageScript: replyLang as any,
    channel: input.platform,
    strategy,
    workspaceConfig: config,
    timeContext: {
      dayName: timeCtx.dayName,
      isoDate: timeCtx.isoDate,
      isoTime: timeCtx.isoTime
    }
  });

  let reply = responseGenResult.text;

  // Run VoiceConsistencyGuard
  const voiceCheck = checkVoiceConsistency(reply, config, toolResults);
  if (!voiceCheck.approved && voiceCheck.correctedText) {
    v2log.info('ORCHESTRATOR', 'Voice Consistency Guard corrected reply', { violations: voiceCheck.violations });
    reply = voiceCheck.correctedText;
  }

  // Asynchronously extract and save customer memory notes (fire-and-forget)
  try {
    const conversationForNotes = [
      ...history.slice(-8),
      { role: 'user' as const, content: input.message },
      { role: 'assistant' as const, content: reply },
    ];
    extractNoteworthyFacts(conversationForNotes, customerNotes).then(notes => {
      if (notes.length > 0) {
        saveCustomerNotes(input.supabase, input.workspaceId, input.chatId, input.platform, notes).catch(() => { });
      }
    }).catch(() => { });
  } catch (e) {
    // Non-critical note saving fallback
  }

  actions.push('v3_brain_reply', 'llm_reply');

  // Validate state transition (suggestedNextState from Thinking Layer)
  const validation = validateTransition(
    session.state,
    strategy.suggestedNextState,
    session.loopCount,
    session.stateEnteredAt
  );

  let finalStage = validation.approvedStage;
  let loopCount = validation.resetLoop ? 0 : (strategy.suggestedNextState === session.state ? session.loopCount + 1 : 0);

  // FIX: forceMenu was calling returnHandoff() which created a recursive trap.
  // Reset to idle but PRESERVE session.data and use the LLM-generated reply
  // (already computed above) instead of a hardcoded generic greeting.
  if (validation.forceMenu) {
    v2log.warn('ORCHESTRATOR', 'forceMenu triggered — resetting to idle with contextual LLM reply', {
      currentState: session.state, loopCount: session.loopCount
    });
    session.state = 'idle';
    session.loopCount = 0;
    session.lastBotMessage = reply;
    // NOTE: session.data is intentionally NOT wiped — it contains order context
    session.stateEnteredAt = new Date().toISOString();
    await saveSession(input.supabase, session, config.businessType);

    return {
      shouldReply: true,
      replyText: reply,
      actions: [...actions, 'force_menu_reset', 'llm_contextual_reply'],
      stateBefore,
      stateAfter: 'idle',
      debug: {
        requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType,
        chatId: input.chatId, language: detected, dbWriteAttempted: false, dbWriteSuccess: false,
        intent: 'force_menu_reset', durationMs: Date.now() - startTime
      }
    };
  }

  if (reply.includes('[HANDOFF]') || finalStage === 'handoff') {
    return await returnHandoff(reply, actions);
  }

  session.state = finalStage;
  session.loopCount = loopCount;
  session.lastBotMessage = reply;
  session.stateEnteredAt = new Date().toISOString();

  await saveSession(input.supabase, session, config.businessType);

  metrics.addActions(actions).addLlmCall(Date.now() - startTime);
  await emitMetric(input.supabase, metrics.setState(stateBefore, finalStage).build());

  // Phase 4: Track experiment results (fire-and-forget)
  trackRequestExperiments(input.supabase, input.workspaceId, actions, finalStage).catch(() => { });

  // Phase 4: Flush metrics before returning (important for serverless)
  await flushMetrics();

  return {
    shouldReply: true,
    replyText: reply,
    actions,
    stateBefore,
    stateAfter: finalStage,
    debug: {
      requestId,
      engineVersion: 'v3-agent',
      workspaceId: input.workspaceId,
      workspaceType: config.businessType,
      chatId: input.chatId,
      language: detected,
      dbWriteAttempted: false,
      dbWriteSuccess: false,
      intent: actions[0] || 'fallback_generation',
      durationMs: Date.now() - startTime
    }
  };
}
