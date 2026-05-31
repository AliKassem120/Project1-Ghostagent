/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent V3 — Proactive Engine
 * ═══════════════════════════════════════════════════════════════
 * Generates proactive outbound messages for idle customers based
 * on their history: abandoned carts, restocked wishlist items,
 * follow-up after appointments, etc.
 *
 * This engine is designed to be called by a scheduled cron job
 * (e.g., every 6 hours) that iterates through workspaces and
 * checks for eligible customers.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getTemplate } from './templates';
import { v2log } from '@/lib/ai/logger';

// ── Types ───────────────────────────────────────────────────

interface CustomerContext {
  workspaceId: string;
  chatId: string;
  platform: 'instagram' | 'whatsapp';
  name?: string;
  preferredLanguage?: string;
  lastOrderDate?: string;
  lastAppointmentDate?: string;
  totalOrders?: number;
  totalAppointments?: number;
}

export interface ProactiveMessage {
  chatId: string;
  platform: 'instagram' | 'whatsapp';
  text: string;
  reason: 'abandoned_cart' | 'restock' | 'follow_up' | 'win_back' | 'appointment_reminder';
}

// ── Configuration ───────────────────────────────────────────

const CONFIG = {
  /** Minimum days since last interaction before sending a win-back message */
  WIN_BACK_DAYS: 14,
  /** Minimum days since last order to trigger a follow-up */
  FOLLOW_UP_DAYS: 3,
  /** Maximum days after which we stop following up */
  MAX_FOLLOW_UP_DAYS: 30,
  /** Maximum proactive messages per customer per week */
  MAX_WEEKLY_PROACTIVE: 2,
};

// ── Main Entry Point ────────────────────────────────────────

/**
 * Generate a proactive message for a customer if eligible.
 * Returns null if no proactive action is appropriate.
 */
export async function generateProactiveMessage(
  supabase: SupabaseClient,
  customer: CustomerContext,
  businessType: 'appointments' | 'ecommerce'
): Promise<ProactiveMessage | null> {
  const lang = (customer.preferredLanguage || 'english') as any;

  // Rate-limit: check how many proactive messages we've already sent this week
  const recentCount = await getRecentProactiveCount(supabase, customer.workspaceId, customer.chatId, 7);
  if (recentCount >= CONFIG.MAX_WEEKLY_PROACTIVE) {
    v2log.info('PROACTIVE_ENGINE', 'Weekly proactive limit reached, skipping', {
      chatId: customer.chatId,
      recentCount,
    });
    return null;
  }

  if (businessType === 'ecommerce') {
    // 1. Check for abandoned cart
    const abandonedProduct = await checkAbandonedCart(supabase, customer.workspaceId, customer.chatId);
    if (abandonedProduct) {
      const text = getTemplate('proactive_abandoned_cart', lang, {
        name: customer.name || 'there',
        productName: abandonedProduct,
      }) || `Hey ${customer.name || 'there'}! Still thinking about that ${abandonedProduct}? It's still available 👀`;

      return {
        chatId: customer.chatId,
        platform: customer.platform,
        text,
        reason: 'abandoned_cart',
      };
    }

    // 2. Check for restocked wishlist items
    const restocked = await checkRestockedItems(supabase, customer.workspaceId, customer.chatId);
    if (restocked) {
      const text = getTemplate('proactive_restock', lang, {
        name: customer.name || 'there',
        productName: restocked,
      }) || `Good news ${customer.name || 'there'}! The ${restocked} you were looking at is back in stock 🔥`;

      return {
        chatId: customer.chatId,
        platform: customer.platform,
        text,
        reason: 'restock',
      };
    }
  }

  if (businessType === 'appointments') {
    // 3. Follow-up after appointment (3 days later)
    if (customer.lastAppointmentDate) {
      const daysSince = daysSinceDate(customer.lastAppointmentDate);
      if (daysSince >= CONFIG.FOLLOW_UP_DAYS && daysSince <= CONFIG.FOLLOW_UP_DAYS + 2) {
        const text = getTemplate('proactive_follow_up', lang, {
          name: customer.name || 'there',
        }) || `Hey ${customer.name || 'there'}! How was your visit? Hope everything was great 🙌`;

        return {
          chatId: customer.chatId,
          platform: customer.platform,
          text,
          reason: 'follow_up',
        };
      }
    }
  }

  // 4. Win-back: no interaction in 14+ days
  const lastInteraction = customer.lastOrderDate || customer.lastAppointmentDate;
  if (lastInteraction) {
    const daysSince = daysSinceDate(lastInteraction);
    if (daysSince >= CONFIG.WIN_BACK_DAYS && daysSince <= CONFIG.MAX_FOLLOW_UP_DAYS) {
      const text = getTemplate('proactive_win_back', lang, {
        name: customer.name || 'there',
      }) || `We miss you ${customer.name || 'there'}! Come check out what's new 💫`;

      return {
        chatId: customer.chatId,
        platform: customer.platform,
        text,
        reason: 'win_back',
      };
    }
  }

  return null;
}

