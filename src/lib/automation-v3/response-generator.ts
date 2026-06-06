import { createProvider } from '@/lib/ai/providers/llm-provider';
import type { LanguageScript } from './templates';

export interface ResponseContext {
  systemInstruction: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>;
  currentState: string;
  customerProfile?: any;
  toolResults: any[];
  requiredLanguageScript: LanguageScript;
  channel: 'instagram' | 'whatsapp';
  strategy: any;
  workspaceConfig: any;
  timeContext: {
    dayName: string;
    isoDate: string;
    isoTime: string;
  };
  fsmContext?: any;
}

export async function generateResponse(
  context: ResponseContext
): Promise<{ text: string; suggestedActions?: string[] }> {
  // Enforce 100% Dynamic LLM Generation using DeepSeek V4 Flash
  const prompt = buildReplyPrompt(context);
  const systemInstruction = buildSystemInstructionWithContext(context);

  try {
    const provider = createProvider();
    // Higher temperature = more natural, less robotic variation
    // Slightly higher maxTokens for Arabic script (Unicode = ~2x token count)
    const isArabicScript = context.requiredLanguageScript === 'arabic';
    const responseText = await provider.complete({
      system: systemInstruction,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      maxTokens: isArabicScript ? 280 : 200,
    });

    let text = responseText.text.trim();
    // Strip [HANDOFF] from LLM output — handoff routing is the orchestrator's job, not the LLM's
    text = text.replace(/\[HANDOFF\]/gi, '').trim();
    text = enforceSentenceLimit(text, 2);
    return { text };
  } catch (error: any) {
    console.error('❌ [Response Gen] DeepSeek text generation failed:', error);
    // Safe fallback message in Franco or English
    const fallbackText = context.requiredLanguageScript === 'franco'
      ? 'Fi moshkle shway, la7za w bijeeb el team ykellmak.'
      : "I'm having a small issue. One moment while I connect you to our staff.";
    return { text: fallbackText };
  }
}

function buildSystemInstructionWithContext(context: ResponseContext): string {
  const fsm = context.fsmContext;
  let fsmContextBlock = '';
  let stateInstruction = '';

  if (fsm) {
    fsmContextBlock = `\nFSM ACTION: ${fsm.actionType} | ${JSON.stringify(fsm.payload)}`;

    // CRITICAL: Prevent LLM from hallucinating order/appointment confirmations
    // when the FSM is only "ready to confirm" (not yet placed).
    if (fsm.actionType === 'info_gathered' && fsm.payload?.isReadyToConfirm) {
      stateInstruction = `
\n=== STATE INSTRUCTION ===
You have ALL the details needed. The order/appointment is NOT placed yet.
Your job: Ask the customer to confirm with "yes" so the system can place it.
NEVER say "order placed", "booked", "confirmed", "done", or "we will deliver".
Instead say something like: "Ready to lock this in? Just say yes and I'll place it."`;
    } else if (fsm.actionType === 'checkout_success' && fsm.payload?.success) {
      stateInstruction = `
\n=== STATE INSTRUCTION ===
The order has been SUCCESSFULLY placed. Confirm to the customer with the order details.
You may now say things like "Done!" or "Order placed."`;
    } else if (fsm.actionType === 'appointment_booked' && fsm.payload?.success) {
      stateInstruction = `
\n=== STATE INSTRUCTION ===
The appointment has been SUCCESSFULLY booked. Confirm to the customer with the booking details.
You may now say things like "Done!" or "You're all set."`;
    } else if (fsm.actionType === 'info_gathered' && fsm.payload?.missingDetails?.length > 0) {
      const missing = fsm.payload.missingDetails.join(', ');
      stateInstruction = `
\n=== STATE INSTRUCTION ===
You are still missing the following details: ${missing}.
Ask the customer ONLY for what's missing. Do NOT ask for details you already have.`;
    }
  }

  return `${context.systemInstruction}
${fsmContextBlock}${stateInstruction}

PERSONA REMINDER:
- Never repeat the exact same greeting or use rigid templates.
- Vary your wording to sound like a natural human rep.
- Match the user's energy. Keep it warm and friendly.`;
}

function buildReplyPrompt(context: ResponseContext): string {
  const s = context.strategy || {
    goal: 'gather_info',
    toneInstruction: context.workspaceConfig.tone || 'Casual',
    customStrategy: 'Interact naturally with the customer to assist them.'
  };
  const isFranco = context.requiredLanguageScript === 'franco' || context.requiredLanguageScript === 'mixed';

  return `You are texting as ${context.workspaceConfig.businessName}'s sales rep.
Date: ${context.timeContext.dayName}, ${context.timeContext.isoDate} at ${context.timeContext.isoTime}
Platform: ${context.channel}
Active Session State: ${context.currentState}

=== STRATEGIST INSTRUCTION ===
Goal: ${s.goal}
Tone: ${s.toneInstruction || 'Casual'}
Strategy: ${s.customStrategy}

=== CUSTOMER ===
${context.customerProfile?.name ? `Name: ${context.customerProfile.name}` : ''}
${context.customerProfile?.totalOrders ? `Past orders: ${context.customerProfile.totalOrders}` : ''}
${s.proactiveSuggestion ? `Proactive suggestion: ${s.proactiveSuggestion}` : ''}

=== CONVERSATION HISTORY (last 4 turns) ===
${context.conversationHistory.slice(-4).map(m => `${m.role}: "${m.content}"`).join('\n')}

=== CUSTOMER'S LATEST MESSAGE ===
"${context.conversationHistory[context.conversationHistory.length - 1]?.content || ''}"

=== VERIFIED FACTS (never contradict these) ===
${context.toolResults.map(r => `- ${r.tool}: ${JSON.stringify(r.result)}`).join('\n') || 'No verified facts'}

${buildWritingRules(context, isFranco)}

Now write the reply:`;
}

