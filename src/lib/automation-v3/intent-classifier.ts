import OpenAI from 'openai';
import type { LanguageScript } from './templates';
import type { CustomerProfile } from '@/lib/ai/customer-profile';

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY || 'mock-key',
});

export interface IntentClassification {
  intent: string;
  entities: Record<string, any>;
  confidence: number;
  languageScript: LanguageScript;
  needsClarification: boolean;
  clarificationQuestion?: string;
  sentimentScore: number; // -1.0 to 1.0
  urgencyLevel: 'low' | 'medium' | 'high' | 'urgent';
  source: 'llm' | 'retry' | 'fallback';
}

const ECOMMERCE_INTENTS = [
  'greeting', 'purchase_intent', 'product_question', 'price_question',
  'product_availability', 'order_status', 'cancel_order', 'modify_order',
  'repeat_last_order', 'business_hours', 'location_question', 'shipping_question',
  'human_handoff', 'frustration_stop', 'correction', 'small_talk', 'compliment',
  'complaint', 'unknown'
];

const APPOINTMENT_INTENTS = [
  'greeting', 'booking_intent', 'service_question', 'price_question',
  'service_availability', 'appointment_status', 'cancel_appointment',
  'modify_appointment', 'reschedule_appointment', 'business_hours',
  'location_question', 'human_handoff', 'frustration_stop', 'correction',
  'small_talk', 'compliment', 'complaint', 'unknown'
];

export async function classifyIntent(
  message: string,
  workspaceType: 'appointments' | 'ecommerce',
  context?: {
    currentState?: string;
    recentProduct?: string;
    recentService?: string;
    customerProfile?: CustomerProfile | null;
  }
): Promise<IntentClassification> {
  const intents = workspaceType === 'ecommerce' ? ECOMMERCE_INTENTS : APPOINTMENT_INTENTS;

  const prompt = `You are an intent classifier for a customer service AI.
Analyze the customer message and classify it.

CUSTOMER MESSAGE: "${message}"
BUSINESS TYPE: ${workspaceType}
AVAILABLE INTENTS: ${intents.join(', ')}
${context?.recentProduct ? `RECENT PRODUCT DISCUSSED: "${context.recentProduct}"` : ''}
${context?.recentService ? `RECENT SERVICE DISCUSSED: "${context.recentService}"` : ''}
${context?.currentState ? `CURRENT CONVERSATION STATE: "${context.currentState}"` : ''}

CLASSIFICATION RULES:
1. "Kifak", "hala", "marhaba", "hi", "hello" → greeting
2. "badde", "i want", "order", "buy", "shu se3r", "price" + product mention → purchase_intent (or booking_intent if appointments)
3. "mawjoud", "available", "stock", "in stock" → product_availability (or service_availability if appointments)
4. "cancel", "el8e", "la8e", "mesh badda" → cancel_order / cancel_appointment
5. "wain", "location", "address", "where" → location_question
6. "bshar", "human", "manager", "agent" → human_handoff
7. "khalas", "stop", "enough", "bas" → frustration_stop
8. Mixed Arabic + Latin (3,7,2,5) → languageScript: "franco"
9. Arabic script → languageScript: "arabic"
10. English only → languageScript: "english"
11. Mixed English + Franco in same message → languageScript: "mixed"

SENTIMENT RULES:
- Score -1.0 (very negative) to 1.0 (very positive)
- Complaints, frustration words ("slow", "bad", "terrible", "kharab") = negative
- Compliments ("great", "love", "best", "7elo") = positive
- Questions with urgency words ("now", "asap", "urgent", "yalla") = high urgency

Respond in JSON ONLY (with no markdown wrappers or backticks):
{
  "intent": "...",
  "entities": { "productName": "...", "serviceName": "...", "variant": "...", "quantity": 1 },
  "confidence": 0.95,
  "languageScript": "franco",
  "needsClarification": false,
  "sentimentScore": 0.2,
  "urgencyLevel": "medium"
}`;

  try {
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return {
      intent: result.intent || 'unknown',
      entities: result.entities || {},
      confidence: result.confidence || 0.5,
      languageScript: validateLanguageScript(result.languageScript),
      needsClarification: result.needsClarification || false,
      clarificationQuestion: result.clarificationQuestion,
      sentimentScore: result.sentimentScore || 0,
      urgencyLevel: result.urgencyLevel || 'low',
      source: 'llm',
    };
  } catch (error) {
    console.warn('⚠️ [Intent Classifier] DeepSeek execution failed, retrying once...', error);
    try {
      const retry = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });
      const result = JSON.parse(retry.choices[0].message.content || '{}');
      return {
        intent: result.intent || 'unknown',
        entities: result.entities || {},
        confidence: (result.confidence || 0.5) * 0.8, // Penalize confidence on retry
        languageScript: validateLanguageScript(result.languageScript),
        needsClarification: true,
        sentimentScore: result.sentimentScore || 0,
        urgencyLevel: result.urgencyLevel || 'low',
        source: 'retry',
      };
    } catch {
      return {
        intent: 'unknown',
        entities: {},
        confidence: 0,
        languageScript: 'unknown',
        needsClarification: true,
        sentimentScore: 0,
        urgencyLevel: 'low',
        source: 'fallback',
      };
    }
  }
}

function validateLanguageScript(script: string): LanguageScript {
  if (['english', 'arabic', 'franco', 'mixed'].includes(script)) return script as LanguageScript;
  return 'unknown';
}
