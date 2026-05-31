/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent V3 — A/B Experiments Framework
 * ═══════════════════════════════════════════════════════════════
 * Deterministic A/B testing for prompts, templates, and features.
 *
 * Variant assignment is based on a hash of (workspaceId + experiment),
 * so each workspace always gets the same variant — no randomness
 * per request, which would make debugging impossible.
 *
 * Results are tracked via the metrics pipeline for dashboard analysis.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v2log } from '@/lib/ai/logger';

// ── Experiment Definitions ──────────────────────────────────

interface ExperimentConfig {
  /** Human-readable description */
  description: string;
  /** Variant names (first is always control) */
  variants: string[];
  /** Weight distribution (must sum to 1.0) */
  weights: number[];
  /** Whether this experiment is currently active */
  active: boolean;
}

const EXPERIMENTS: Record<string, ExperimentConfig> = {
  'thinking_layer_v2': {
    description: 'Test new thinking layer prompt vs control',
    variants: ['control', 'v2_prompt'],
    weights: [0.9, 0.1],
    active: true,
  },
  'template_vs_llm': {
    description: 'Template-first vs LLM-first for common intents',
    variants: ['template_first', 'llm_first'],
    weights: [0.7, 0.3],
    active: true,
  },
  'shorter_replies': {
    description: 'Test 1-sentence replies vs standard 1-3 sentences',
    variants: ['control', '1_sentence'],
    weights: [0.8, 0.2],
    active: true,
  },
  'proactive_suggestions': {
    description: 'Enable proactive suggestions in prompt',
    variants: ['off', 'on'],
    weights: [0.5, 0.5],
    active: true,
  },
  'memory_compression': {
    description: 'Compress conversation history before LLM call',
    variants: ['off', 'on'],
    weights: [0.3, 0.7],
    active: true,
  },
  'emotion_in_prompt': {
    description: 'Include emotion analysis block in response generation',
    variants: ['off', 'on'],
    weights: [0.2, 0.8],
    active: true,
  },
};

// ── Variant Assignment ──────────────────────────────────────

/**
 * Get the assigned variant for a workspace in a given experiment.
 * Assignment is deterministic (same workspace always gets same variant).
 */
export function getVariant(workspaceId: string, experiment: string): string {
  const exp = EXPERIMENTS[experiment];
  if (!exp || !exp.active) return 'control';

  // Deterministic hash-based assignment
  const hash = hashString(`${workspaceId}:${experiment}`);
  const bucket = hash % 100;

  let cumulative = 0;
  for (let i = 0; i < exp.variants.length; i++) {
    cumulative += exp.weights[i] * 100;
    if (bucket < cumulative) return exp.variants[i];
  }

  return exp.variants[0];
}

/**
 * Check if a feature flag experiment is enabled for a workspace.
 * Convenience wrapper for binary on/off experiments.
 */
export function isFeatureEnabled(workspaceId: string, experiment: string): boolean {
  const variant = getVariant(workspaceId, experiment);
  return variant === 'on' || variant === 'enabled' || variant === 'v2_prompt';
}

/**
 * List all active experiments and the variant assigned to a workspace.
 */
export function getActiveExperiments(workspaceId: string): Array<{
  experiment: string;
  variant: string;
  description: string;
}> {
  return Object.entries(EXPERIMENTS)
    .filter(([, config]) => config.active)
    .map(([name, config]) => ({
      experiment: name,
      variant: getVariant(workspaceId, name),
      description: config.description,
    }));
}

// ── Result Tracking ─────────────────────────────────────────

export type ExperimentOutcome = 'conversion' | 'dropoff' | 'handoff' | 'loop' | 'reply_sent';

/**
 * Track an experiment result. This is fire-and-forget — non-critical.
 */
export async function trackExperimentResult(
  supabase: SupabaseClient,
  workspaceId: string,
  experiment: string,
  variant: string,
  outcome: ExperimentOutcome,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await supabase.from('experiment_results').insert({
      workspace_id: workspaceId,
      experiment,
      variant,
      result: outcome,
      metadata: metadata || {},
    });
  } catch (err) {
    v2log.warn('EXPERIMENTS', 'Failed to track experiment result', {
      experiment,
      variant,
      outcome,
      error: err,
    });
  }
}

/**
 * Track experiment results for the current request based on the
 * automation result. Call this at the end of the orchestrator pipeline.
 */
export async function trackRequestExperiments(
  supabase: SupabaseClient,
  workspaceId: string,
  actions: string[],
  stateAfter: string
): Promise<void> {
  // Determine outcome from actions
  let outcome: ExperimentOutcome = 'reply_sent';
  if (actions.includes('handoff')) outcome = 'handoff';
  else if (actions.includes('loop_detected_escalation')) outcome = 'loop';
  else if (actions.includes('place_order_success') || actions.includes('book_appointment_success')) outcome = 'conversion';

  // Get all active experiments for this workspace
  const activeExperiments = getActiveExperiments(workspaceId);

  // Track each experiment result (fire-and-forget)
  await Promise.allSettled(
    activeExperiments.map(exp =>
      trackExperimentResult(supabase, workspaceId, exp.experiment, exp.variant, outcome, {
        stateAfter,
        actions: actions.slice(0, 5), // Keep metadata small
      })
    )
  );
}

// ── Hash Function ───────────────────────────────────────────

/**
 * Simple deterministic string hash (djb2-like).
 * Returns a positive integer.
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) + hash) + char; // hash * 33 + char
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
