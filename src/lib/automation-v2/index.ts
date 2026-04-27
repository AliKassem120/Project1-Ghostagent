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
import { routeToV2Brain } from './router';
import { v2log } from './logger';

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

    try {
        const result = await routeToV2Brain(input);

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
                event_type: 'automation_v2',
                description: result.replyText 
                    ? `Replied to "${input.message.slice(0, 30)}..." with "${result.replyText.slice(0, 30)}..."`
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
                    chatId: input.chatId,
                    error: result.error
                }
            });
        } catch (logErr) {
            v2log.warn('V2_ENGINE', 'Failed to persist analytics log', { error: logErr });
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
