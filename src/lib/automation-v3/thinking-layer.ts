import OpenAI from 'openai';

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY || 'mock-key',
});

export interface ThinkingResult {
  intentAnalysis: string;
  emotion: 'excited' | 'hesitant' | 'frustrated' | 'confused' | 'neutral' | 'angry' | 'rushed';
  goal: 'close_sale' | 'reassure' | 'de_escalate' | 'gather_info' | 'redirect_human' | 'build_rapport' | 'recover_abandoned';
  knownFacts: string[];
  unknownGaps: string[];
  templateSuitable: boolean;
  templateId?: string;
  customStrategy: string;
  toneInstruction: string;
  shouldHandoff: boolean;
  handoffReason?: string;
  proactiveSuggestion?: string;
  culturalNotes: string;
}

export interface ToolResult {
  tool: string;
  result: any;
}

// System prefix to leverage prompt caching (identical across runs)
export const CACHED_SYSTEM_PREFIX = `You are the internal strategist for a business.
You analyze customer messages and decide how the sales rep should reply.
You are NOT the sales rep. You are the strategist behind the scenes.

=== CULTURAL RULES FOR LEBANON ===
- Franco-Arabic users are young, casual, prefer speed
- "Yalla" = urgency, not rudeness
- "Inshallah" = soft no / maybe — don't push
- "Khalas" = final decision — stop selling
- Arabic script users may prefer "حضرتك" for respect
- Religious phrases are courtesies, not commitments

=== STRATEGY RULES ===
1. What is the REAL intent?
2. What emotion is the user feeling?
3. What is our GOAL in this exact message?
4. What do we KNOW vs NOT know?
5. Should we use template or custom text?
6. If stock LOW (≤3), create honest urgency
7. If RETURNING customer, reference casually
8. If sentiment DECLINING, de-escalate first
9. If loopCount ≥ 2, suggest menu/reset
10. If HESITANT, offer social proof or guarantee
11. If "inshallah" to buying = NOT committed
12. If "khalas" = stop selling immediately
13. VIP (3+ orders or $500+) = white-glove treatment`;

export async function runThinkingLayer(
  message: string,
  session: any,
  detectedLanguage: string,
  toolResults: ToolResult[],
  workspaceConfig: any
): Promise<ThinkingResult> {
  const customer = session.customerProfile;
  const isFranco = detectedLanguage === 'franco' || detectedLanguage === 'mixed' || detectedLanguage === 'arabizi';

  const dynamicPrompt = `You are the internal strategist for "${workspaceConfig.businessName}".
Analyze the customer message and decide EXACTLY how the sales rep should reply.

=== CUSTOMER CONTEXT ===
Name: ${customer?.name || 'Unknown'}
Total orders: ${customer?.totalOrders || 0}
Total appointments: ${customer?.totalAppointments || 0}
Last interaction: ${session.lastInteractionAt || 'Never'}
Tags: ${customer?.tags?.join(', ') || 'none'}

=== CONVERSATION STATE ===
Current stage: ${session.state}
Loop count: ${session.loopCount}
Last bot message: ${session.lastBotMessage || 'None'}

=== USER MESSAGE ===
"${message}"

=== LANGUAGE SCRIPT ===
Detected language: ${detectedLanguage}

=== TOOL RESULTS (verified facts only) ===
${toolResults.map(r => `- ${r.tool}: ${JSON.stringify(r.result)}`).join('\n') || 'No tool results'}

=== CULTURAL CONTEXT ===
${isFranco ? `This user writes in Lebanese Franco-Arabic (Arabizi).
Cultural rules:
- They are likely young, casual, prefer speed over formality
- "Yalla" means urgency, not rudeness
- "Inshallah" often means "maybe" or soft no — don't push hard
- "Khalas" means final decision — stop selling immediately
- "Shou" / "Shu" = "what"
- "Baddak" = "you want"
- "Mashi" = "okay / fine"
- "Tayyeb" = "okay / good"
- They appreciate humor and casual banter
- Mixing English words naturally is expected` : ''}

${detectedLanguage === 'arabic' ? `This user writes in Arabic script.
Cultural rules:
- May prefer more formal tone, use "حضرتك" (your honor) for respect
- Older demographic possible
- Clear, direct answers appreciated
- Religious phrases ("الحمدلله", "إن شاء الله") are common courtesies, not binding commitments` : ''}

=== STRATEGY RULES ===
1. What is the REAL intent? (Look past literal words)
2. What emotion is the user feeling? Be specific.
3. What is our GOAL in this exact message? Choose ONE primary goal.
4. What do we KNOW vs what do we NOT know? Never make up facts.
5. Should we use a pre-written template or generate custom text?
6. If stock is LOW (≤3 items), create urgency but be honest.
7. If user is RETURNING (bought before), reference it casually.
8. If sentiment is DECLINING or NEGATIVE, de-escalate first, sell second.
9. If loopCount ≥ 2, suggest menu/reset instead of repeating.
10. If user seems HESITANT, offer social proof or guarantee.
11. If user says "inshallah" to a purchase, they are NOT committed. Stay light.
12. If user is a VIP (3+ orders or $500+ spent), give white-glove treatment.

=== RESPONSE FORMAT (JSON ONLY) ===
{
  "intentAnalysis": "Detailed analysis of what user really wants",
  "emotion": "excited|hesitant|frustrated|confused|neutral|angry|rushed",
  "goal": "close_sale|reassure|de_escalate|gather_info|redirect_human|build_rapport|recover_abandoned",
  "knownFacts": ["fact 1", "fact 2"],
  "unknownGaps": ["missing info 1"],
  "templateSuitable": true,
  "templateId": "scarcity_urgent|returning_customer|frustration_acknowledge|hesitant_nudge|greeting|...",
  "customStrategy": "Specific tactical instruction for the writer",
  "toneInstruction": "exact tone and style description",
  "shouldHandoff": false,
  "handoffReason": "",
  "proactiveSuggestion": "Optional: suggest next product/service based on history",
  "culturalNotes": "Any cultural adjustments needed"
}`;

  try {
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: CACHED_SYSTEM_PREFIX },
        { role: 'user', content: dynamicPrompt }
      ],
      temperature: 0.3,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return {
      intentAnalysis: result.intentAnalysis || '',
      emotion: result.emotion || 'neutral',
      goal: result.goal || 'gather_info',
      knownFacts: result.knownFacts || [],
      unknownGaps: result.unknownGaps || [],
      templateSuitable: result.templateSuitable || false,
      templateId: result.templateId,
      customStrategy: result.customStrategy || 'Reply naturally and helpfully',
      toneInstruction: result.toneInstruction || 'Casual and friendly',
      shouldHandoff: result.shouldHandoff || false,
      handoffReason: result.handoffReason,
      proactiveSuggestion: result.proactiveSuggestion,
      culturalNotes: result.culturalNotes || '',
    };
  } catch (error: any) {
    console.error('❌ [Thinking Layer] DeepSeek call failed:', error);
    // Return safe default strategy to fall back gracefully
    return {
      intentAnalysis: 'Fallback due to API error',
      emotion: 'neutral',
      goal: 'gather_info',
      knownFacts: [],
      unknownGaps: [],
      templateSuitable: false,
      customStrategy: 'Reply naturally and offer to connect to a human agent.',
      toneInstruction: 'Casual and helpful',
      shouldHandoff: false,
      culturalNotes: '',
    };
  }
}
