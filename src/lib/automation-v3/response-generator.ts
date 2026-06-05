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
    const responseText = await provider.complete({
      system: systemInstruction,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      maxTokens: 200,
    });

    let text = responseText.text.trim();
    // Strip [HANDOFF] from LLM output — handoff routing is the orchestrator's job, not the LLM's
    text = text.replace(/\[HANDOFF\]/gi, '').trim();
    text = enforceSentenceLimit(text);
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
  const fsmContextBlock = context.fsmContext 
    ? `\n=== DETERMINISTIC FSM EXECUTION CONTEXT ===
FSM Action Type: ${context.fsmContext.actionType}
FSM Payload: ${JSON.stringify(context.fsmContext.payload)}
Use this FSM context to formulate your response. For example:
- If actionType is "order_cancelled", let them know their order (or appointment) was cancelled successfully.
- If actionType is "checkout_success", confirm details of their new order.
- If actionType is "appointment_booked", confirm their appointment time and details.
- If actionType is "info_gathered", use the gathered details and missing details to prompt them for the next step or confirm booking/checkout.
`
    : '';

  return `${context.systemInstruction}
${fsmContextBlock}
=== LEBANESE FRANCO-ARABIC DICTIONARY & BRAND PERSONA RULES ===
1. Local Dictionary Casing & Meanings:
   - "min" translates to "who" (e.g. "min ma3e?" -> "who is with me?"), not just "from".
   - "taleta" represents "Tuesday" (day of week).
   - "tlete" represents the number "three" (3).
2. Dynamic & Varied Greetings:
   - NEVER repeat the exact same greeting or use rigid templates (like "Back again? 😎 What are we getting today?") repeatedly, especially when a transaction completes or resets.
   - Vary your greetings and conversational banter dynamically to sound like a natural human store representative.
   - Match the user's script and energy. Keep it warm and friendly.`;
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
    ? 'Use 0-1 emoji only when natural. Never more than 1.' 
    : 'NO emojis at all.';
  
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

function enforceSentenceLimit(text: string): string {
  if (!text) return text;
  const sentenceRegex = /[^.!?]+(?:[.!?]+|$)/g;
  const matches = text.match(sentenceRegex);
  if (matches && matches.length > 2) {
    return matches.slice(0, 2).join(' ').replace(/\s+/g, ' ').trim();
  }
  return text;
}
