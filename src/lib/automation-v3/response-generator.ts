import OpenAI from 'openai';
import type { LanguageScript } from './templates';

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY || 'mock-key',
});

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
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const text = response.choices[0].message.content?.trim() || '';
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

=== WRITING RULES ===
1. Reply in ${context.requiredLanguageScript} ONLY. Never switch languages mid-message.
2. Keep it SHORT: 1 sentence for quick replies, 2-3 sentences max for complex answers.
3. Sound like a real person texting their friend. NOT corporate. NOT robotic.
4. ${context.workspaceConfig.useEmojis ? 'Use 0-1 emoji only when natural. Never more than 1.' : 'NO emojis. Zero.'}
5. NEVER say "As an AI", "How may I assist you today?", "I am here to help", or "Please let me know"
6. NEVER echo back what the customer said ("You said you want...")
7. NEVER list products as bullet points unless explicitly asked
8. NEVER make up prices, stock numbers, or availability. Only use verified facts above.
9. If you don't know something, say so honestly and offer to connect with a human.
10. If stock is LOW, sound slightly worried FOR them: "only 2 left 😬" — not robotic scarcity
11. If they seem frustrated, acknowledge FIRST: "ugh yeah that's annoying" — then solve
12. If they bought before, reference it CASUALLY: "you got the hoodie last time right?"
13. If they say "inshallah" to buying, they're NOT committed. Stay light. Don't push.
14. If they say "khalas", stop selling. Switch to helpful mode.
15. ${isFranco ? 'Write in Lebanese Franco-Arabic naturally. Mix numbers (3,7,2,5) for Arabic sounds. Example: "hala", "shu", "kif", "mashi", "tayyeb", "baddak", "mabsout", "7elo"' : ''}
16. ${context.requiredLanguageScript === 'arabic' ? 'Write in Arabic script (العربية). Use "حضرتك" for respect if tone is formal.' : ''}

Now write the reply:`;
}