function buildWritingRules(context: ResponseContext, isFranco: boolean): string {
  const lang = context.requiredLanguageScript;
  const emojiRule = context.workspaceConfig.useEmojis
    ? 'You may use up to 1 emoji per message, only when it feels natural. EXCEPTION: If the customer is frustrated, angry, or using ALL CAPS, do NOT use any emojis at all — they come across as dismissive and insincere.'
    : 'Do NOT use any emojis. Zero. No exceptions.';
  
  let examples = '';
  if (lang === 'franco') {
    examples = `Good Franco Examples:
- "Hala! 3anna haircuts b $15. Baddak nehjoz la bukra? 💇"
- "B2e bas 2 mn l black hoodie 😬 Baddak yeh?"
- "Ugh bte3zor, la7za w bkhalle 7ada mn l team ye7kike."
Bad Franco Examples:
- "Kif fiyi se3dak lyoum? Ana bot AI hon kermel se3dak."
- "Enta tracking order. 3anna: - Hoodie ($15)"`;
  } else if (lang === 'arabic') {
    examples = `Good Arabic Examples:
- "أهلاً! في قص شعر بـ 15$. بتحب نحجز لبكرة؟ 💇"
- "بقي قطعتين بس من الهودي الأسود 😬 بتحب نأكد الطلب؟"
- "بعتذر منك جداً. لحظة ورح خلي حدا من الفريق يتواصل معك."
Bad Arabic Examples:
- "بصفتي ذكاءً اصطناعيًا، كيف يمكنني مساعدتك اليوم؟"
- "لقد قلت أنك تريد هودي. لدينا: - هودي ($15)"`;
  } else {
    examples = `Good English Examples:
- "Hey! We have haircuts for $15. Want to book for tomorrow? 💇"
- "Only 2 left of the black hoodie 😬 Let me know if you want to grab it!"
- "Ah that's annoying, sorry about that. Let me get someone to help you."
Bad English Examples:
- "As an AI, I am here to help you today. Please let me know how I may assist you."
- "You said you want a haircut. We offer: - Haircut ($15) - Lashes ($20)"`;
  }

  return `=== WRITING RULES ===
1. Reply in ${lang} ONLY. Short (max 2 sentences), texting-style.
2. ${emojiRule}
3. Use verified facts only. Never hallucinate details.
4. Text like a real human friend. No robotic or AI phrases.
${examples}`;
}

const COMMON_ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'inc', 'llc', 'ltd', 'jr', 'sr',
  'e.g', 'i.e', 'etc', 'vs', 'vol', 'vols', 'inc', 'fig', 'figs',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
  'am', 'pm', 'a.m', 'p.m',
  'est', 'pst', 'gmt', 'utc',
  'ft', 'lb', 'kg', 'km', 'mi',
  'no', 'nos', 'nr', 'vol',
  'st', 'ave', 'blvd', 'rd', 'hwy',
  'etc', 'et al', 'ibid', 'op cit',
  'u.s', 'u.k', 'u.n', 'n.a', 'n.b',
  'p.s', 'p.p.s',
]);

/**
 * Split text into sentences while respecting common abbreviations.
 * Returns at most `maxSentences` (default 2), preserving the rest as-is
 * if the limit is not exceeded.
 * Exported for unit testing.
 */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let current = '';
  let i = 0;

  while (i < text.length) {
    current += text[i];

    if (text[i] === '.' || text[i] === '!' || text[i] === '?') {
      // 1. Intra-word check: if the very next character is a letter (no space),
      //    we are mid-abbreviation, e.g. the "e." in "e.g." or "i." in "i.e."
      const nextChar = i + 1 < text.length ? text[i + 1] : '';
      const isIntraWord = /[a-zA-Z]/.test(nextChar);

      // 2. Abbreviation check: look at the word token immediately before the punctuation.
      //    Strip only non-alphanumeric-non-dot so "e.g" stays "e.g" and matches the set.
      const wordBefore = current
        .slice(0, -1)
        .split(/\s+/)
        .pop()
        ?.toLowerCase()
        ?.replace(/[^a-z0-9.]/g, '');
      const isAbbrev = Boolean(wordBefore && COMMON_ABBREVIATIONS.has(wordBefore));

      // 3. Ellipsis check: any adjacent period means we're inside "..."
      const isEllipsis =
        text.slice(i, i + 3) === '...' ||
        (i > 0 && text[i - 1] === '.');

      if (!isIntraWord && !isAbbrev && !isEllipsis) {
        sentences.push(current.trim());
        current = '';
      }
    }
    i++;
  }

  if (current.trim()) {
    sentences.push(current.trim());
  }

  return sentences;
}

/** Exported for unit testing. */
export function enforceSentenceLimit(text: string, maxSentences = 2): string {
  if (!text) return text;
  const sentences = splitSentences(text);
  if (sentences.length > maxSentences) {
    return sentences.slice(0, maxSentences).join(' ');
  }
  return text;
}
