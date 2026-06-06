/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — LLM Confirmation Intent Classifier
 * ═══════════════════════════════════════════════════════════════
 * Replaces the fragile rule-based detectYesNo() for high-stakes
 * confirmation states (awaiting_checkout_confirmation,
 * awaiting_booking_confirmation).
 *
 * Uses a lightweight DeepSeek call (<50 tokens output) that is
 * far more robust than token-count-limited regex matching.
 *
 * Returns:
 *   'yes'    — customer is confirming the transaction
 *   'no'     — customer is declining/cancelling
 *   'unsure' — ambiguous; FSM should re-prompt (same as old null)
 *
 * Fallback: if LLM call fails for any reason, falls back to the
 * fixed detectYesNo() so the system is never blocked.
 */

import { createProvider } from '../providers/llm-provider';
import { detectYesNo } from '../language';
import { v2log } from '../logger';

export type ConfirmationIntent = 'yes' | 'no' | 'unsure';

export interface ConfirmationContext {
  businessType: 'ecommerce' | 'appointments' | string;
  // What the bot last asked
  pendingItem?: string;     // e.g. "PS5 x1 — $500 deliver to Hamra"
  pendingService?: string;  // e.g. "Haircut on Tuesday at 3pm"
}

/**
 * Classifies whether a customer message is a confirmation, rejection,
 * or ambiguous for a pending order/appointment.
 *
 * Fast path: if detectYesNo() is decisive (non-null), skip the LLM call.
 * Slow path: LLM call for messages detectYesNo() returns null on.
 */
export async function classifyConfirmationIntent(
  message: string,
  ctx: ConfirmationContext
): Promise<ConfirmationIntent> {
  // Fast path: rule-based check first (covers clear yes/no, saves LLM cost)
  const ruleResult = detectYesNo(message);
  if (ruleResult !== null) {
    return ruleResult;
  }

  // Slow path: LLM for ambiguous messages
  const label = ctx.businessType === 'ecommerce' ? 'order' : 'appointment';
  const pendingDesc = ctx.pendingItem || ctx.pendingService || `a pending ${label}`;

  const systemPrompt = `You are a confirmation intent classifier for a sales chatbot.
The customer has been asked to confirm or decline ${pendingDesc}.
Classify their reply as exactly one of: YES, NO, or UNSURE.

Rules:
- YES: customer is confirming, agreeing, or proceeding (even if they add extra info like an address)
- NO: customer is declining, cancelling, or changing their mind
- UNSURE: message doesn't clearly express confirmation or rejection

Respond with ONLY the single word: YES, NO, or UNSURE. Nothing else.`;

  try {
    const provider = createProvider();
    const result = await provider.complete({
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
      temperature: 0.0,
      maxTokens: 5,
    });

    const raw = result.text.trim().toUpperCase();
    if (raw.includes('YES')) return 'yes';
    if (raw.includes('NO')) return 'no';

    v2log.warn('CONFIRM_CLASSIFIER', 'LLM returned ambiguous output, defaulting to unsure', {
      message: message.slice(0, 60),
      llmOutput: raw,
    });
    return 'unsure';

  } catch (err) {
    // Never block a transaction on a classifier failure — fall back to unsure
    v2log.warn('CONFIRM_CLASSIFIER', 'LLM call failed, falling back to rule-based (unsure)', {
      error: err instanceof Error ? err.message : String(err),
      message: message.slice(0, 60),
    });
    return 'unsure';
  }
}
