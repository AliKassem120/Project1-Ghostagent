import OpenAI from 'openai';

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY || 'mock-key',
});

export interface ThinkingResult {
  intentAnalysis: string;
  emotion: string;
  goal: 'close_sale' | 'gather_info' | 'resolve_issue';
  toolsNeeded: string[];
  suggestedNextState: string;
  customStrategy: string;
}

export interface ToolResult {
  tool: string;
  result: any;
}

// System prefix to leverage prompt caching
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
5. Determine which tools are needed to get the required information or perform action.
6. If stock LOW (≤3), create honest urgency
7. If RETURNING customer, reference casually
8. If sentiment DECLINING, de-escalate first
9. If loopCount ≥ 2, suggest handoff/reset
10. If HESITANT, offer social proof or guarantee
11. VIP (3+ orders or $500+) = white-glove treatment`;

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
Analyze the customer message and decide what needs to be done.

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

=== RESPONSE FORMAT (JSON ONLY) ===
You must output EXACTLY a JSON object matching this schema:
{
  "intentAnalysis": "string describing user intent",
  "emotion": "string detailing customer sentiment",
  "goal": "close_sale | gather_info | resolve_issue",
  "toolsNeeded": ["search_products", "check_stock", "cancel_order"], 
  "suggestedNextState": "string matching state tree keys (e.g. idle, awaiting_product, awaiting_variant, awaiting_order_details, awaiting_checkout_confirmation, awaiting_service, awaiting_date_time, awaiting_customer_details, awaiting_booking_confirmation, post_order_modify, post_appointment_modify, handoff)",
  "customStrategy": "Highly specific tactical instructions for the response generator step"
}

Available tools you can request:
- For ecommerce: "search_products", "get_business_hours", "lookup_customer"
- For appointments: "check_slot", "get_services", "lookup_customer", "send_booking_flow"
- Do NOT request transactional write tools like "place_order", "cancel_order", "book_appointment", "cancel_appointment", or "reschedule_appointment" since those are exclusively managed by the FSM flows.`;

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
      toolsNeeded: result.toolsNeeded || [],
      suggestedNextState: result.suggestedNextState || session.state || 'idle',
      customStrategy: result.customStrategy || 'Reply naturally and helpfully',
    };
  } catch (error: any) {
    console.error('❌ [Thinking Layer] DeepSeek call failed:', error);
    return {
      intentAnalysis: 'Fallback due to API error',
      emotion: 'neutral',
      goal: 'gather_info',
      toolsNeeded: [],
      suggestedNextState: session.state || 'idle',
      customStrategy: 'Reply naturally and offer to connect to a human agent.',
    };
  }
}
