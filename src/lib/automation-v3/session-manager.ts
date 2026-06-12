import { SupabaseClient } from '@supabase/supabase-js';
import { loadCustomerProfile, type CustomerProfile } from '@/lib/ai/customer-profile';
import type { ConversationStage, Platform } from '@/lib/ai/types';
import { cacheGetSession, cacheSetSession } from '@/lib/ai/session-cache';

import type { SessionContext } from './types';

const SESSION_TIMEOUT_MINUTES = 30;
const MAX_LOOP_COUNT = 3;

export async function loadSession(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  chatId: string,
  workspaceType: 'appointments' | 'ecommerce',
  platform: Platform
): Promise<SessionContext> {
  // Cache-first: try Redis before Supabase
  const cached = await cacheGetSession(workspaceId, chatId);
  if (cached) return cached;

  const { data: stateRow } = await supabase
    .from('conversation_states')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .eq('chat_id', chatId)
    .maybeSingle();

  const now = new Date().toISOString();
  let session: SessionContext;

  if (!stateRow) {
    session = {
      state: 'idle',
      data: null,
      postContext: null,
      loopCount: 0,
      lastBotMessage: null,
      lastInteractionAt: now,
      stateEnteredAt: now,
      isFreshSession: true,
      customerProfile: null,
      platform,
      workspaceId,
      chatId,
      userId,
    };
  } else {
    const lastInteraction = new Date(stateRow.updated_at || stateRow.data?.updated_at || 0);
    const minutesSinceLastInteraction = (Date.now() - lastInteraction.getTime()) / 60000;
    const isTimedOut = minutesSinceLastInteraction > SESSION_TIMEOUT_MINUTES;

    // Explicit handoff expiry: if state is handoff and timed out, force reset to idle
    // and clear stale context so the LLM doesn't see old handoff messages
    const isHandoffExpired = stateRow.stage === 'handoff' && minutesSinceLastInteraction > SESSION_TIMEOUT_MINUTES;
    const shouldReset = isTimedOut || isHandoffExpired;

    session = {
      state: shouldReset ? 'idle' : (stateRow.stage as ConversationStage),
      data: shouldReset ? null : (stateRow.data || {}),
      postContext: shouldReset ? null : (stateRow.data?.postContext || null),
      loopCount: shouldReset ? 0 : (stateRow.data?.loopCount || 0),
      lastBotMessage: shouldReset ? null : (stateRow.data?.lastBotMessage || null),
      lastInteractionAt: stateRow.updated_at || now,
      stateEnteredAt: shouldReset ? now : (stateRow.data?.stateEnteredAt || stateRow.updated_at || now),
      isFreshSession: shouldReset || stateRow.stage === 'idle',
      customerProfile: null,
      platform,
      workspaceId,
      chatId,
      userId,
    };
  }

  // Load customer profile using existing cross-channel identity mapper
  session.customerProfile = await loadCustomerProfile(supabase, workspaceId, chatId, platform);

  return session;
}

export async function saveSession(
  supabase: SupabaseClient,
  session: SessionContext,
  workspaceType: 'appointments' | 'ecommerce'
): Promise<void> {
  const now = new Date().toISOString();

  await supabase.from('conversation_states').upsert({
    user_id: session.userId,
    workspace_id: session.workspaceId,
    workspace_type: workspaceType,
    chat_id: session.chatId,
    external_chat_id: session.chatId,
    stage: session.state,
    platform: session.platform.toUpperCase(),
    data: {
      ...(session.data || {}),
      loopCount: session.loopCount,
      lastBotMessage: session.lastBotMessage,
      stateEnteredAt: session.stateEnteredAt,
      postContext: session.postContext,
      updated_at: now,
    },
    updated_at: now,
  }, { onConflict: 'user_id,workspace_id,chat_id,workspace_type,platform' });

  // Write-through to Redis cache
  cacheSetSession(session.workspaceId, session.chatId, session).catch(() => {});
}

export function isFreshSessionTimeout(lastInteractionAt: string, timeoutMinutes = SESSION_TIMEOUT_MINUTES): boolean {
  if (!lastInteractionAt) return true;
  const minutes = (Date.now() - new Date(lastInteractionAt).getTime()) / 60000;
  return minutes > timeoutMinutes;
}

export function shouldDetectLoop(session: SessionContext, currentBotMessage: string): boolean {
  if (!session.lastBotMessage) return false;
  // Simple similarity check — if bot is about to send same message again
  const similarity = calculateSimilarity(session.lastBotMessage, currentBotMessage);
  return similarity > 0.85;
}

function calculateSimilarity(a: string, b: string): number {
  // Jaccard similarity on word sets
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}
