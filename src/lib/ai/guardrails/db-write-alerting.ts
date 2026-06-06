/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — DB Write Failure Alerting
 * ═══════════════════════════════════════════════════════════════
 * Fires when dbWriteAttempted=true but dbWriteSuccess=false,
 * meaning a customer went through the full confirmation flow but
 * no record was saved. This is a critical silent failure.
 *
 * Alert channels:
 *   1. Slack webhook (SLACK_ALERT_WEBHOOK env var)
 *   2. activity_log table (always — no extra infra needed)
 *   3. Structured error log (always)
 *
 * Usage:
 *   await alertDbWriteFailure(supabase, { ... })
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v2log } from '../logger';

export interface DbWriteFailureContext {
  workspaceId: string;
  chatId: string;
  platform: 'instagram' | 'whatsapp';
  businessType: 'ecommerce' | 'appointments' | string;
  stateBefore: string;
  stateAfter: string;
  actions: string[];
  requestId: string;
  // What the customer tried to do
  orderDetails?: {
    productName?: string;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    quantity?: number;
    price?: number;
  };
  appointmentDetails?: {
    service?: string;
    date?: string;
    time?: string;
    customerName?: string;
    customerPhone?: string;
  };
  // The error from Supabase, if available
  supabaseError?: string;
  supabaseCode?: string;
}

/**
 * Fires a multi-channel alert when a confirmed transaction was not persisted.
 * Non-throwing — alert failures are logged but never crash the main flow.
 */
export async function alertDbWriteFailure(
  supabase: SupabaseClient,
  ctx: DbWriteFailureContext
): Promise<void> {
  const label = ctx.businessType === 'ecommerce' ? 'ORDER' : 'APPOINTMENT';
  const shortId = ctx.requestId.slice(-8);

  // 1. Always log as structured error (visible in Vercel/server logs)
  v2log.error('DB_WRITE_ALERT', `CRITICAL: ${label} NOT SAVED after confirmed transaction`, {
    requestId: ctx.requestId,
    workspaceId: ctx.workspaceId,
    chatId: ctx.chatId,
    platform: ctx.platform,
    businessType: ctx.businessType,
    stateBefore: ctx.stateBefore,
    stateAfter: ctx.stateAfter,
    actions: ctx.actions,
    supabaseError: ctx.supabaseError,
    supabaseCode: ctx.supabaseCode,
    orderDetails: ctx.orderDetails,
    appointmentDetails: ctx.appointmentDetails,
  });

  // 2. Always write a high-severity row to activity_log (visible in dashboard)
  try {
    const details = ctx.businessType === 'ecommerce'
      ? ctx.orderDetails
      : ctx.appointmentDetails;

    await supabase.from('activity_log').insert({
      user_id: null, // workspace-level alert, no specific user
      workspace_id: ctx.workspaceId,
      event_type: 'DB_WRITE_FAILURE_ALERT',
      description: `⚠️ CRITICAL: ${label} not saved after customer confirmed. Request ${shortId}`,
      metadata: {
        requestId: ctx.requestId,
        chatId: ctx.chatId,
        platform: ctx.platform,
        businessType: ctx.businessType,
        stateBefore: ctx.stateBefore,
        stateAfter: ctx.stateAfter,
        actions: ctx.actions,
        supabaseError: ctx.supabaseError,
        supabaseCode: ctx.supabaseCode,
        details,
        severity: 'critical',
        alertedAt: new Date().toISOString(),
      },
    });
  } catch (logErr) {
    v2log.warn('DB_WRITE_ALERT', 'Failed to write alert to activity_log', {
      error: logErr instanceof Error ? logErr.message : String(logErr),
    });
  }

  // 3. Slack webhook (optional — only if SLACK_ALERT_WEBHOOK is configured)
  const slackWebhook = process.env.SLACK_ALERT_WEBHOOK;
  if (slackWebhook) {
    try {
      const details = ctx.businessType === 'ecommerce'
        ? `Product: ${ctx.orderDetails?.productName || '?'} | Customer: ${ctx.orderDetails?.customerName || '?'} | Phone: ${ctx.orderDetails?.customerPhone || '?'}`
        : `Service: ${ctx.appointmentDetails?.service || '?'} | Date: ${ctx.appointmentDetails?.date || '?'} @ ${ctx.appointmentDetails?.time || '?'} | Customer: ${ctx.appointmentDetails?.customerName || '?'}`;

      const slackBody = {
        text: `🚨 *GhostAgent: ${label} NOT SAVED*`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `🚨 ${label} NOT SAVED — Silent Failure Detected` },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Workspace:*\n${ctx.workspaceId.slice(-8)}` },
              { type: 'mrkdwn', text: `*Platform:*\n${ctx.platform}` },
              { type: 'mrkdwn', text: `*Chat ID:*\n${ctx.chatId.slice(-12)}` },
              { type: 'mrkdwn', text: `*Request:*\n${shortId}` },
            ],
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Transaction Details:*\n${details}` },
          },
          ...(ctx.supabaseError
            ? [{
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Supabase Error:*\n\`${ctx.supabaseCode || 'unknown'}: ${ctx.supabaseError}\``,
                },
              }]
            : []),
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Actions taken: ${ctx.actions.join(' → ')} | State: ${ctx.stateBefore} → ${ctx.stateAfter}`,
              },
            ],
          },
        ],
      };

      await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackBody),
      });
    } catch (slackErr) {
      v2log.warn('DB_WRITE_ALERT', 'Slack webhook alert failed', {
        error: slackErr instanceof Error ? slackErr.message : String(slackErr),
      });
    }
  }
}
