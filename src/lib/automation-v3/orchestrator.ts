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
import { buildTimeContext, formatTime12 } from '@/lib/ai/time';
import { detectLanguage, detectLanguageScript } from '@/lib/ai/language';
import { validateTransition } from '@/lib/ai/state-validator';
import { loadConversationHistory } from '@/lib/ai/history';
import { checkRateLimit } from '@/lib/ai/guardrails/rate-limiter';
import { MetricBuilder, emitMetric } from '@/lib/ai/metrics';
import { v2log } from '@/lib/ai/logger';
import { generateText, stepCountIs, tool } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { loadActiveServices } from '@/lib/ai/appointments/services';
import { searchProducts } from '@/lib/ai/ecommerce/products';
import { createAppointmentTools, createEcommerceTools } from '@/lib/ai/tools';
import { z } from 'zod';

// Phase 3 Scale & Intelligence imports
import { detectEmotion, buildEmotionPromptBlock } from '@/lib/ai/emotional-intelligence';
import { loadCustomerNotes, extractNoteworthyFacts, saveCustomerNotes } from '@/lib/ai/customer-notes';
import { buildProactiveSuggestions, getNextAvailableSlotSuggestions } from '@/lib/ai/intent-chain';
import { checkAndProcessSessionSummary, loadRecentSummaries } from '@/lib/ai/memory';
import { loadCustomerProfile } from '@/lib/ai/customer-profile';

// Phase 4 Intelligence imports
import { compressConversationHistory } from './memory-compressor';
import { getVariant, isFeatureEnabled, trackRequestExperiments } from './experiments';
import { flushMetrics } from '@/lib/ai/metrics';

const SMALL_MODEL = 'llama-3.1-8b-instant';
const SMART_MODEL = 'llama-3.3-70b-versatile';

function getGroqProvider() {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    throw new Error('GROQ_API_KEY is missing');
  }
  const groq = createGroq({ apiKey: groqKey });
  return (modelId: string) => groq(modelId);
}

