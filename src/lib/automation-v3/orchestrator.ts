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

// Phase 4 Intelligence imports
import { compressConversationHistory } from './memory-compressor';
import { getVariant, isFeatureEnabled, trackRequestExperiments } from './experiments';
import { flushMetrics } from '@/lib/ai/metrics';

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

async function executeTool(
  toolName: string,
  message: string,
  entities: Record<string, any>,
  toolCtx: any
): Promise<any> {
  const timeCtx = buildTimeContext(toolCtx.config.timezone);

  if (toolName === 'search_products' || toolName === 'check_stock') {
    const { searchProducts } = await import('@/lib/ai/ecommerce/products');
    const query = entities.productName || toolCtx.session?.data?.productName || message;
    const products = await searchProducts({ supabase: toolCtx.supabase, workspaceId: toolCtx.workspaceId, query });
    return {
      products: products.map(p => ({
        name: p.itemName,
        price: p.price,
        inStock: p.stockLevel > 0,
        stock: p.stockLevel,
        colors: (p as any).colors || undefined,
        sizes: (p as any).sizes || undefined,
        variants: p.variants || []
      })),
      count: products.length
    };
  }

  if (toolName === 'get_business_hours') {
    const { loadBusinessHours } = await import('@/lib/ai/appointments/hours');
    const hours = await loadBusinessHours(toolCtx.supabase, toolCtx.workspaceId);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return { hours: hours.map(h => ({ day: dayNames[h.dayOfWeek], isOpen: h.isOpen, open: h.isOpen ? formatTime12(h.openTime) : null, close: h.isOpen ? formatTime12(h.closeTime) : null })) };
  }

  if (toolName === 'check_slot') {
    const { loadActiveServices, findBestServiceMatch } = await import('@/lib/ai/appointments/services');
    const { checkAvailability } = await import('@/lib/ai/appointments/availability');
    const { loadBusinessHours } = await import('@/lib/ai/appointments/hours');
    const services = await loadActiveServices(toolCtx.supabase, toolCtx.workspaceId);
    const serviceName = entities.serviceName || toolCtx.session?.data?.serviceName || '';
    const match = findBestServiceMatch(services, serviceName);
    if (!match) return { available: false, reason: 'service_not_found', services_available: services.map(s => s.name) };

    const date = resolveDateFromMessage(message, timeCtx);
    const time = resolveTimeFromMessage(message);
    if (!date || !time) {
      return { available: false, reason: 'missing_date_time', message: 'Preferred date and time are missing from message.' };
    }

    const hours = await loadBusinessHours(toolCtx.supabase, toolCtx.workspaceId);
    const r = await checkAvailability({ supabase: toolCtx.supabase, workspaceId: toolCtx.workspaceId, date, startTime: time, durationMinutes: match.durationMinutes, businessHours: hours });
    if (r.available) return { available: true, service: match.name, price: match.price, duration: match.durationMinutes, date, time: formatTime12(time) };
    return { available: false, reason: r.reason || 'overlap', message: 'Slot taken' };
  }

  if (toolName === 'get_services') {
    const { loadActiveServices } = await import('@/lib/ai/appointments/services');
    const services = await loadActiveServices(toolCtx.supabase, toolCtx.workspaceId);
    return {
      services: services.map(s => ({
        name: s.name,
        price: s.price,
        duration: s.durationMinutes,
        description: s.description || null
      })),
      count: services.length
    };
  }

  if (toolName === 'lookup_customer') {
    const { getKnownCustomerDetails } = await import('@/lib/ai/customer-history');
    const known = await getKnownCustomerDetails(toolCtx.supabase, toolCtx.workspaceId, toolCtx.chatId);
    if (!known) return { found: false };
    return { found: true, name: known.name, phone: known.phone, address: known.address };
  }

  if (toolName === 'send_booking_flow') {
    const { loadActiveServices, findBestServiceMatch } = await import('@/lib/ai/appointments/services');
    const services = await loadActiveServices(toolCtx.supabase, toolCtx.workspaceId);
    const match = findBestServiceMatch(services, entities.serviceName || '');
    if (!match) return { success: false, error: 'Service not found' };

    const isSimulator = toolCtx.chatId.startsWith('sim_') || toolCtx.chatId.includes('simulator');
    if (isSimulator) {
      return { success: true, message: `Sent booking flow for ${match.name} (Simulated)` };
    }

    const { data: ws } = await toolCtx.supabase.from('ai_settings').select('whatsapp_booking_flow_id, whatsapp_phone_number_id, whatsapp_access_token').eq('id', toolCtx.workspaceId).maybeSingle();
    if (!ws?.whatsapp_phone_number_id || !ws?.whatsapp_access_token) return { success: false, error: 'WhatsApp credentials missing' };

    const creds = { phoneNumberId: ws.whatsapp_phone_number_id, accessToken: ws.whatsapp_access_token };
    if (ws.whatsapp_booking_flow_id) {
      const { sendFlow } = await import('@/lib/whatsapp/send');
      await sendFlow(
        creds,
        toolCtx.chatId,
        ws.whatsapp_booking_flow_id,
        `book_${match.id}_${Date.now()}`,
        `📅 Ready to book your *${match.name}*?\n\nTap below to open the booking form and select a time!`,
        'Book Appointment',
        'BOOKING_DETAILS',
        { service_id: match.id, service_name: match.name },
        toolCtx.config.businessName || 'Booking',
        'Powered by GhostAgent'
      );
      return { success: true, message: `Sent native booking flow for ${match.name}` };
    }
    return { success: false, error: 'Flow ID missing' };
  }

  if (toolName === 'send_product_card') {
    if (toolCtx.platform !== 'whatsapp') return { success: false, error: 'Only available on WhatsApp' };

    const { searchProducts, findBestProductMatch } = await import('@/lib/ai/ecommerce/products');
    const productQuery = entities.productName || toolCtx.session?.data?.productName || '';
    const products = await searchProducts({ supabase: toolCtx.supabase, workspaceId: toolCtx.workspaceId, query: productQuery });
    const match = findBestProductMatch(products, productQuery);
    if (!match) return { success: false, error: 'Product not found' };

    const isSimulator = toolCtx.chatId.startsWith('sim_') || toolCtx.chatId.includes('simulator');
    if (isSimulator) {
      return { success: true, message: `Sent product card for ${match.itemName} (Simulated)` };
    }

    const { data: ws } = await toolCtx.supabase.from('ai_settings').select('whatsapp_catalog_id, whatsapp_phone_number_id, whatsapp_access_token').eq('id', toolCtx.workspaceId).maybeSingle();
    if (!ws?.whatsapp_phone_number_id || !ws?.whatsapp_access_token) return { success: false, error: 'WhatsApp credentials missing' };

    if (!ws.whatsapp_catalog_id) {
      const { sendButtons } = await import('@/lib/whatsapp/send');
      await sendButtons(
        { phoneNumberId: ws.whatsapp_phone_number_id, accessToken: ws.whatsapp_access_token },
        toolCtx.chatId,
        `🛍️ *${match.itemName}*\n\nPrice: *$${match.price}*\nStock: ${match.stockLevel > 0 ? '✅ In Stock' : '❌ Out of Stock'}\n\nTap below if you'd like to order!`,
        [{ id: `buy_now_${match.id}`, title: '🛍️ Order Now' }],
        match.itemName,
        'Powered by GhostAgent'
      );
      return { success: true, message: `Sent product details button (Catalog fallback) for ${match.itemName}` };
    }

    const { sendSingleProductCard } = await import('@/lib/whatsapp/catalog');
    await sendSingleProductCard(
      { phoneNumberId: ws.whatsapp_phone_number_id, accessToken: ws.whatsapp_access_token },
      toolCtx.chatId,
      ws.whatsapp_catalog_id,
      match.id
    );
    return { success: true, message: `Sent product card for ${match.itemName}` };
  }

  return null;
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

  const runFSMAndGenerateResponse = async (fsmRes: any): Promise<AutomationResult> => {
    const validation = validateTransition(stateBefore, fsmRes.nextState as any, session.loopCount, session.stateEnteredAt);
    let finalState = validation.approvedStage;
    let loopCount = validation.resetLoop ? 0 : (fsmRes.nextState === stateBefore ? session.loopCount + 1 : 0);

    if (validation.forceMenu) {
      return await returnHandoff(`[HANDOFF] Loop/timeout limit exceeded.`, fsmRes.actions);
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
      crossChannelNote
    );

    const responseGenResult = await generateResponse({
      systemInstruction: systemPrompt,
      conversationHistory: history.map(h => ({
        role: h.role,
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
      fsmContext: fsmRes.context
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
      stateBefore,
      stateAfter: finalState,
      debug: {
        requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType,
        chatId: input.chatId, language: detected, dbWriteAttempted: fsmRes.dbWriteAttempted, dbWriteSuccess: fsmRes.dbWriteSuccess,
        intent: responseActions[0] || 'fsm_flow', durationMs: Date.now() - startTime
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

    return await runFSMAndGenerateResponse(fsmRes);
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
    return await runFSMAndGenerateResponse(fsmRes);
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
    return await runFSMAndGenerateResponse(fsmRes);
  }

  if (config.businessType === 'appointments' && (isCancelAppt || isReschedAppt)) {
    session.state = 'post_appointment_modify';
    session.stateEnteredAt = new Date().toISOString();
    const fsmRes = await runAppointmentFSM(input.message, session, config, input.supabase);
    return await runFSMAndGenerateResponse(fsmRes);
  }

  // 8. HUMAN HANDOFF INTENT
  if (intent === 'human_handoff' || intent === 'frustration_stop') {
    return await returnHandoff('[HANDOFF] Customer requested human.', []);
  }

  // 9. FALLBACK DECOUPLED PIPELINE (Thinking Layer -> Executing Tools -> Response Generator)
  v2log.info('ORCHESTRATOR', 'Running Inverted Fallback Pipeline: Thinking Layer first');

  // Step 1: Execute Strategy/Thinking layer
  const strategy = await runThinkingLayer(
    input.message,
    session,
    detected,
    [], // Pass empty tool results first
    config
  );

  // Step 2 & 3: Read toolsNeeded and execute tools sequentially
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

  for (const toolName of strategy.toolsNeeded) {
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
    crossChannelNote
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
        saveCustomerNotes(input.supabase, input.workspaceId, input.chatId, input.platform, notes).catch(() => {});
      }
    }).catch(() => {});
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

  if (validation.forceMenu) {
    return await returnHandoff(`[HANDOFF] Loop/timeout limit exceeded.`, actions);
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
