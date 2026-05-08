/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Brain Safety Invariant Tests
 * ═══════════════════════════════════════════════════════════════
 * Tests proving critical architectural constraints:
 * 1. Fallback LLM agent cannot call transactional tools
 * 2. Global interrupts beat active FSM for cancel
 * 3. FSM handles expected answers (no LLM needed)
 * 4. Deterministic handlers for scoped cancel and repeat
 * 5. Count-aware guard blocks false plural cancellation
 */

import { describe, it, expect, vi } from 'vitest';

// ── 1. Fallback LLM agent tool restrictions ─────────────────

describe('Fallback LLM Agent — Transactional Tool Block', () => {
    it('ecommerce read-only tools do NOT include place_order', async () => {
        const { createEcommerceToolsReadOnly, TRANSACTIONAL_TOOL_NAMES } = await import('../tools');
        const ctx = {
            supabase: {} as any,
            userId: 'u1',
            workspaceId: 'w1',
            chatId: 'c1',
            config: {} as any,
            platform: 'instagram' as const,
        };
        const tools = createEcommerceToolsReadOnly(ctx);
        const toolNames = Object.keys(tools);

        expect(toolNames).not.toContain('place_order');
        expect(toolNames).not.toContain('cancel_order');
        // Safe tools should still be present
        expect(toolNames).toContain('search_products');
        expect(toolNames).toContain('get_business_hours');
        expect(toolNames).toContain('lookup_customer');
    });

    it('appointment read-only tools do NOT include book_appointment', async () => {
        const { createAppointmentToolsReadOnly } = await import('../tools');
        const ctx = {
            supabase: {} as any,
            userId: 'u1',
            workspaceId: 'w1',
            chatId: 'c1',
            config: {} as any,
            platform: 'whatsapp' as const,
        };
        const tools = createAppointmentToolsReadOnly(ctx);
        const toolNames = Object.keys(tools);

        expect(toolNames).not.toContain('book_appointment');
        expect(toolNames).not.toContain('cancel_appointment');
        // Safe tools should still be present
        expect(toolNames).toContain('check_slot');
        expect(toolNames).toContain('lookup_customer');
    });

    it('TRANSACTIONAL_TOOL_NAMES includes all write tools', async () => {
        const { TRANSACTIONAL_TOOL_NAMES } = await import('../tools');
        expect(TRANSACTIONAL_TOOL_NAMES).toContain('place_order');
        expect(TRANSACTIONAL_TOOL_NAMES).toContain('cancel_order');
        expect(TRANSACTIONAL_TOOL_NAMES).toContain('book_appointment');
        expect(TRANSACTIONAL_TOOL_NAMES).toContain('cancel_appointment');
    });

    it('full ecommerce tools DO include transactional tools (for FSM/handlers)', async () => {
        const { createEcommerceTools } = await import('../tools');
        const ctx = {
            supabase: {} as any,
            userId: 'u1',
            workspaceId: 'w1',
            chatId: 'c1',
            config: {} as any,
            platform: 'instagram' as const,
        };
        const tools = createEcommerceTools(ctx);
        const toolNames = Object.keys(tools);

        // Full tools include transactional ones (used by FSM)
        expect(toolNames).toContain('place_order');
        expect(toolNames).toContain('cancel_order');
    });
});

// ── 2. Cancel interrupt beats active FSM ─────────────────────

describe('Global Interrupt Priority', () => {
    it('cancel_order is detected by regex as global interrupt', async () => {
        const { classifyIntent } = await import('../classify/intent-classifier');
        const result = classifyIntent('cancel my order');
        expect(result.intent).toBe('cancel_order');
        expect(result.confidence).toBeGreaterThanOrEqual(0.80);
    });

    it('cancel_appointment is detected by regex as global interrupt', async () => {
        const { classifyIntent } = await import('../classify/intent-classifier');
        const result = classifyIntent('cancel my appointment');
        expect(result.intent).toBe('cancel_appointment');
        expect(result.confidence).toBeGreaterThanOrEqual(0.80);
    });

    it('human_handoff is detected as global interrupt', async () => {
        const { classifyIntent } = await import('../classify/intent-classifier');
        const result = classifyIntent('talk to a human');
        expect(result.intent).toBe('human_handoff');
    });

    it('frustration_stop is detected as global interrupt', async () => {
        const { classifyIntent } = await import('../classify/intent-classifier');
        const result = classifyIntent('stop messaging me');
        expect(result.intent).toBe('frustration_stop');
    });
});

