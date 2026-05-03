/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Intent Classifier
 * ═══════════════════════════════════════════════════════════════
 * Hybrid classifier: regex first (free), LLM fallback (cheap).
 * Only runs when conversation state is idle — active states
 * are handled by the FSM directly (state before classifier).
 */

import { classifyByRegex, type Intent } from './regex-fallbacks';

export interface ClassificationResult {
    intent: Intent;
    confidence: number;
    source: 'regex' | 'llm';
}

/**
 * Classify the intent of a message.
 * Uses regex patterns first, falls back to LLM only if needed.
 * 
 * NOTE: This is only called when conversation state is 'idle'.
 * Active states bypass classification entirely.
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

    // 2. For now, return unknown and let the LLM agent handle it.
    // The LLM call in agent.ts will handle general conversation,
    // FAQs, and anything the regex doesn't catch.
    // TODO: Add LLM-based structured classification for complex intents
    return {
        intent: 'unknown',
        confidence: 0,
        source: 'regex',
    };
}
