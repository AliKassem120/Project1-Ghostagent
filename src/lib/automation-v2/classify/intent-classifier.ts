/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Intent Classifier
 * ═══════════════════════════════════════════════════════════════
 * Hybrid classifier: regex first (free), LLM fallback (cheap).
 * Only runs when conversation state is idle — active states
 * are handled by the FSM directly (state before classifier).
 *
 * Two entry points:
 * - classifyIntent(message) → sync, regex-only, used by global interrupts
 * - classifyIntentWithSemanticFallback(message, ...) → async, regex + LLM
 *
 * The async pipeline is ONLY used for idle/open-ended messages
 * in the decision engine. Existing callers keep using sync classifyIntent.
 */

import { classifyByRegex, type Intent } from './regex-fallbacks';
import { classifyIntentWithLLM, safeFallbackIntent } from './llm-intent-classifier';
import type { NormalizedIntent, CanonicalIntent } from './normalized-intent';
import { isTransactionalIntent, createNormalizedIntent } from './normalized-intent';
import { v2log } from '../logger';

export interface ClassificationResult {
    intent: Intent;
    confidence: number;
    source: 'regex' | 'llm';
}

/**
 * Sync, regex-only classifier.
 * Used for global interrupts and fast-path checks.
 * Does NOT call LLM. Existing callers keep using this.
 */
export function classifyIntent(message: string): ClassificationResult {
    // 1. Try regex (deterministic, zero-cost)
    const regexResult = classifyByRegex(message);
    if (regexResult && regexResult.confidence >= 0.80) {
        return {
            intent: regexResult.intent,
            confidence: regexResult.confidence,
            source: 'regex',
        };
    }

    // 2. Return unknown — sync path has no LLM
    return {
        intent: 'unknown',
        confidence: 0,
        source: 'regex',
    };
}

/**
 * Convert a regex ClassificationResult into a NormalizedIntent.
 */
function regexToNormalized(result: ClassificationResult): NormalizedIntent {
    return createNormalizedIntent({
        intent: result.intent as CanonicalIntent,
        confidence: result.confidence,
        source: result.source,
    });
}

/**
 * Async classifier with LLM semantic fallback.
 * Priority:
 *   A. Active FSM state (handled BEFORE this is called)
 *   B. Reply-to context (handled BEFORE this is called)
 *   C. Regex fast-path for obvious/high-confidence cases
 *   D. LLM semantic classifier for complex/unknown/low-confidence messages
 *
 * If LLM fails but regex had a usable result, uses regex as fallback.
 * Only returns unknown if BOTH regex and LLM fail.
 *
 * ONLY the decision engine should use this for idle/open-ended messages.
 */
export async function classifyIntentWithSemanticFallback(
    message: string,
    workspaceType: 'ecommerce' | 'appointments',
    context?: { stage?: string; recentProduct?: string; recentService?: string }
): Promise<NormalizedIntent> {
    // ── Step C: Regex fast-path ──────────────────────────────
    const regexResult = classifyByRegex(message);
    if (regexResult && regexResult.confidence >= 0.80) {
        v2log.info('CLASSIFIER', `Regex fast-path: ${regexResult.intent} (${regexResult.confidence})`, {
            source: 'regex',
        });
        return createNormalizedIntent({
            intent: regexResult.intent as CanonicalIntent,
            confidence: regexResult.confidence,
            source: 'regex',
        });
    }

    // Keep regex result as fallback (even if low confidence)
    const regexFallback: NormalizedIntent | null = regexResult
        ? createNormalizedIntent({
              intent: regexResult.intent as CanonicalIntent,
              confidence: regexResult.confidence,
              source: 'regex',
          })
        : null;

    // ── Step D: LLM semantic classifier ─────────────────────
    v2log.info('CLASSIFIER', 'Regex insufficient, calling LLM classifier', {
        regexIntent: regexResult?.intent || 'none',
        regexConfidence: regexResult?.confidence || 0,
    });

    const llmResult = await classifyIntentWithLLM(message, workspaceType, context);

    // If LLM returned a confident result, use it
    if (llmResult.intent !== 'unknown' && llmResult.confidence >= 0.70) {
        v2log.info('CLASSIFIER', `LLM classified: ${llmResult.intent} (${llmResult.confidence})`, {
            source: 'llm',
        });
        return llmResult;
    }

    // If LLM returned low confidence but has an intent, mark needsClarification
    if (llmResult.intent !== 'unknown' && llmResult.confidence > 0 && llmResult.confidence < 0.70) {
        v2log.info('CLASSIFIER', `LLM low confidence: ${llmResult.intent} (${llmResult.confidence})`, {
            source: 'llm',
        });
        return { ...llmResult, needsClarification: true };
    }

    // ── LLM failed or returned unknown — use regex fallback ─
    if (regexFallback && regexFallback.intent !== 'unknown') {
        v2log.info('CLASSIFIER', `LLM failed, using regex fallback: ${regexFallback.intent}`, {
            source: 'regex',
        });
        return regexFallback;
    }

    // Both failed — return unknown
    v2log.info('CLASSIFIER', 'Both regex and LLM returned unknown');
    return safeFallbackIntent();
}