// ── Database Helpers ────────────────────────────────────────

/**
 * Check if the customer has an abandoned cart (started order flow
 * but didn't complete in the last 48 hours).
 */
async function checkAbandonedCart(
  supabase: SupabaseClient,
  workspaceId: string,
  chatId: string
): Promise<string | null> {
  try {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('conversation_states')
      .select('data, stage, updated_at')
      .eq('workspace_id', workspaceId)
      .eq('chat_id', chatId)
      .in('stage', ['awaiting_variant', 'awaiting_order_details', 'awaiting_checkout_confirmation'])
      .lt('updated_at', cutoff)
      .limit(1)
      .maybeSingle();

    if (data?.data?.productName) {
      return data.data.productName;
    }
  } catch (e) {
    v2log.warn('PROACTIVE_ENGINE', 'Failed to check abandoned cart', { error: e });
  }

  return null;
}

/**
 * Check if any product the customer previously asked about is now
 * back in stock. Uses customer_notes to find product interests.
 */
async function checkRestockedItems(
  supabase: SupabaseClient,
  workspaceId: string,
  chatId: string
): Promise<string | null> {
  try {
    // Look for notes about out-of-stock items
    const { data: notes } = await supabase
      .from('customer_notes')
      .select('note')
      .eq('workspace_id', workspaceId)
      .eq('chat_id', chatId)
      .ilike('note', '%out of stock%')
      .limit(5);

    if (!notes || notes.length === 0) return null;

    // Extract product names from notes (simplified pattern matching)
    for (const note of notes) {
      const match = note.note.match(/interested in (.+?)(?:\s*(?:but|which|that)\s*(?:is|was)\s*out of stock)/i);
      if (match) {
        const productName = match[1].trim();

        // Check if it's back in stock
        const { data: product } = await supabase
          .from('products')
          .select('item_name, stock_level')
          .eq('workspace_id', workspaceId)
          .ilike('item_name', `%${productName}%`)
          .gt('stock_level', 0)
          .limit(1)
          .maybeSingle();

        if (product) {
          return product.item_name;
        }
      }
    }
  } catch (e) {
    v2log.warn('PROACTIVE_ENGINE', 'Failed to check restocked items', { error: e });
  }

  return null;
}

/**
 * Count how many proactive messages have been sent to a customer
 * in the last N days.
 */
async function getRecentProactiveCount(
  supabase: SupabaseClient,
  workspaceId: string,
  chatId: string,
  days: number
): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { count } = await supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('event_type', 'PROACTIVE_MESSAGE')
      .filter('metadata->>chat_id', 'eq', chatId)
      .gte('timestamp', cutoff);

    return count || 0;
  } catch (e) {
    v2log.warn('PROACTIVE_ENGINE', 'Failed to get recent proactive count', { error: e });
    return 0;
  }
}

/**
 * Record that a proactive message was sent (for rate-limiting).
 */
export async function recordProactiveMessage(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  message: ProactiveMessage
): Promise<void> {
  try {
    await supabase.from('activity_log').insert({
      user_id: userId,
      workspace_id: workspaceId,
      event_type: 'PROACTIVE_MESSAGE',
      description: `Proactive: ${message.reason}`,
      metadata: {
        chat_id: message.chatId,
        platform: message.platform,
        reason: message.reason,
        text_preview: message.text.slice(0, 100),
      },
    });
  } catch (e) {
    v2log.warn('PROACTIVE_ENGINE', 'Failed to record proactive message', { error: e });
  }
}

// ── Utility ─────────────────────────────────────────────────

function daysSinceDate(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  return (Date.now() - then) / (24 * 60 * 60 * 1000);
}
