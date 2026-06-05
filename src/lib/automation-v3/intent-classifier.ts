import { createProvider } from '@/lib/ai/providers/llm-provider';
import { deepseekCircuit } from '@/lib/ai/circuit-breaker';
import type { LanguageScript } from './templates';
import type { CustomerProfile } from '@/lib/ai/customer-profile';

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

  if (!deepseekCircuit.canExecute()) {
    console.warn('⚡ [Intent Classifier] DeepSeek circuit breaker is open. Triggering local fallback intent detection.');
    return generateHardcodedFallback(message, workspaceType);
  }

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
    const provider = createProvider();
    const response = await provider.complete({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      maxTokens: 200,
      responseFormat: 'json',
    });

    const result = JSON.parse(response.text || '{}');
    deepseekCircuit.recordSuccess();

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
    deepseekCircuit.recordFailure();
    try {
      const provider = createProvider();
      const retryResponse = await provider.complete({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        maxTokens: 200,
        responseFormat: 'json',
      });
      const result = JSON.parse(retryResponse.text || '{}');
      deepseekCircuit.recordSuccess(); // Retry succeeded
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
    } catch (retryError) {
      console.error('❌ [Intent Classifier] Retry also failed. Falling back to local handler.', retryError);
      deepseekCircuit.recordFailure();
      return generateHardcodedFallback(message, workspaceType);
    }
  }
}

function generateHardcodedFallback(
  message: string,
  workspaceType: 'appointments' | 'ecommerce'
): IntentClassification {
  const lower = message.toLowerCase();
  const isEcom = workspaceType === 'ecommerce';

  let intent = 'unknown';
  const entities: Record<string, any> = {};
  let confidence = 0.7;
  let languageScript: LanguageScript = 'unknown';

  // Detect basic language script
  if (/[\u0600-\u06FF]/.test(message)) {
    languageScript = 'arabic';
  } else if (/\b(e7joz|3ndkn|mar7aba|addesh|se3r|maw3ed|se3a)\b/i.test(lower) || /[0-9]/.test(message)) {
    languageScript = 'franco';
  } else {
    languageScript = 'english';
  }

  // Local rule-based intent categorization
  if (/\b(hi|hello|marhaba|kifak|hala|keef|sabah|masa)\b/i.test(lower)) {
    intent = 'greeting';
  } else if (/\b(cancel|el8e|la8e|batalet|mish badde)\b/i.test(lower)) {
    intent = isEcom ? 'cancel_order' : 'cancel_appointment';
  } else if (/\b(human|agent|manager|bshar|kalam|talk to human)\b/i.test(lower)) {
    intent = 'human_handoff';
  } else if (/\b(stop|enough|slow|bad|terrible|khalas|bas)\b/i.test(lower)) {
    intent = 'frustration_stop';
  } else if (/\b(wain|where|location|address|matra7|ma7al)\b/i.test(lower)) {
    intent = 'location_question';
  } else if (/\b(time|open|hours|se3a ktr|emta btfta7o)\b/i.test(lower)) {
    intent = 'business_hours';
  } else if (/\b(mawjoud|available|stock|in stock|fe mnn)\b/i.test(lower)) {
    intent = isEcom ? 'product_availability' : 'service_availability';
  } else if (/\b(buy|order|baddak|badde|e7joz|reserve|appointment|book)\b/i.test(lower)) {
    intent = isEcom ? 'purchase_intent' : 'booking_intent';
  }

  return {
    intent,
    entities,
    confidence: intent === 'unknown' ? 0 : confidence,
    languageScript,
    needsClarification: intent === 'unknown',
    sentimentScore: /\b(bad|slow|terrible|hate)\b/i.test(lower) ? -0.5 : /\b(great|love|best|7elo)\b/i.test(lower) ? 0.5 : 0,
    urgencyLevel: /\b(now|asap|urgent|yalla)\b/i.test(lower) ? 'high' : 'low',
    source: 'fallback'
  };
}

function validateLanguageScript(script: string): LanguageScript {
  if (['english', 'arabic', 'franco', 'mixed'].includes(script)) return script as LanguageScript;
  return 'unknown';
}

