import { generateText, stepCountIs, tool } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import type { AutomationInput, AutomationResult, WorkspaceConfig, ServiceRecord } from '@/lib/ai/types';
import { loadConversationHistory } from '@/lib/ai/history';
import { createAppointmentTools, createEcommerceTools, type ToolContext } from '@/lib/ai/tools';
import { detectLanguage } from '@/lib/ai/language';
import { buildTimeContext } from '@/lib/ai/time';
import { checkRateLimit } from '@/lib/ai/guardrails/rate-limiter';
import { MetricBuilder, emitMetric } from '@/lib/ai/metrics';
import { v2log } from '@/lib/ai/logger';
import { LEBANESE_VOCABULARY, ARABIZI_DICTIONARY } from '@/lib/ai/dictionaries';
import { loadActiveServices } from '@/lib/ai/appointments/services';
import { searchProducts } from '@/lib/ai/ecommerce/products';
import { checkAndProcessSessionSummary, loadRecentSummaries } from '@/lib/ai/memory';
import { verifyAgentReply } from '@/lib/ai/guardrails/reply-verifier';
import { loadSession, saveSession } from '@/lib/ai/session-manager';
import { validateTransition } from '@/lib/ai/state-validator';
import { extractNoteworthyFacts, saveCustomerNotes, loadCustomerNotes } from '@/lib/ai/customer-notes';
import { detectEmotion, buildEmotionPromptBlock } from '@/lib/ai/emotional-intelligence';
import { buildProactiveSuggestions, getNextAvailableSlotSuggestions } from '@/lib/ai/intent-chain';
import { loadCustomerProfile } from '@/lib/ai/customer-profile';
import type { ConversationStage } from '@/lib/ai/types';

// Groq model IDs
const SMART_MODEL = 'llama-3.3-70b-versatile';  // Complex tasks: transactions, tool calls, full agent replies
const SMALL_MODEL = 'llama-3.1-8b-instant';     // Simple tasks: greetings, summaries, classification

function getGroqProvider() {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
        throw new Error('GROQ_API_KEY is missing');
    }

    const groq = createGroq({ apiKey: groqKey });

    return (modelId: string) => groq(modelId);
}

