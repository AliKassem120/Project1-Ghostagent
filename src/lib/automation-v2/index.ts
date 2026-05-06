/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Entrypoint
 * ═══════════════════════════════════════════════════════════════
 * Single entry point for all V2 automation. Called by ghost-brain.ts
 * when the workspace has automation_engine_version = 'v2'.
 *
 * Returns a structured result instead of a raw string.
 */

import type { AutomationInput, AutomationResult } from './types';
import { routeToAgent } from './router';
import { shouldReplyToMessage } from './should-reply';
import { v2log } from './logger';
import { guardFinalReply } from './validation/final-reply-guard';

export async function handleAutomationMessage(input: AutomationInput): Promise<AutomationResult> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    v2log.info('V2_ENGINE', `Processing message for ${input.workspaceType} workspace`, {
        requestId,
        workspaceId: input.workspaceId,
        chatId: input.chatId,
        messageLength: input.message.length,
        platform: input.platform,
    });

    // ── SHOULD-REPLY GATE ────────────────────────────────────
    const gate = shouldReplyToMessage(input.message, {
        messageType: input.messageType,
        isReaction: input.isReaction,
        hasMedia: input.hasMedia,
        mediaType: input.mediaType,
    });

    if (!gate.shouldReply) {
        v2log.info('V2_ENGINE', `Skipped: ${gate.reason}`, { chatId: input.chatId });
        return {
            shouldReply: false,
            actions: [`gate_${gate.reason}`],
            stateBefore: 'idle',
            stateAfter: 'idle',
            debug: {
                requestId,
                engineVersion: 'v2',
                workspaceId: input.workspaceId,
                workspaceType: input.workspaceType,
                chatId: input.chatId,
                language: 'unknown',
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                durationMs: Date.now() - startTime,
            },
        };
    }

    // If gate returned a static reply (e.g. voice note unsupported), use it
    if (gate.staticReply) {
        return {
            shouldReply: true,
            replyText: gate.staticReply,
            actions: [`gate_${gate.reason}`],
            stateBefore: 'idle',
            stateAfter: 'idle',
            debug: {
                requestId,
                engineVersion: 'v2',
                workspaceId: input.workspaceId,
                workspaceType: input.workspaceType,
                chatId: input.chatId,
                language: 'unknown',
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                durationMs: Date.now() - startTime,
            },
        };
    }

    try {
        const result = await routeToAgent(input);

        const replyBeforeGuard = result.replyText || null;
        if (replyBeforeGuard) {
            const guarded = guardFinalReply({
                replyText: replyBeforeGuard,
                language: result.debug.language,
                dbWriteAttempted: result.debug.dbWriteAttempted,
                dbWriteSuccess: result.debug.dbWriteSuccess,
                actionType: result.debug.intent,
                sourcePath: 'automation-v2/index',
            });
            result.shouldReply = result.shouldReply && guarded.shouldReply;
            result.replyText = guarded.replyText || undefined;
            result.actions = [...result.actions, ...guarded.actionsToAdd];
            result.debug.blockedReason = guarded.blockedReason;
            result.debug.replyBeforeGuard = replyBeforeGuard;
            result.debug.replyAfterGuard = guarded.replyText;
        } else {
            result.debug.replyBeforeGuard = null;
            result.debug.replyAfterGuard = null;
        }

        // Override requestId in debug
        result.debug.requestId = requestId;
        result.debug.durationMs = Date.now() - startTime;

        // Log final outcome to terminal
        v2log.webhookOutcome({
            requestId,
            workspaceId: input.workspaceId,
            workspaceType: input.workspaceType,
            chatId: input.chatId,
            engineVersion: 'v2',
            language: result.debug.language,
            stateBefore: result.stateBefore,
            intent: result.debug.intent,
            actions: result.actions,
            stateAfter: result.stateAfter,
            appointmentInsertSuccess: result.debug.dbWriteSuccess && input.workspaceType === 'appointments' ? true : undefined,
            orderInsertSuccess: result.debug.dbWriteSuccess && input.workspaceType === 'ecommerce' ? true : undefined,
            sentReply: result.replyText || null,
            error: result.error,
        });

        // ── PERSIST TO ANALYTICS (Live Dashboard) ──
        try {
            await input.supabase.from('activity_log').insert({
                user_id: input.userId,
                workspace_id: input.workspaceId,
                event_type: 'AI_REPLY',
                description: result.replyText 
                    ? `Sent: "${result.replyText.slice(0, 80)}"`
                    : `Processed message: "${input.message.slice(0, 30)}..." (No reply)`,
                metadata: {
                    requestId,
                    message: input.message,
                    reply: result.replyText,
                    intent: result.debug.intent,
                    language: result.debug.language,
                    stateBefore: result.stateBefore,
                    stateAfter: result.stateAfter,
                    actions: result.actions,
                    durationMs: result.debug.durationMs,
                    platform: input.platform,
                    chat_id: input.chatId,
                    error: result.error
                }
            });
        } catch (logErr) {
            v2log.warn('V2_ENGINE', 'Failed to persist analytics log', { error: logErr });
        }

        try {
            await input.supabase.from('automation_runs').insert({
                workspace_id: input.workspaceId,
                user_id: input.userId,
                platform: input.platform,
                chat_id: input.chatId,
                incoming_message: input.message,
                buffered_message: input.message,
                state_before: result.stateBefore,
                state_after: result.stateAfter,
                intent: result.debug.intent || null,
                actions: result.actions || [],
                db_write_attempted: result.debug.dbWriteAttempted,
                db_write_success: result.debug.dbWriteSuccess,
                reply_before_guard: result.debug.replyBeforeGuard,
                reply_after_guard: result.debug.replyAfterGuard,
                blocked_reason: result.debug.blockedReason || null,
                source_path: 'automation-v2/index',
                error: result.error || null,
                metadata: {
                    requestId,
                    language: result.debug.language,
                    durationMs: result.debug.durationMs,
                },
            });
        } catch (runLogErr) {
            v2log.warn('V2_ENGINE', 'Failed to persist automation run', { error: runLogErr });
        }

        return result;

    } catch (err: any) {
        v2log.error('V2_ENGINE', 'Unhandled error in automation engine', {
            requestId,
            workspaceId: input.workspaceId,
            chatId: input.chatId,
            error: err?.message || String(err),
        });

        return {
            shouldReply: true,
            replyText: "I'm having trouble right now. Please try again in a moment.",
            actions: ['unhandled_error'],
            stateBefore: 'idle',
            stateAfter: 'idle',
            debug: {
                requestId,
                engineVersion: 'v2',
                workspaceId: input.workspaceId,
                workspaceType: input.workspaceType,
                chatId: input.chatId,
                language: 'unknown',
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                durationMs: Date.now() - startTime,
            },
            error: err?.message || 'Unknown error',
        };
    }
}