async function generateObjectFallback<T>(
  groqInstance: any,
  modelId: string,
  args: {
    system: string;
    prompt: string;
    schema: { parse: (val: any) => T };
    temperature?: number;
  }
): Promise<{ object: T }> {
  const shape = (args.schema as any).shape || {};
  const keyBlueprint = JSON.stringify(
    Object.fromEntries(Object.keys(shape).map(k => [k, 'your_classified_value']))
  );
  const jsonPrompt = `${args.prompt}\n\nIMPORTANT: You must output ONLY a valid JSON object. Do NOT include markdown code blocks, backticks, or any conversational text.\nYour JSON object MUST use this exact key structure: ${keyBlueprint}`;

  const result = await generateText({
    model: groqInstance(modelId),
    system: args.system,
    prompt: jsonPrompt,
    temperature: args.temperature ?? 0,
  });

  const text = result.text?.trim() || '';
  const cleanedText = text
    .replace(/^```json/i, '')
    .replace(/^```/i, '')
    .replace(/```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleanedText);
    return { object: args.schema.parse(parsed) };
  } catch (e) {
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return { object: args.schema.parse(parsed) };
      } catch (innerErr: any) {
        throw new Error(`Failed to parse extracted JSON: ${innerErr.message || String(innerErr)}. Original text: ${cleanedText}`);
      }
    }
    throw new Error(`Failed to parse LLM response as JSON. Original text: ${cleanedText}`);
  }
}

async function classifyProposedNextStage(
  groqInstance: any,
  currentStage: string,
  businessType: 'appointments' | 'ecommerce',
  message: string,
  reply: string,
  actions: string[]
): Promise<ConversationStage> {
  try {
    const appointmentStages = `For 'appointments' business type:
- 'idle': Conversation is completed, cancelled, or reset to start.
- 'awaiting_service': Customer is choosing/discussing which service they want.
- 'awaiting_date_time': Service is known, but we are waiting for date/time preference or availability check. (If the customer has already specified their date/time preference, e.g. "Monday at 11am", do NOT choose 'awaiting_date_time'; choose 'awaiting_customer_details').
- 'awaiting_customer_details': Service and date/time are known, but we need customer name, phone, or details. (If the customer has already supplied these details, do NOT choose 'awaiting_customer_details'; choose 'awaiting_booking_confirmation').
- 'awaiting_booking_confirmation': We have service, date/time, and customer details, and we are asking them to confirm the booking or confirming it.
- 'post_appointment_modify': Customer wants to reschedule, cancel, or modify an existing booking. Keep using this state for the entire cancellation/modification flow; do NOT choose 'awaiting_customer_details', 'awaiting_service', or 'awaiting_date_time' even if collecting details or discussing dates for the cancellation.
- 'handoff': User explicitly asked to talk to a human, the bot cannot help them, or the bot states that a staff member or human will contact or help them shortly.`;

    const ecommerceStages = `For 'ecommerce' business type:
- 'idle': Conversation is completed, cancelled, or reset to start.
- 'awaiting_product': Customer is choosing/discussing which product they want.
- 'awaiting_variant': Product is known, but we are waiting for size, color, or variant choice. (If the customer has already specified their variant/size/color, e.g. "size M", do NOT choose 'awaiting_variant'; choose 'awaiting_order_details').
- 'awaiting_order_details': Product/variant is known, but we need customer shipping details (name, phone, address). (If the customer has already supplied these details, do NOT choose 'awaiting_order_details'; choose 'awaiting_checkout_confirmation').
- 'awaiting_checkout_confirmation': We have product and shipping details, and we are asking them to confirm the order or confirming it.
- 'post_order_modify': Customer wants to cancel, track, or modify an existing order. Keep using this state for the entire order modification/tracking flow; do NOT choose 'awaiting_order_details', 'awaiting_product', or 'awaiting_variant' even if collecting details for the modification.
- 'handoff': User explicitly asked to talk to a human, the bot cannot help them, or the bot states that a staff member or human will contact or help them shortly.`;

    const stageDirectives = businessType === 'appointments' ? appointmentStages : ecommerceStages;

    const system = `You are a conversation state classifier for an FSM.
Based on:
1. Current State: "${currentStage}"
2. Customer Message: "${message}"
3. Tool Actions Executed: "${actions.join(', ')}"
4. Bot Reply: "${reply}"

Choose the most appropriate next state from the list of valid states for this business type:
${stageDirectives}

Choose strictly one of the stage keys listed above (must be a valid string literal like 'awaiting_date_time' or 'awaiting_order_details').`;

    const classification = await generateObjectFallback(groqInstance, SMALL_MODEL, {
      system,
      prompt: `Determine next stage. Current stage is ${currentStage}.`,
      schema: z.object({
        stage: z.enum([
          'idle', 'collecting', 'confirming', 'complete', 'handoff',
          'awaiting_product', 'awaiting_variant', 'awaiting_order_details', 'awaiting_checkout_confirmation',
          'awaiting_service', 'awaiting_date_time', 'awaiting_customer_details', 'awaiting_booking_confirmation',
          'post_order_modify', 'post_appointment_modify'
        ] as const).describe('The determined next stage of the conversation')
      }),
      temperature: 0,
    });

    const proposed = classification.object?.stage;
    if (!proposed) {
      v2log.warn('STATE_CLASSIFIER', 'Invalid stage classified, defaulting to current stage', { proposed, currentStage });
      return currentStage as ConversationStage;
    }
    return proposed as ConversationStage;
  } catch (e) {
    v2log.warn('STATE_CLASSIFIER', 'Failed to classify next stage, defaulting to current', { error: e });
    return currentStage as ConversationStage;
  }
}

function buildPrompt(
  config: WorkspaceConfig,
  replyLanguage: string,
  ragExamples: { customer_message: string, owner_reply: string }[] | undefined,
  platform: 'instagram' | 'whatsapp',
  skipTools = false,
  services?: any[],
  recentSummaries?: string[],
  session?: any,
  customerNotes?: string[],
  emotionBlock?: string,
  proactiveBlock?: string,
  crossChannelNote?: string
): string {
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
    ? 'You may use up to 1 emoji per message, only when it feels natural. EXCEPTION: If the customer is frustrated, angry, or using ALL CAPS, do NOT use any emojis at all — they come across as dismissive and insincere.'
    : 'Do NOT use any emojis. Zero. No exceptions.';

  let serviceCatalogBlock = '';
  if (config.businessType === 'appointments' && services && services.length > 0) {
    const serviceLines = services.map(s =>
      `- ${s.name}: $${s.price}, ${s.durationMinutes || s.duration} min`
    ).join('\n');
    serviceCatalogBlock = `\nSERVICES MENU (from database):\n${serviceLines}\n`;
  }

  const lengthRule = 'Keep replies short and DM-style. 1–3 sentences max. No paragraphs. Be natural, not robotic.';

  let memoryBlock = '';
  if (recentSummaries && recentSummaries.length > 0) {
    memoryBlock = `\nRECALLED CONVERSATION HISTORY (summaries of prior sessions):\n${recentSummaries.map((s, idx) => `- Session ${idx + 1}: ${s}`).join('\n')}\nUse these summaries to remember what was previously discussed with this customer if they refer to past events, choices, or agreements. Do not mention that you are retrieving this from database memory.\n`;
  }

  let notesBlock = '';
  if (customerNotes && customerNotes.length > 0) {
    notesBlock = `\nCUSTOMER MEMORY (things you know about this person):\n${customerNotes.map(n => `- ${n}`).join('\n')}\nUse these naturally in conversation. Never say "according to my notes" — just reference them as if you personally remember.\n`;
  }

  let sessionBlock = '';
  if (session) {
    sessionBlock = `\nCURRENT CONVERSATION STATE:\n- Current Stage: ${session.state}\n- Loop Count: ${session.loopCount}\n- Last Bot Message: ${session.lastBotMessage || 'None'}\n`;
  }

  let identityNote = '';
  if (crossChannelNote) {
    identityNote = `\n${crossChannelNote}\n`;
  }

  return `You are the DM manager of "${config.businessName}", ${businessDesc}.
You're chatting with a customer on ${platform === 'whatsapp' ? 'WhatsApp' : 'Instagram DMs'}.

UNDERSTANDING ARABIZI/FRANCO-ARABIC INPUT:
Customers may write in Lebanese Arabizi (Franco-Arabic) where numbers replace Arabic letters. Common mappings: 3=ع (ain), 7=ح (ha), 2=ء/ق (hamza/qaf), 5=خ (kha), 8=غ (ghain), 6=ط (ta). Examples: "e7joz" = "I want to book", "3ndkn" = "do you have", "nhar l a7ad" = "Sunday", "mar7aba" = "hello", "addesh" = "how much", "se3r" = "price", "maw3ed" = "appointment". If you receive a message mixing numbers and Latin letters, try to interpret it as Arabizi before asking the customer to repeat.
${memoryBlock}${notesBlock}${identityNote}${sessionBlock}${emotionBlock || ''}${proactiveBlock || ''}
RULES:
1. ${lengthRule}
2. ${tone}
3. ${emojiRule}
4. You are HUMAN. Never say you're an AI or bot.
5. ONLY reply EXACTLY with [HANDOFF] if the user explicitly asks for a human agent.

${config.systemInstructions ? `BUSINESS INFO:\n${config.systemInstructions}` : ''}
${config.storeLocation ? `LOCATION: ${config.storeLocation}` : ''}
${config.contactInfo ? `CONTACT: ${config.contactInfo}` : ''}
${serviceCatalogBlock}`;
}

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

  const groqInstance = getGroqProvider();
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
      ? 'L7aza, 3am nwaslak ma3 7ada mn l team.'
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
      groqInstance,
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

    // Run transition validation
    const validation = validateTransition(stateBefore, fsmRes.nextState as any, session.loopCount, session.stateEnteredAt);
    let finalState = validation.approvedStage;
    let loopCount = validation.resetLoop ? 0 : (fsmRes.nextState === stateBefore ? session.loopCount + 1 : 0);

    if (validation.forceMenu) {
      return await returnHandoff(`[HANDOFF] Loop/timeout limit exceeded.`, fsmRes.actions);
    }

    session.state = finalState;
    session.loopCount = loopCount;
    session.lastBotMessage = fsmRes.replyText;
    if (finalState !== stateBefore) {
      session.stateEnteredAt = new Date().toISOString();
    }

    await saveSession(input.supabase, session, config.businessType);

    // Save metrics
    metrics.addActions(fsmRes.actions).addLlmCall(0); // Zero LLM call FSM!
    if (fsmRes.dbWriteSuccess) {
      if (config.businessType === 'ecommerce') metrics.setOrderCreated();
      if (config.businessType === 'appointments') metrics.setAppointmentCreated();
    }
    await emitMetric(input.supabase, metrics.setState(stateBefore, finalState).build());

    // Backwards-compatibility actions push
    const responseActions = [...fsmRes.actions];
    if (!responseActions.includes('v3_brain_reply')) responseActions.push('v3_brain_reply');
    if (!responseActions.includes('llm_reply')) responseActions.push('llm_reply');

    return {
      shouldReply: true,
      replyText: fsmRes.replyText,
      actions: responseActions,
      stateBefore,
      stateAfter: finalState,
      debug: {
        requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType,
        chatId: input.chatId, language: detected, dbWriteAttempted: fsmRes.dbWriteAttempted, dbWriteSuccess: fsmRes.dbWriteSuccess,
        intent: responseActions[0] || 'fsm_flow', durationMs: Date.now() - startTime
      }
    };
  }

  // 5. RUN INTENT CLASSIFICATION (using Groq)
  v2log.info('ORCHESTRATOR', 'Running Groq Intent Classifier');
  const classification = await classifyIntent(input.message, config.businessType, {
    currentState: stateBefore,
    customerProfile: session.customerProfile
  });

  const intent = classification.intent;
  v2log.info('ORCHESTRATOR', `Intent classified: ${intent}`);

  // 6. DETERMINISTIC GREETING ROUTE
  if (intent === 'greeting') {
    const isVip = session.customerProfile && (session.customerProfile.totalOrders >= 3 || session.customerProfile.totalAppointments >= 3);
    const isReturning = session.customerProfile && (session.customerProfile.totalOrders > 0 || session.customerProfile.totalAppointments > 0);
    
    let templateId = 'greeting';
    if (isVip) templateId = 'greeting_vip';
    else if (isReturning) templateId = 'greeting_returning';

    const greetingText = getTemplate(templateId, replyLang as any, { name: session.customerProfile?.name || 'there' }) || 
                         'Hello! How can I help you today?';

    session.state = 'idle';
    session.loopCount = 0;
    session.lastBotMessage = greetingText;
    await saveSession(input.supabase, session, config.businessType);

    metrics.addActions(['v3_brain_reply', 'llm_reply', `template_${templateId}`]);
    await emitMetric(input.supabase, metrics.setState(stateBefore, 'idle').build());

    return {
      shouldReply: true,
      replyText: greetingText,
      actions: ['v3_brain_reply', 'llm_reply', `template_${templateId}`],
      stateBefore,
      stateAfter: 'idle',
      debug: {
        requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType,
        chatId: input.chatId, language: detected, dbWriteAttempted: false, dbWriteSuccess: false,
        intent: 'greeting', durationMs: Date.now() - startTime
      }
    };
  }

  // 7. DIRECT ROUTE TO FSM ON INITIATION INTENTS
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

    session.state = fsmRes.nextState as any;
    session.lastBotMessage = fsmRes.replyText;
    session.stateEnteredAt = new Date().toISOString();
    await saveSession(input.supabase, session, config.businessType);

    // Save metrics
    metrics.addActions(fsmRes.actions);
    await emitMetric(input.supabase, metrics.setState(stateBefore, fsmRes.nextState).build());

    const responseActions = [...fsmRes.actions];
    if (!responseActions.includes('v3_brain_reply')) responseActions.push('v3_brain_reply');
    if (!responseActions.includes('llm_reply')) responseActions.push('llm_reply');

    return {
      shouldReply: true,
      replyText: fsmRes.replyText,
      actions: responseActions,
      stateBefore,
      stateAfter: fsmRes.nextState as any,
      debug: {
        requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType,
        chatId: input.chatId, language: detected, dbWriteAttempted: fsmRes.dbWriteAttempted, dbWriteSuccess: fsmRes.dbWriteSuccess,
        intent: responseActions[0] || 'fsm_flow_init', durationMs: Date.now() - startTime
      }
    };
  }

  // 8. DIRECT ROUTE FOR CANCELLATION / RESCHEDULING INTENTS
  const isCancelOrder = intent === 'cancel_order';
  const isCancelAppt = intent === 'cancel_appointment';
  const isReschedAppt = intent === 'reschedule_appointment' || intent === 'modify_appointment';

  if (config.businessType === 'ecommerce' && isCancelOrder) {
    session.state = 'post_order_modify';
    session.stateEnteredAt = new Date().toISOString();
    const fsmRes = await runEcommerceFSM(input.message, session, config, input.supabase);
    session.state = fsmRes.nextState as any;
    await saveSession(input.supabase, session, config.businessType);
    return {
      shouldReply: true,
      replyText: fsmRes.replyText,
      actions: [...fsmRes.actions, 'v3_brain_reply', 'llm_reply'],
      stateBefore,
      stateAfter: fsmRes.nextState as any,
      debug: {
        requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType,
        chatId: input.chatId, language: detected, dbWriteAttempted: fsmRes.dbWriteAttempted, dbWriteSuccess: fsmRes.dbWriteSuccess,
        intent: 'cancel_order', durationMs: Date.now() - startTime
      }
    };
  }

  if (config.businessType === 'appointments' && (isCancelAppt || isReschedAppt)) {
    session.state = 'post_appointment_modify';
    session.stateEnteredAt = new Date().toISOString();
    const fsmRes = await runAppointmentFSM(input.message, session, config, input.supabase);
    session.state = fsmRes.nextState as any;
    await saveSession(input.supabase, session, config.businessType);
    return {
      shouldReply: true,
      replyText: fsmRes.replyText,
      actions: [...fsmRes.actions, 'v3_brain_reply', 'llm_reply'],
      stateBefore,
      stateAfter: fsmRes.nextState as any,
      debug: {
        requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType,
        chatId: input.chatId, language: detected, dbWriteAttempted: fsmRes.dbWriteAttempted, dbWriteSuccess: fsmRes.dbWriteSuccess,
        intent: intent, durationMs: Date.now() - startTime
      }
    };
  }

  // 9. HUMAN HANDOFF INTENT
  if (intent === 'human_handoff' || intent === 'frustration_stop') {
    return await returnHandoff('[HANDOFF] Customer requested human.', []);
  }

  // 10. DETERMINISTIC STATIC HANDLERS
  if (intent === 'business_hours') {
    const responseText = config.businessType === 'appointments'
      ? 'We are open Monday to Saturday from 9 AM to 7 PM.'
      : 'Our store is open 24/7 online! Support is available Mon-Fri 9am-6pm.';
    
    session.state = 'idle';
    session.loopCount = 0;
    session.lastBotMessage = responseText;
    await saveSession(input.supabase, session, config.businessType);
    return {
      shouldReply: true,
      replyText: responseText,
      actions: ['v3_brain_reply', 'llm_reply'],
      stateBefore,
      stateAfter: 'idle',
      debug: {
        requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType,
        chatId: input.chatId, language: detected, dbWriteAttempted: false, dbWriteSuccess: false,
        intent: 'business_hours', durationMs: Date.now() - startTime
      }
    };
  }

  if (intent === 'location_question') {
    const locText = config.storeLocation 
      ? `We are located at: ${config.storeLocation}`
      : 'We are located in Beirut, Lebanon.';
    
    session.state = 'idle';
    session.loopCount = 0;
    session.lastBotMessage = locText;
    await saveSession(input.supabase, session, config.businessType);
    return {
      shouldReply: true,
      replyText: locText,
      actions: ['v3_brain_reply', 'llm_reply'],
      stateBefore,
      stateAfter: 'idle',
      debug: {
        requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType,
        chatId: input.chatId, language: detected, dbWriteAttempted: false, dbWriteSuccess: false,
        intent: 'location', durationMs: Date.now() - startTime
      }
    };
  }

  // 11. DECOUPLED BRAIN LAYER FALLBACK (Thinking + Generation via DeepSeek)
  v2log.info('ORCHESTRATOR', 'Routing to Decoupled V3 Brain Layer (DeepSeek)');

  // Prepare tools context and wrapped tools for fallback Vercel AI SDK execution
  const toolCtxFallback = {
    supabase: input.supabase,
    userId: input.userId,
    workspaceId: input.workspaceId,
    chatId: input.chatId,
    config,
    platform: input.platform,
  };
  const rawTools = config.businessType === 'appointments'
    ? createAppointmentTools(toolCtxFallback)
    : createEcommerceTools(toolCtxFallback);
          
  const wrappedTools = Object.fromEntries(
    Object.entries(rawTools).map(([name, def]: [string, any]) => {
      const schema = def.inputSchema || def.parameters;
      return [name, tool({
        ...def,
        parameters: schema
      } as any)];
    })
  );

  // Build fully-hydrated prompt including Phase 3 context blocks
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
    crossChannelNote
  );

  const messages: any[] = [
    { role: 'system', content: `Current context:\nDate: ${timeCtx.dayName}, ${timeCtx.isoDate} at ${timeCtx.isoTime}.` },
    ...history,
    { role: 'user', content: input.message }
  ];

  // Phase 4: Compress conversation history if experiment is enabled
  let compressedMessages = messages;
  if (isFeatureEnabled(input.workspaceId, 'memory_compression')) {
    try {
      // Compress only the conversation turns (skip the system context message)
      const systemMsg = messages[0];
      const conversationMsgs = messages.slice(1);
      const compressed = await compressConversationHistory(groqInstance, conversationMsgs, 4);
      compressedMessages = [systemMsg, ...compressed];
      v2log.info('ORCHESTRATOR', 'Memory compression applied', {
        originalTurns: messages.length,
        compressedTurns: compressedMessages.length,
      });
    } catch (e) {
      v2log.warn('ORCHESTRATOR', 'Memory compression failed, using full history', { error: e });
    }
  }

  let result: any;
  try {
    result = await generateText({
      model: groqInstance(SMART_MODEL),
      system: systemPrompt,
      messages: compressedMessages,
      tools: wrappedTools,
      stopWhen: stepCountIs(5),
      temperature: 0.3,
      maxRetries: 0,
    });
  } catch (err) {
    v2log.warn('ORCHESTRATOR', 'Primary Groq Smart Model failed, falling back to small model', { error: err });
    result = await generateText({
      model: groqInstance(SMALL_MODEL),
      system: systemPrompt,
      messages: compressedMessages,
      tools: wrappedTools,
      stopWhen: stepCountIs(5),
      temperature: 0.3,
    });
  }

  // Extract tool results
  const toolResults: ToolResult[] = [];
  const actions: string[] = [];
  let dbWriteAttempted = false;
  let dbWriteSuccess = false;

  for (const step of result.steps || []) {
    for (const tr of step.toolResults || []) {
      const toolName = (tr as any).toolName;
      const data = (tr as any).result ?? (tr as any).output;
      toolResults.push({ tool: toolName, result: data });

      if (['book_appointment', 'place_order', 'cancel_appointment', 'cancel_order', 'reschedule_appointment'].includes(toolName)) {
        dbWriteAttempted = true;
        actions.push('tool_' + toolName);
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

  // Call DeepSeek Strategist (Thinking Layer)
  const strategy = await runThinkingLayer(
    input.message,
    session,
    detected,
    toolResults,
    config
  );

  // Call DeepSeek Mouth (Response Generator)
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
    extractNoteworthyFacts(groqInstance, conversationForNotes, customerNotes).then(notes => {
      if (notes.length > 0) {
        saveCustomerNotes(input.supabase, input.workspaceId, input.chatId, input.platform, notes).catch(() => {});
      }
    }).catch(() => {});
  } catch (e) {
    // Non-critical note saving fallback
  }

  actions.push('v3_brain_reply', 'llm_reply');
  if (strategy.templateSuitable && strategy.templateId) {
    actions.push(`template_${strategy.templateId}`);
  }

  // Classify proposed next stage
  const proposedStage = await classifyProposedNextStage(
    groqInstance,
    session.state,
    config.businessType,
    input.message,
    reply,
    actions
  );

  // Validate state transition
  const validation = validateTransition(
    session.state,
    proposedStage,
    session.loopCount,
    session.stateEnteredAt
  );

  let finalStage = validation.approvedStage;
  let loopCount = validation.resetLoop ? 0 : (proposedStage === session.state ? session.loopCount + 1 : 0);

  if (validation.forceMenu) {
    return await returnHandoff(`[HANDOFF] Loop/timeout limit exceeded.`, actions);
  }

  if (reply.includes('[HANDOFF]') || finalStage === 'handoff') {
    return await returnHandoff(reply, actions);
  }

  session.state = finalStage;
  session.loopCount = loopCount;
  session.lastBotMessage = reply;
  if (finalStage !== stateBefore) {
    session.stateEnteredAt = new Date().toISOString();
  }

  await saveSession(input.supabase, session, config.businessType);

  metrics.addActions(actions).addLlmCall(Date.now() - startTime);
  await emitMetric(input.supabase, metrics.setState(stateBefore, finalStage).build());

  // Phase 4: Track experiment results (fire-and-forget)
  trackRequestExperiments(input.supabase, input.workspaceId, actions, finalStage).catch(() => {});

  // Phase 4: Flush metrics before returning (important for serverless)
  await flushMetrics();

  return {
    shouldReply: true,
    replyText: reply,
    actions,
    stateBefore,
    stateAfter: finalStage,
    debug: {
      requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType,
      chatId: input.chatId, language: detected, dbWriteAttempted, dbWriteSuccess,
      intent: actions[0] || 'fallback_generation', durationMs: Date.now() - startTime
    }
  };
}
