import { createProvider } from '@/lib/ai/providers/llm-provider';
import { z } from 'zod';

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

// ── Allowed tool names by business type ───────────────────────

const ECOMMERCE_TOOLS = ['search_products', 'check_stock', 'get_business_hours', 'lookup_customer', 'send_product_card'] as const;
const APPOINTMENT_TOOLS = ['check_slot', 'get_services', 'get_business_hours', 'lookup_customer'] as const;
const ALL_ALLOWED_TOOLS = [...new Set([...ECOMMERCE_TOOLS, ...APPOINTMENT_TOOLS])] as const;

// ── Zod schema for thinking layer output ─────────────────────

const VALID_STATES = [
  'idle', 'collecting', 'confirming', 'complete', 'handoff',
  'awaiting_product', 'awaiting_variant', 'awaiting_order_details',
  'awaiting_checkout_confirmation', 'awaiting_service', 'awaiting_date_time',
  'awaiting_customer_details', 'awaiting_booking_confirmation',
  'post_order_modify', 'post_appointment_modify',
] as const;

const VALID_GOALS = ['close_sale', 'gather_info', 'resolve_issue'] as const;
type ValidGoal = typeof VALID_GOALS[number];

export const ThinkingResultSchema = z.object({
  intentAnalysis: z.string().min(1, 'intentAnalysis must not be empty'),
  emotion: z.string().min(1, 'emotion must not be empty'),
  // z.enum errorMap is not honoured in Zod v4 — use string+refine for predictable messages
  goal: z.string().refine(
    (v): v is ValidGoal => (VALID_GOALS as readonly string[]).includes(v),
    { message: 'goal must be one of: close_sale, gather_info, resolve_issue' }
  ),
  toolsNeeded: z
    .array(z.enum(ALL_ALLOWED_TOOLS as unknown as [string, ...string[]]))
    .max(4, 'toolsNeeded must not exceed 4 tools')
    .refine(
      (tools) => new Set(tools).size === tools.length,
      { message: 'toolsNeeded must not contain duplicate tools' }
    ),
  // z.enum errorMap is not honoured in Zod v4 — use string+refine for predictable messages
  suggestedNextState: z.string().refine(
    (v) => (VALID_STATES as readonly string[]).includes(v),
    { message: `suggestedNextState must be one of: ${VALID_STATES.join(', ')}` }
  ),
  customStrategy: z.string().min(10, 'customStrategy must be descriptive (≥10 chars)'),
});

/** Exported for unit testing */
export type ThinkingResultRaw = z.input<typeof ThinkingResultSchema>;

/**
 * Validate and coerce LLM JSON output against the ThinkingResultSchema.
 * Returns a typed, validated ThinkingResult or throws with a detailed message.
 */
export function validateThinkingResult(raw: unknown): ThinkingResult {
  const parsed = ThinkingResultSchema.safeParse(raw);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')} — ${i.message}`)
      .join('\n');
    throw new Error(`[ThinkingLayer] Schema validation failed:\n${issues}`);
  }

  return parsed.data as ThinkingResult;
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
- For ecommerce: "search_products", "check_stock", "get_business_hours", "lookup_customer", "send_product_card"
- For appointments: "check_slot", "get_services", "get_business_hours", "lookup_customer"
- Do NOT request transactional write tools like "place_order", "cancel_order", "book_appointment", "cancel_appointment", or "reschedule_appointment" since those are exclusively managed by the FSM flows.`;

  try {
    const provider = createProvider();
    const response = await provider.complete({
      system: CACHED_SYSTEM_PREFIX,
      messages: [{ role: 'user', content: dynamicPrompt }],
      temperature: 0.3,
      maxTokens: 600,
      responseFormat: 'json',
    });

    const rawParsed = JSON.parse(response.text || '{}');

    try {
      // Validate and coerce the LLM output against the strict schema.
      // Falls back gracefully on validation errors rather than crashing.
      return validateThinkingResult({
        intentAnalysis: rawParsed.intentAnalysis || '',
        emotion: rawParsed.emotion || 'neutral',
        goal: rawParsed.goal || 'gather_info',
        toolsNeeded: Array.isArray(rawParsed.toolsNeeded) ? rawParsed.toolsNeeded : [],
        suggestedNextState: rawParsed.suggestedNextState || session.state || 'idle',
        customStrategy: rawParsed.customStrategy || 'Reply naturally and helpfully',
      });
    } catch (validationError: any) {
      console.warn('⚠️ [Thinking Layer] Schema validation failed — using safe fallback:', validationError.message);
      // Return a safe, untyped fallback rather than crashing the pipeline
      return {
        intentAnalysis: rawParsed.intentAnalysis || 'Validation fallback',
        emotion: rawParsed.emotion || 'neutral',
        goal: (['close_sale', 'gather_info', 'resolve_issue'].includes(rawParsed.goal)
          ? rawParsed.goal
          : 'gather_info') as ThinkingResult['goal'],
        toolsNeeded: [],
        suggestedNextState: session.state || 'idle',
        customStrategy: rawParsed.customStrategy || 'Reply naturally and helpfully',
      };
    }
  } catch (error: any) {
    console.error('❌ [Thinking Layer] LLM call failed:', error);
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