function buildPrompt(
    config: WorkspaceConfig,
    replyLanguage: string,
    ragExamples: {customer_message: string, owner_reply: string}[] | undefined,
    platform: 'instagram' | 'whatsapp',
    skipTools = false,
    services?: ServiceRecord[],
    recentSummaries?: string[],
    session?: any,
    customerNotes?: string[],
    emotionBlock?: string,
    proactiveBlock?: string,
    crossChannelNote?: string
): string {
    const isArabizi = replyLanguage === 'arabizi' || replyLanguage === 'lebanese franco';

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

    const discountRules = config.maxDiscount && config.maxDiscount > 0
        ? `
DISCOUNTS:
- Max discount: ${config.maxDiscount}%${config.minOrderForDiscount ? ` (only on orders above $${config.minOrderForDiscount})` : ''}
- Only offer if they ASK. Never volunteer a discount.
- If they want more than ${config.maxDiscount}%: "Sorry, best price."`
        : `\nDISCOUNTS: None. Prices are fixed. If they ask: "ekhir se3er" / "final price."`;

    // Build a service catalog block for appointment workspaces
    let serviceCatalogBlock = '';
    if (config.businessType === 'appointments' && services && services.length > 0) {
        const serviceLines = services.map(s =>
            `- ${s.name}: $${s.price}, ${s.durationMinutes} min${s.description ? ` — ${s.description}` : ''}`
        ).join('\n');
        serviceCatalogBlock = `\nSERVICES MENU (from database — use these EXACT prices, never make up prices):\n${serviceLines}\n`;
    }

    const toolBlock = skipTools
        ? `TOOLS: None available for this message.
- You CANNOT book appointments, cancel bookings, place orders, or check slot availability right now.
- Do NOT tell the customer their appointment/order is booked, confirmed, or cancelled.
- Do NOT mention any system issues, database, offline status, or technical errors/reasons to the customer.
- Instead, politely ask for any missing details (such as name, phone, date/time, or shipping address) that have not been provided yet in the conversation history, and tell them a staff member will contact them shortly to confirm and finalize it.
- If they ask for location, business hours, or static prices, you may answer them directly using the info below.${serviceCatalogBlock ? '\n' + serviceCatalogBlock : ''}`
        : (config.businessType === 'appointments'
            ? `TOOLS:
- You have full access to database tools. Use them to help the customer.
- Use get_services to look up service names, prices, and durations if not listed below.
- Use check_slot BEFORE confirming any booking.
- Use lookup_customer to check if they've been here before — skip asking info you already have.
- Use book_appointment ONLY after the customer explicitly confirms the date, time, and service.
- Use reschedule_appointment ONLY if the customer has an existing appointment they want to reschedule or modify, and they have confirmed the new date and time.
- If the customer wants to change their appointment time/date, call reschedule_appointment instead of book_appointment to avoid creating duplicates.
- CRITICAL: Never call book_appointment or reschedule_appointment if the conversation history shows that the target appointment at that specific date and time has already been successfully booked or confirmed. Only call booking/rescheduling tools if the customer is requesting a new/different booking or actively rescheduling.
- NEVER say "booked" or "confirmed" unless book_appointment or reschedule_appointment returned success.
- ALWAYS generate a conversational text reply to the customer after using any tool. Never output just a tool call.
- IMPORTANT: Once you have the customer's name, phone, service type, date, and time — call the book_appointment tool immediately. Do NOT hand off to a human agent. Do NOT say "a staff member will contact you." Complete the booking yourself.
- ${platform === 'whatsapp' ? 'On WhatsApp: Use send_booking_flow ONCE when the customer first expresses interest in booking. After sending the booking button, do NOT call send_booking_flow again. If the user clicks the button (their message will be "📅 Book Now" or "Book Now"), respond in TEXT asking which date and time they prefer — do NOT send the button again.' : 'Ask for date/time manually.'}
${serviceCatalogBlock}
CONTEXT RECOVERY:
- If you previously suggested a specific date/time (e.g. "How about tomorrow?" or "What about 3 PM?") and the customer replies with a confirmation like "yeah", "sure", "ok", "yep", "that works", "sounds good", "perfect" — treat their answer as confirming the date/time YOU proposed. Extract it from YOUR previous message and proceed with the booking.
- CRITICAL: Never treat general opening hours or working hours (e.g., "we're open from 9 am to 7 pm") as a proposed date/time slot. You must propose a specific date and time slot (e.g., "today at 3:00 PM") first before treating a user's confirmation as confirming that slot.
- CRITICAL: Do NOT attempt context recovery or book anything if the previous message was already confirming a successful booking.
- Do NOT re-ask for information you already proposed and they confirmed.`
            : `TOOLS:
- You have full access to database tools. You are the orchestrator.
- Use search_products for ANY question about products, prices, or stock.
- Use lookup_customer to check if they've ordered before — skip asking info you already have.
- If you need their address or phone, ask for it naturally. Once you have it, call place_order.
- Use place_order ONLY after the customer explicitly confirms the product and you have their details.
- NEVER say "ordered" or "confirmed" unless place_order returned success.
- Use cancel_order if they want to cancel.
- ${platform === 'whatsapp' ? 'On WhatsApp: Use send_product_card ONCE when the customer asks about a specific product. After sending the product card, do NOT call send_product_card again for the same product. If the user clicks "🛍️ Order Now" or "Order Now", proceed with the order flow in TEXT — ask for their details naturally.' : 'Describe products manually.'}

CONTEXT RECOVERY:
- If you previously suggested something (e.g. a product variant, a delivery option) and the customer replies with a confirmation like "yeah", "sure", "ok", "yep", "that works", "sounds good", "perfect" — treat their answer as confirming what YOU proposed. Extract it from YOUR previous message and proceed.
- Do NOT re-ask for information you already proposed and they confirmed.`);

    let languageBlock: string;
    
    if (skipTools) {
        if (isArabizi || replyLanguage === 'mixed') {
            languageBlock = `LANGUAGE: Reply in Lebanese Arabizi (Latin letters + numbers like 3, 7, 5, 2). Keep sentences very short, brief and friendly. Do NOT write in Arabic script.`;
        } else if (replyLanguage === 'unknown') {
            languageBlock = `LANGUAGE: Reply in English.`;
        } else {
            const langName = replyLanguage.charAt(0).toUpperCase() + replyLanguage.slice(1);
            languageBlock = `LANGUAGE: Reply strictly in ${langName}.`;
        }
    } else {
        // Dynamic dictionary filtering based on business type to save context tokens (Phase 1 Optimization)
        const filteredPhrases = Object.entries(ARABIZI_DICTIONARY).filter(([eng]) => {
            const keyLower = eng.toLowerCase();
            if (config.businessType === 'appointments') {
                // Exclude e-commerce specific keys
                if (keyLower.includes('order') || keyLower.includes('product') || keyLower.includes('variant') || keyLower.includes('shipping') || keyLower.includes('sold out') || keyLower.includes('looking for')) {
                    return false;
                }
            } else if (config.businessType === 'ecommerce') {
                // Exclude appointment specific keys
                if (keyLower.includes('book') || keyLower.includes('appointment') || keyLower.includes('service') || keyLower.includes('slot') || keyLower.includes('working hours') || keyLower.includes('closed on') || keyLower.includes('hourssummary') || keyLower.includes('opentime') || keyLower.includes('closetime') || keyLower.includes('daylabel')) {
                    return false;
                }
            }
            return true;
        });

        const arabiziPhrases = filteredPhrases
            .map(([eng, arabizi]) => `- To say "${eng}" -> say EXACTLY: "${arabizi}"`)
            .join('\n');

        // Dynamic Lebanese vocabulary filtering based on business type (Phase 1 Optimization)
        const vocabLines = LEBANESE_VOCABULARY.trim().split('\n');
        const vocabHeader = vocabLines[0];
        const vocabData = vocabLines.slice(1).filter(line => {
            const parts = line.split(',');
            if (parts.length === 0) return true;
            const cat = parts[0].trim().toLowerCase();
            if (config.businessType === 'appointments' && cat === 'shopping') return false;
            if (config.businessType === 'ecommerce' && cat === 'appointments') return false;
            return true;
        });
        const lebaneseVocab = [vocabHeader, ...vocabData].join('\n');

        if (isArabizi) {
            languageBlock = `
LANGUAGE: Reply in Lebanese Arabizi (Latin letters + numbers like 3, 7, 5, 2).

VOCABULARY (Word by Word):
${lebaneseVocab}

EXACT PHRASING RULES (MANDATORY):
Do NOT translate word-by-word like a robot. You MUST use these exact sentence structures:
${arabiziPhrases}

When in doubt, keep sentences very short and copy the exact formatting from the rules above.`;
        } else if (replyLanguage === 'mixed') {
            languageBlock = `LANGUAGE: Reply in Lebanese Arabizi. Mirror the user's language mix.\nVOCABULARY:\n${lebaneseVocab}\n\nEXACT PHRASES (Use these exact structures):\n${arabiziPhrases}`;
        } else if (replyLanguage === 'unknown') {
            languageBlock = `LANGUAGE: Reply in English.`;
        } else {
            const langName = replyLanguage.charAt(0).toUpperCase() + replyLanguage.slice(1);
            languageBlock = `LANGUAGE: Reply strictly in ${langName}.`;
        }
    }

    if (ragExamples && ragExamples.length > 0) {
        const ragText = ragExamples.map(e => `Customer: "${e.customer_message}"\nYou: "${e.owner_reply}"`).join('\n\n');
        languageBlock += `\n\nEXACT COMMUNICATION STYLE (RAG TRAINING):\nYou must mimic the exact sentence structure, spelling, and tone of these past examples from the business owner:\n${ragText}`;
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
4. NEVER make up prices, stock, or availability. Use tools to check.
5. Do NOT ask for all information at once like a robot. Ask naturally, one or two things at a time.
6. You are HUMAN. Never say you're an AI or bot.
7. When the customer says something casual like "thank you", "thanks", "ok", "cool", "great", "perfect", "merci", "yalla", "shu", "tamam", or any simple acknowledgment — just reply naturally. Do NOT call any tools or create any bookings/orders. These are NOT requests.
8. ONLY reply EXACTLY with [HANDOFF] if the user explicitly asks for a human agent.

${languageBlock}

${toolBlock}
${discountRules}

${config.systemInstructions ? `BUSINESS INFO:\n${config.systemInstructions}` : ''}
${config.storeLocation ? `LOCATION: ${config.storeLocation}` : ''}
${config.contactInfo ? `CONTACT: ${config.contactInfo}` : ''}
${config.businessType === 'ecommerce' && config.shippingRules ? `SHIPPING: ${config.shippingRules}` : ''}`;
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
- 'awaiting_date_time': Service is known, but we are waiting for date/time preference or availability check.
- 'awaiting_customer_details': Service and date/time are known, but we need customer name, phone, or details.
- 'awaiting_booking_confirmation': We have service, date/time, and customer details, and we are asking them to confirm the booking or confirming it.
- 'post_appointment_modify': Customer wants to reschedule, cancel, or modify an existing booking. Keep using this state for the entire cancellation/modification flow; do NOT choose 'awaiting_customer_details', 'awaiting_service', or 'awaiting_date_time' even if collecting details or discussing dates for the cancellation.
- 'handoff': User explicitly asked to talk to a human, the bot cannot help them, or the bot states that a staff member or human will contact or help them shortly.`;

        const ecommerceStages = `For 'ecommerce' business type:
- 'idle': Conversation is completed, cancelled, or reset to start.
- 'awaiting_product': Customer is choosing/discussing which product they want.
- 'awaiting_variant': Product is known, but we are waiting for size, color, or variant choice.
- 'awaiting_order_details': Product/variant is known, but we need customer shipping details (name, phone, address).
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

Choose strictly one of the stage keys listed above (must be a valid string literal like 'awaiting_date_time' or 'awaiting_order_details').
Reply with exactly the stage key name and nothing else.`;

        const classification = await generateText({
            model: groqInstance(SMALL_MODEL),
            system,
            prompt: `Determine next stage. Current stage is ${currentStage}.`,
            temperature: 0,
        });

        let proposed = classification.text?.trim().toLowerCase();
        if (proposed) {
            proposed = proposed.replace(/^['"`\s]+|['"`\s]+$/g, '');
        }
        const validStages = [
            'idle', 'collecting', 'confirming', 'complete', 'handoff',
            'awaiting_product', 'awaiting_variant', 'awaiting_order_details', 'awaiting_checkout_confirmation',
            'awaiting_service', 'awaiting_date_time', 'awaiting_customer_details', 'awaiting_booking_confirmation',
            'post_order_modify', 'post_appointment_modify'
        ];
        if (!proposed || !validStages.includes(proposed)) {
            v2log.warn('STATE_CLASSIFIER', 'Invalid stage classified, defaulting to current stage', { proposed, currentStage });
            return currentStage as ConversationStage;
        }
        return proposed as ConversationStage;
    } catch (e) {
        v2log.warn('STATE_CLASSIFIER', 'Failed to classify next stage, defaulting to current', { error: e });
        return currentStage as ConversationStage;
    }
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

    // 1.5 Load Session Context
    const session = await loadSession(
        input.supabase,
        input.userId,
        input.workspaceId,
        input.chatId,
        config.businessType as 'appointments' | 'ecommerce',
        input.platform
    );
    const stateBefore = session.state;

    // 2. Load History
    const history = await loadConversationHistory(
        input.supabase, input.userId, input.workspaceId, input.chatId
    );

    const groqInstance = getGroqProvider();

    // 2.2 Process and load persistent session summaries (Phase 2 Memory)
    await checkAndProcessSessionSummary(
        input.supabase,
        groqInstance,
        input.workspaceId,
        input.chatId,
        input.userId,
        input.platform
    );

    const recentSummaries = await loadRecentSummaries(
        input.supabase,
        input.workspaceId,
        input.chatId,
        3
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
        : createEcommerceTools(toolCtx);
            
    const wrappedTools = Object.fromEntries(
        Object.entries(rawTools).map(([name, def]: [string, any]) => {
            // Support both 'parameters' (V2 style) and 'inputSchema' (V3/V4 style)
            const schema = def.inputSchema || def.parameters;
            return [name, tool({
                ...def,
                parameters: schema // Vercel AI SDK internally might still use 'parameters' in some contexts, but tool() helper handles it
            } as any)];
        })
    );

    // 2.5 Load RAG Examples & Customer details (Phase 1 Dynamic RAG Optimization)
    const { data: rawExamples } = await input.supabase
        .from('business_training_data')
        .select('customer_message, owner_reply')
        .eq('workspace_id', input.workspaceId)
        .order('created_at', { ascending: false })
        .limit(50);

    // Compute simple word overlap similarity to select the most relevant examples
    const computeOverlap = (s1: string, s2: string): number => {
        const w1 = new Set(s1.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean));
        const w2 = new Set(s2.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean));
        let match = 0;
        w1.forEach(w => { if (w2.has(w)) match++; });
        return match;
    };

    const scoredExamples = (rawExamples || []).map((ex: any) => ({
        ex,
        score: computeOverlap(ex.customer_message || '', input.message || '')
    })).sort((a: any, b: any) => b.score - a.score);

    const ragExamples = scoredExamples.slice(0, 4).map((se: any) => se.ex);

    // Phase 2 Optimization: Frontline Classifier Routing
    let route: 'simple' | 'transaction' = 'transaction';
    if (session.state === 'idle') {
        try {
            const classification = await generateText({
                model: groqInstance(SMALL_MODEL),
                system: `You are an AI router. Categorize if the customer message requires querying or modifying live database tables.
Categories:
- "transaction": Customer wants to book an appointment, check slot availability, search products, check stock/availability of products, ask about prices, ask how much something costs, ask how long a service takes, ask about duration, order products, cancel an order, check order status, mentions a specific date or time (e.g. "today", "tomorrow", "3pm", "next week"), or says they want to book/reserve/schedule.
- "simple": ONLY pure greetings (hi, hello, hey), pure thanks (thanks, thank you, merci, shukran), or basic casual chat that has NOTHING to do with services, products, booking, or prices.
When in doubt, always choose "transaction".
Reply with exactly one word: "simple" or "transaction".`,
                prompt: `Customer message: "${input.message}"`,
                temperature: 0,
            });

            const ans = classification.text?.trim().toLowerCase() || '';
            if (ans.includes('simple')) {
                route = 'simple';
            }
        } catch (classifyErr) {
            v2log.warn('CLASSIFIER', 'Classifier routing failed, defaulting to transaction', { error: classifyErr });
        }
    }

    const { getKnownCustomerDetails } = await import('@/lib/ai/customer-history');
    const customer = await getKnownCustomerDetails(input.supabase, input.workspaceId, input.chatId);

    const customerBlock = customer && (customer.name || customer.phone || customer.address)
        ? `\nKNOWN CUSTOMER DETAILS:\n- Name: ${customer.name || 'Unknown'}\n- Phone: ${customer.phone || 'Unknown'}\n- Address: ${customer.address || 'Unknown'}\n(Do NOT ask the customer for their name, phone, or address if you already know it. Skip asking and proceed with checkout/booking directly.)`
        : '';

    const messages: any[] = [
        {
            role: 'system',
            content: `Current context:\nDate: ${timeCtx.dayName}, ${timeCtx.isoDate} at ${timeCtx.isoTime}.${customerBlock}`
        },
        ...history,
        { role: 'user', content: input.message },
    ];

    // Pre-load services for appointment workspaces (used by both routes)
    let activeServices: ServiceRecord[] | undefined;
    if (config.businessType === 'appointments') {
        try {
            activeServices = await loadActiveServices(input.supabase, input.workspaceId);
        } catch (e) {
            v2log.warn('V3_AGENT', 'Failed to pre-load services', { error: e });
        }
    }

    // Pre-load products for ecommerce workspaces (used by both routes)
    let activeProducts: any[] | undefined;
    if (config.businessType === 'ecommerce') {
        try {
            activeProducts = await searchProducts({
                supabase: input.supabase,
                workspaceId: input.workspaceId,
                limit: 50
            });
        } catch (e) {
            v2log.warn('V3_AGENT', 'Failed to pre-load products', { error: e });
        }
    }

    // Phase 3: Load Customer Memory Notes
    let customerNotes: string[] = [];
    try {
        customerNotes = await loadCustomerNotes(input.supabase, input.workspaceId, input.chatId, 10);
    } catch (e) {
        v2log.warn('V3_AGENT', 'Failed to load customer notes', { error: e });
    }

    // Phase 3: Emotion Detection (rule-based, no LLM call)
    const emotionSignal = detectEmotion(input.message, history);
    const emotionBlock = buildEmotionPromptBlock(emotionSignal);

    // Phase 3: Early handoff escalation for frustrated + looping customers
    if (emotionSignal.sentiment === 'frustrated' && session.loopCount >= 2) {
        v2log.info('V3_AGENT', 'Frustrated customer with loops detected, forcing early handoff', {
            loopCount: session.loopCount,
            triggers: emotionSignal.triggers,
        });
        session.state = 'handoff';
        session.loopCount = 0;
        session.lastBotMessage = '[HANDOFF] Frustrated customer escalated to human agent.';
        session.stateEnteredAt = new Date().toISOString();

        await input.supabase.from('conversation_states').upsert({
            user_id: input.userId,
            workspace_id: input.workspaceId,
            workspace_type: input.workspaceType,
            external_chat_id: input.chatId,
            chat_id: input.chatId,
            is_muted: true,
            stage: 'handoff',
            platform: input.platform.toUpperCase(),
            data: {
                ...(session.data || {}),
                loopCount: 0,
                lastBotMessage: session.lastBotMessage,
                stateEnteredAt: session.stateEnteredAt,
                emotionTriggers: emotionSignal.triggers,
            },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,workspace_id,chat_id,workspace_type,platform' });

        try {
            const { createHandoff, determineHandoffPriority } = await import('@/lib/ai/guardrails/handoff-manager');
            const { getKnownCustomerDetails } = await import('@/lib/ai/customer-history');
            const known = await getKnownCustomerDetails(input.supabase, input.workspaceId, input.chatId);
            const recent = history.slice(-5).map(m => ({
                role: m.role,
                content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
            }));
            const priority = determineHandoffPriority('frustration_stop', session.loopCount, false, emotionSignal.sentiment);
            await createHandoff(input.supabase, {
                workspaceId: input.workspaceId,
                chatId: input.chatId,
                platform: input.platform,
                priority,
                reason: 'frustration_stop',
                conversationSummary: `Customer is frustrated (triggers: ${emotionSignal.triggers.join(', ')}). Loop count was ${session.loopCount}.`,
                customerName: known?.name || undefined,
                customerPhone: known?.phone || undefined,
                recentMessages: recent,
                currentState: stateBefore,
                actionsTaken: ['emotion_frustration_detected', 'early_handoff'],
            });
        } catch (e) {
            v2log.warn('AGENT', 'Failed to create emotion-escalated handoff', { error: e });
        }

        const handoffReply = replyLang === 'arabizi'
            ? 'L7aza, 3am nwaslak ma3 7ada mn l team.'
            : 'Connecting you to a human agent shortly...';

        return {
            shouldReply: true,
            replyText: handoffReply,
            actions: ['handoff', 'emotion_frustration_escalation'],
            stateBefore,
            stateAfter: 'handoff',
            debug: {
                requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType as any,
                chatId: input.chatId, language: detected, dbWriteAttempted: true, dbWriteSuccess: true,
                intent: 'frustration_handoff', durationMs: Date.now() - startTime
            }
        };
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
        v2log.warn('V3_AGENT', 'Failed to build proactive suggestions', { error: e });
    }

    // Phase 3: Cross-Channel Identity Context
    let crossChannelNote = '';
    try {
        const profile = await loadCustomerProfile(input.supabase, input.workspaceId, input.chatId, input.platform);
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
        v2log.warn('V3_AGENT', 'Failed to load cross-channel profile', { error: e });
    }

    try {
        let result: any;
        if (route === 'simple') {
            const system = buildPrompt(config, replyLang, ragExamples, input.platform, true, activeServices, recentSummaries, session, customerNotes, emotionBlock, proactiveBlock, crossChannelNote);
            try {
                v2log.info('V3_AGENT', `Routing simple message to fast model ${SMALL_MODEL}`, { message: input.message });
                result = await generateText({
                    model: groqInstance(SMALL_MODEL),
                    system,
                    messages,
                    temperature: 0.3,
                });
            } catch (simpleModelErr) {
                v2log.warn('V3_AGENT', 'Fast model failed, escalating to smart model', { error: simpleModelErr });
                route = 'transaction';
            }
        }

        if (route === 'transaction') {
            const system = buildPrompt(config, replyLang, ragExamples, input.platform, false, activeServices, recentSummaries, session, customerNotes, emotionBlock, proactiveBlock, crossChannelNote);
            try {
                result = await generateText({
                    model: groqInstance(SMART_MODEL),
                    system,
                    messages,
                    tools: wrappedTools,
                    stopWhen: stepCountIs(5),
                    temperature: 0.3,
                });
            } catch (primaryErr: any) {
                const isRateLimit = 
                    primaryErr.statusCode === 429 || 
                    (primaryErr.message && (
                        primaryErr.message.toLowerCase().includes('rate limit') || 
                        primaryErr.message.includes('429')
                    ));

                if (isRateLimit) {
                    v2log.warn('V3_AGENT', `Smart model ${SMART_MODEL} rate-limited (429), bypassing retry and falling back immediately to tool-less small model`, { error: primaryErr.message });
                    const fallbackSystem = buildPrompt(config, replyLang, ragExamples, input.platform, true, activeServices, recentSummaries, session, customerNotes, emotionBlock, proactiveBlock, crossChannelNote);
                    result = await generateText({
                        model: groqInstance(SMALL_MODEL),
                        system: fallbackSystem,
                        messages,
                        temperature: 0.3,
                    });
                } else {
                    v2log.warn('V3_AGENT', `Smart model ${SMART_MODEL} failed, retrying...`, { error: primaryErr.message });
                    try {
                        // Retry #1: same smart model WITH tools (handles transient errors)
                        result = await generateText({
                            model: groqInstance(SMART_MODEL),
                            system,
                            messages,
                            tools: wrappedTools,
                            stopWhen: stepCountIs(5),
                            temperature: 0.3,
                        });
                    } catch (retryErr: any) {
                        v2log.warn('V3_AGENT', `Retry with tools also failed, falling back to tool-less mode with small model`, { error: retryErr.message });
                        // Retry #2: tool-less mode with small model as last resort
                        const fallbackSystem = buildPrompt(config, replyLang, ragExamples, input.platform, true, activeServices, recentSummaries, session, customerNotes, emotionBlock, proactiveBlock, crossChannelNote);
                        result = await generateText({
                            model: groqInstance(SMALL_MODEL),
                            system: fallbackSystem,
                            messages,
                            temperature: 0.3,
                        });
                    }
                }
            }
        }

        let reply = result.text?.trim() || '';
        const actions: string[] = [];
        let dbWriteAttempted = false;
        let dbWriteSuccess = false;

        // Process tool execution results first
        for (const step of result.steps || []) {
            for (const tr of step.toolResults || []) {
                const toolName = (tr as any).toolName as string;
                const data = (tr as any).result ?? (tr as any).output;
                
                v2log.info('AGENT', `Tool Executed: ${toolName}`, { result: JSON.stringify(data)?.slice(0, 100) });

                if (['book_appointment', 'place_order', 'cancel_appointment', 'cancel_order', 'reschedule_appointment'].includes(toolName)) {
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

        // Check for active/upcoming bookings or pending/confirmed orders in DB to prevent false positives in verifier
        let hasActiveBooking = false;
        let hasActiveOrder = false;

        if (config.businessType === 'appointments') {
            try {
                const today = new Date().toISOString().split('T')[0];
                const { data } = await input.supabase
                    .from('appointments')
                    .select('id')
                    .eq('workspace_id', input.workspaceId)
                    .or(`chat_id.eq.${input.chatId},instagram_user_id.eq.${input.chatId}`)
                    .in('status', ['confirmed', 'pending', 'Confirmed', 'Pending'])
                    .gte('appointment_date', today)
                    .limit(1);
                if (data && data.length > 0) {
                    hasActiveBooking = true;
                }
            } catch (e) {
                v2log.warn('V3_AGENT', 'Failed to check active bookings', { error: e });
            }
        } else if (config.businessType === 'ecommerce') {
            try {
                const { data } = await input.supabase
                    .from('orders')
                    .select('id')
                    .eq('workspace_id', input.workspaceId)
                    .or(`chat_id.eq.${input.chatId},instagram_user_id.eq.${input.chatId}`)
                    .in('status', ['pending', 'confirmed', 'processing', 'Pending', 'Confirmed', 'Processing'])
                    .limit(1);
                if (data && data.length > 0) {
                    hasActiveOrder = true;
                }
            } catch (e) {
                v2log.warn('V3_AGENT', 'Failed to check active orders', { error: e });
            }
        }

        // Post-Generation Safety Reply Verification (Phase 2)
        if (config.businessType === 'appointments') {
            const serviceInfoList = (activeServices || []).map(s => ({
                name: s.name,
                price: s.price,
                durationMinutes: s.durationMinutes
            }));
            const verifyResult = verifyAgentReply(reply, actions, serviceInfoList, 'appointments', hasActiveBooking, false);
            if (!verifyResult.verified) {
                reply = verifyResult.correctedReply;
                for (const violation of verifyResult.violations) {
                    const code = violation.split(':')[0].trim();
                    actions.push(`violation_${code}`);
                }
            }
        } else if (config.businessType === 'ecommerce') {
            const productInfoList = (activeProducts || []).map(p => ({
                name: p.itemName,
                price: p.price,
                stockLevel: p.stockLevel
            }));
            const verifyResult = verifyAgentReply(reply, actions, productInfoList, 'ecommerce', false, hasActiveOrder);
            if (!verifyResult.verified) {
                reply = verifyResult.correctedReply;
                for (const violation of verifyResult.violations) {
                    const code = violation.split(':')[0].trim();
                    actions.push(`violation_${code}`);
                }
            }
        }

        // FSM Stage Classification & Transition Validation (Phase 2)
        const proposedStage = await classifyProposedNextStage(
            groqInstance,
            session.state,
            config.businessType as 'appointments' | 'ecommerce',
            input.message,
            reply,
            actions
        );

        const validation = validateTransition(
            session.state,
            proposedStage,
            session.loopCount,
            session.stateEnteredAt
        );

        let finalStage = validation.approvedStage;
        let loopCount = validation.resetLoop ? 0 : (proposedStage === session.state ? session.loopCount + 1 : 0);

        if (validation.forceMenu) {
            reply = `[HANDOFF] ${validation.reason || 'Loop/timeout limit exceeded.'}`;
            finalStage = 'handoff';
            loopCount = 0;
        }

        // Handoff check and processing
        if (reply.includes('[HANDOFF]') || finalStage === 'handoff') {
            session.state = 'handoff';
            session.loopCount = 0;
            session.lastBotMessage = reply;
            session.stateEnteredAt = new Date().toISOString();

            await input.supabase.from('conversation_states').upsert({
                user_id: input.userId,
                workspace_id: input.workspaceId,
                workspace_type: input.workspaceType,
                external_chat_id: input.chatId,
                chat_id: input.chatId,
                is_muted: true,
                stage: 'handoff',
                platform: input.platform.toUpperCase(),
                data: {
                    ...(session.data || {}),
                    loopCount: 0,
                    lastBotMessage: reply,
                    stateEnteredAt: session.stateEnteredAt,
                    postContext: session.postContext
                },
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,workspace_id,chat_id,workspace_type,platform' });

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
                    conversationSummary: 'Customer requested human agent.',
                    customerName: known?.name || undefined,
                    customerPhone: known?.phone || undefined,
                    recentMessages: recent,
                    currentState: 'idle',
                    actionsTaken: actions
                });
            } catch (e) {
                v2log.warn('AGENT', 'Failed to auto-create handoff queue entry', { error: e });
            }

            const handoffReply = replyLang === 'arabizi'
                ? 'L7aza, 3am nwaslak ma3 7ada mn l team.'
                : 'Connecting you to a human agent shortly...';

            return {
                shouldReply: true,
                replyText: handoffReply,
                actions: ['handoff'],
                stateBefore,
                stateAfter: 'handoff',
                debug: {
                    requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType as any,
                    chatId: input.chatId, language: detected, dbWriteAttempted: true, dbWriteSuccess: true,
                    intent: 'handoff', durationMs: Date.now() - startTime
                }
            };
        }

        // Save normal session
        session.state = finalStage;
        session.loopCount = loopCount;
        session.lastBotMessage = reply;
        if (finalStage !== stateBefore) {
            session.stateEnteredAt = new Date().toISOString();
        }

        await saveSession(
            input.supabase,
            input.userId,
            input.workspaceId,
            input.chatId,
            config.businessType as 'appointments' | 'ecommerce',
            session,
            input.platform
        );

        // Phase 3: Extract and save customer memory notes (fire-and-forget)
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
            // Non-critical — don't block the response
        }

        metrics.addActions(actions).addLlmCall(Date.now() - startTime);
        await emitMetric(input.supabase, metrics.setState(stateBefore, finalStage).build());

        return {
            shouldReply: true,
            replyText: reply,
            actions: actions.length > 0 ? actions : ['llm_reply'],
            stateBefore,
            stateAfter: finalStage,
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
            stateBefore,
            stateAfter: stateBefore,
            debug: {
                requestId, engineVersion: 'v3-agent', workspaceId: input.workspaceId, workspaceType: config.businessType as any,
                chatId: input.chatId, language: detected, dbWriteAttempted: false, dbWriteSuccess: false,
                intent: 'error', durationMs: Date.now() - startTime
            }
        };
    }
}