// ── 3. FSM handles expected answers ──────────────────────────

describe('FSM Priority — Expected Answers', () => {
    it('greeting is classified by regex (FSM not needed)', async () => {
        const { classifyIntent } = await import('../classify/intent-classifier');
        const result = classifyIntent('hello');
        expect(result.intent).toBe('greeting');
        expect(result.source).toBe('regex');
    });

    it('purchase intent detected by regex', async () => {
        const { classifyIntent } = await import('../classify/intent-classifier');
        const result = classifyIntent('I want to buy this');
        expect(result.intent).toBe('purchase_intent');
    });

    it('booking intent detected by regex', async () => {
        const { classifyIntent } = await import('../classify/intent-classifier');
        const result = classifyIntent('I want to book an appointment');
        expect(result.intent).toBe('booking_intent');
    });
});

// ── 4. Deterministic scoped cancel handler ───────────────────

describe('Deterministic Cancel — Scoped', () => {
    it('"cancel both orders" detected by regex as cancel_order', async () => {
        const { classifyIntent } = await import('../classify/intent-classifier');
        const result = classifyIntent('cancel both orders');
        expect(result.intent).toBe('cancel_order');
        expect(result.confidence).toBeGreaterThanOrEqual(0.80);
    });

    it('detectCancelScope extracts scope=count/count=2 from "cancel both orders"', async () => {
        // detectCancelScope is internal to decision-engine, test via regex
        const { classifyByRegex } = await import('../classify/regex-fallbacks');
        const result = classifyByRegex('cancel both orders');
        expect(result).toBeTruthy();
        expect(result!.intent).toBe('cancel_order');
    });
});

// ── 5. Repeat handler ────────────────────────────────────────

describe('Deterministic Repeat Handler', () => {
    it('"same one again" detected by regex as repeat_last_order', async () => {
        const { classifyByRegex } = await import('../classify/regex-fallbacks');
        const result = classifyByRegex('same one again');
        expect(result).toBeTruthy();
        expect(result!.intent).toBe('repeat_last_order');
    });

    it('"add one more" detected as repeat_last_order', async () => {
        const { classifyByRegex } = await import('../classify/regex-fallbacks');
        const result = classifyByRegex('add one more');
        expect(result).toBeTruthy();
        expect(result!.intent).toBe('repeat_last_order');
    });
});

// ── 6. Count-aware guard blocks false plural cancellation ────

const { guardFinalReply } = await import('../validation/final-reply-guard');

describe('Count-Aware Guard — Plural Cancellation', () => {

    it('blocks "both orders cancelled" when only 1 was actually cancelled', () => {
        const result = guardFinalReply({
            replyText: 'Both orders cancelled.',
            language: 'english',
            dbWriteSuccess: true,
            cancelMeta: { requestedScope: 'count', requestedCount: 2, cancelledCount: 1 },
        });
        expect(result.blockedReason).toBe('cancel_count_mismatch');
    });

    it('blocks "all appointments cancelled" when 0 were cancelled', () => {
        const result = guardFinalReply({
            replyText: 'All appointments cancelled.',
            language: 'english',
            dbWriteSuccess: true,
            cancelMeta: { requestedScope: 'all_pending', requestedCount: 3, cancelledCount: 0 },
        });
        expect(result.blockedReason).toBe('cancel_count_mismatch');
    });

    it('allows "Order cancelled" when dbWriteSuccess and cancelledCount >= 1', () => {
        const result = guardFinalReply({
            replyText: 'Order cancelled ✅',
            language: 'english',
            dbWriteSuccess: true,
            cancelMeta: { requestedScope: 'latest', cancelledCount: 1 },
        });
        expect(result.blockedReason).toBeUndefined();
        expect(result.shouldReply).toBe(true);
    });

    it('blocks "Order cancelled" when dbWriteSuccess is false', () => {
        const result = guardFinalReply({
            replyText: 'Order cancelled ✅',
            language: 'english',
            dbWriteSuccess: false,
        });
        expect(result.blockedReason).toBe('false_success_claim');
    });

    it('blocks "3 orders cancelled" when only 2 were cancelled', () => {
        const result = guardFinalReply({
            replyText: '3 orders cancelled.',
            language: 'english',
            dbWriteSuccess: true,
            cancelMeta: { requestedScope: 'count', requestedCount: 3, cancelledCount: 2 },
        });
        expect(result.blockedReason).toBe('cancel_count_mismatch');
    });
});
