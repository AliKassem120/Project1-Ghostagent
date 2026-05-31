/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Metrics
 * ═══════════════════════════════════════════════════════════════
 * Structured metric emission for every automation run.
 * Writes to both stdout (structured JSON) and the metrics table.
 *
 * Every v3 run emits:
 * - response_time_ms, intent_classification_ms
 * - state_transition, loop_detected, handoff
 * - template_used (true/false), llm_calls
 * - order_created, appointment_created
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v2log } from './logger';

// ── Metric Event ─────────────────────────────────────────────

export interface MetricEvent {
    workspaceId: string;
    chatId: string;
    platform: 'instagram' | 'whatsapp';
    engineVersion: 'v2' | 'v3';

    // Timing
    totalDurationMs: number;
    classificationMs?: number;
    llmGenerationMs?: number;

    // Intent
    intent?: string;
    intentSource?: 'regex' | 'llm' | 'template';
    intentConfidence?: number;

    // State
    stateBefore: string;
    stateAfter: string;
    loopDetected?: boolean;
    loopCount?: number;

    // Response
    templateUsed: boolean;
    templateKey?: string;
    llmCallCount: number;

    // Actions
    actions: string[];
    handoffCreated?: boolean;
    orderCreated?: boolean;
    appointmentCreated?: boolean;

    // Errors
    error?: string;
    rateLimited?: boolean;

    // Experiments (Phase 4)
    experimentVariants?: Record<string, string>;
}

// ── Metric Builder ───────────────────────────────────────────

export class MetricBuilder {
    private event: Partial<MetricEvent> = {};
    private startTime: number;

    constructor(workspaceId: string, chatId: string, platform: 'instagram' | 'whatsapp') {
        this.startTime = Date.now();
        this.event = {
            workspaceId,
            chatId,
            platform,
            engineVersion: 'v3',
            llmCallCount: 0,
            templateUsed: false,
            actions: [],
        };
    }

    /** Set the intent classification result */
    setIntent(intent: string, source: 'regex' | 'llm' | 'template', confidence: number, classificationMs?: number) {
        this.event.intent = intent;
        this.event.intentSource = source;
        this.event.intentConfidence = confidence;
        this.event.classificationMs = classificationMs;
        return this;
    }

    /** Set state transition */
    setState(before: string, after: string) {
        this.event.stateBefore = before;
        this.event.stateAfter = after;
        return this;
    }

    /** Set loop detection */
    setLoop(detected: boolean, count: number) {
        this.event.loopDetected = detected;
        this.event.loopCount = count;
        return this;
    }

    /** Mark that a template was used */
    setTemplate(key: string) {
        this.event.templateUsed = true;
        this.event.templateKey = key;
        return this;
    }

    /** Increment LLM call count */
    addLlmCall(durationMs?: number) {
        this.event.llmCallCount = (this.event.llmCallCount || 0) + 1;
        if (durationMs) this.event.llmGenerationMs = (this.event.llmGenerationMs || 0) + durationMs;
        return this;
    }

    /** Add actions */
    addActions(actions: string[]) {
        this.event.actions = [...(this.event.actions || []), ...actions];
        return this;
    }

    /** Mark special events */
    setHandoff() { this.event.handoffCreated = true; return this; }
    setOrderCreated() { this.event.orderCreated = true; return this; }
    setAppointmentCreated() { this.event.appointmentCreated = true; return this; }
    setRateLimited() { this.event.rateLimited = true; return this; }
    setError(error: string) { this.event.error = error; return this; }

    /** Build the final metric event */
    build(): MetricEvent {
        return {
            ...this.event,
            totalDurationMs: Date.now() - this.startTime,
        } as MetricEvent;
    }
}

// ── Background Metric Batch Queue ────────────────────────────

interface MetricBatchItem {
    supabase: SupabaseClient;
    record: any;
}

const BATCH_FLUSH_SIZE = 20;
const BATCH_FLUSH_INTERVAL_MS = 1000;
const MAX_QUEUE_CAPACITY = 200;

const batchQueue: MetricBatchItem[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

function scheduleFlush() {
    if (flushTimeout) return;
    flushTimeout = setTimeout(async () => {
        flushTimeout = null;
        if (batchQueue.length === 0) return;
        const itemsToFlush = batchQueue.splice(0, batchQueue.length);

        try {
            await Promise.allSettled(
                itemsToFlush.map(item => item.supabase.from('metrics').insert(item.record))
            );
        } catch (err: any) {
            v2log.warn('METRIC_BATCH', 'Background metric flush error', { error: err.message });
        }
    }, BATCH_FLUSH_INTERVAL_MS);
}

/**
 * Flush all buffered metrics synchronously. Call this before returning
 * from serverless functions to prevent data loss on container shutdown.
 */
export async function flushMetrics(): Promise<void> {
    if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
    }
    if (batchQueue.length === 0) return;
    const itemsToFlush = batchQueue.splice(0, batchQueue.length);
    try {
        await Promise.allSettled(
            itemsToFlush.map(item => item.supabase.from('metrics').insert(item.record))
        );
    } catch (err: any) {
        v2log.warn('METRIC_FLUSH', 'Explicit metric flush error', { error: err.message });
    }
}

// ── Emit Metric ──────────────────────────────────────────────

/**
 * Emit a metric event synchronously to stdout and queue for DB batching.
 * Extremely high-throughput — zero DB blocking latency.
 */
export async function emitMetric(
    supabase: SupabaseClient | null,
    event: MetricEvent
): Promise<void> {
    // 1. Synchronous structured JSON to stdout
    v2log.info('METRIC', JSON.stringify(event));

    // 2. Queue for background flushing
    if (supabase) {
        const record = {
            workspace_id: event.workspaceId,
            chat_id: event.chatId,
            platform: event.platform,
            engine_version: event.engineVersion,
            total_duration_ms: event.totalDurationMs,
            classification_ms: event.classificationMs,
            llm_generation_ms: event.llmGenerationMs,
            intent: event.intent,
            intent_source: event.intentSource,
            intent_confidence: event.intentConfidence,
            state_before: event.stateBefore,
            state_after: event.stateAfter,
            loop_detected: event.loopDetected || false,
            loop_count: event.loopCount || 0,
            template_used: event.templateUsed,
            template_key: event.templateKey,
            llm_call_count: event.llmCallCount,
            actions: event.actions,
            handoff_created: event.handoffCreated || false,
            order_created: event.orderCreated || false,
            appointment_created: event.appointmentCreated || false,
            error: event.error,
            rate_limited: event.rateLimited || false,
        };

        // Drop oldest items if queue is at capacity to prevent unbounded growth
        if (batchQueue.length >= MAX_QUEUE_CAPACITY) {
            batchQueue.shift();
            v2log.warn('METRIC_BATCH', 'Queue at capacity, dropping oldest metric');
        }

        batchQueue.push({ supabase, record });
        if (batchQueue.length >= BATCH_FLUSH_SIZE) {
            scheduleFlush();
        } else if (!flushTimeout) {
            scheduleFlush();
        }
    }
}
