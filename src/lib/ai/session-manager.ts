/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Session Manager
 * ═══════════════════════════════════════════════════════════════
 * Session lifecycle management: timeout detection, freshness,
 * and loading/persisting session contexts.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { ConversationStage } from './types';
import { loadCustomerProfile, type CustomerProfile } from './customer-profile';
import { v2log } from './logger';

export interface SessionContext {
    state: ConversationStage;
    data: Record<string, any> | null;
    postContext: Record<string, any> | null;
    loopCount: number;
    lastBotMessage: string | null;
    lastInteractionAt: string; // ISO
    stateEnteredAt: string;    // ISO
    isFreshSession: boolean;
    customerProfile: CustomerProfile | null;
}

const SESSION_TIMEOUT_MINUTES = 15;

/**
 * Basic greeting detector. If user says a greeting, we can use it
 * to reset conversation stages from timeout.
 */
export function isGreeting(message: string): boolean {
    const clean = message.toLowerCase().trim().replace(/[^\w\s\u0621-\u064A]/g, '');
    const greetingWords = [
        'hi', 'hello', 'hey', 'yo', 'kifak', 'kifakom', 'marhaba', 'ahlan', 'welcome', 'bonjour', 'salut', 'salam'
    ];
    return greetingWords.some(w => clean === w || clean.startsWith(w + ' '));
}

/**
 * Determine if the gap since the last message exceeds the session timeout.
 */
export function isFreshSessionTimeout(lastInteractionAt: string, timeoutMinutes = SESSION_TIMEOUT_MINUTES): boolean {
    if (!lastInteractionAt) return false;
    const lastTime = new Date(lastInteractionAt).getTime();
    const now = Date.now();
    const gapMinutes = (now - lastTime) / (1000 * 60);
    return gapMinutes > timeoutMinutes;
}

/**
 * Load the current session state and customer profile. Handles timeout reset to 'idle'.
 */
export async function loadSession(
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string,
    chatId: string,
    workspaceType: 'appointments' | 'ecommerce',
    platform: 'instagram' | 'whatsapp'
): Promise<SessionContext> {
    try {
        const { data: row, error } = await supabase
            .from('conversation_states')
            .select('*')
            .eq('workspace_id', workspaceId)
            .eq('chat_id', chatId)
            .eq('workspace_type', workspaceType)
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            v2log.warn('SESSION_MANAGER', 'Failed to load conversation state from database', { error });
        }

        const customerProfile = await loadCustomerProfile(supabase, workspaceId, chatId, platform);

        if (!row) {
            // Default fresh session
            return {
                state: 'idle',
                data: null,
                postContext: null,
                loopCount: 0,
                lastBotMessage: null,
                lastInteractionAt: new Date().toISOString(),
                stateEnteredAt: new Date().toISOString(),
                isFreshSession: true,
                customerProfile
            };
        }

        const updatedAt = row.updated_at || new Date().toISOString();
        const timedOut = isFreshSessionTimeout(updatedAt, SESSION_TIMEOUT_MINUTES);

        const data = row.data || {};
        const postContext = data.postContext || null;

        if (timedOut && row.stage !== 'idle') {
            v2log.info('SESSION_MANAGER', 'Session timeout detected. Resetting stage to idle.', {
                lastInteractionAt: updatedAt,
                previousStage: row.stage
            });

            if (row.is_muted && row.muted_until === null) {
                try {
                    await supabase
                        .from('conversation_states')
                        .update({ is_muted: false })
                        .eq('id', row.id);
                    v2log.info('SESSION_MANAGER', 'Cleared auto-mute on session timeout', { chatId });
                } catch (dbErr) {
                    v2log.warn('SESSION_MANAGER', 'Failed to clear auto-mute on session timeout', { error: dbErr });
                }
            }

            return {
                state: 'idle',
                data: null,
                postContext, // Preserve previous action context for fallback routing
                loopCount: 0,
                lastBotMessage: null,
                lastInteractionAt: updatedAt,
                stateEnteredAt: new Date().toISOString(),
                isFreshSession: true,
                customerProfile
            };
        }

        return {
            state: (row.stage || 'idle') as ConversationStage,
            data,
            postContext,
            loopCount: data.loopCount || 0,
            lastBotMessage: data.lastBotMessage || null,
            lastInteractionAt: updatedAt,
            stateEnteredAt: data.stateEnteredAt || updatedAt,
            isFreshSession: false,
            customerProfile
        };

    } catch (err) {
        v2log.error('SESSION_MANAGER', 'Exception loading session', { error: err });
        return {
            state: 'idle',
            data: null,
            postContext: null,
            loopCount: 0,
            lastBotMessage: null,
            lastInteractionAt: new Date().toISOString(),
            stateEnteredAt: new Date().toISOString(),
            isFreshSession: true,
            customerProfile: null
        };
    }
}

/**
 * Save the updated session context back to conversation_states.
 */
export async function saveSession(
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string,
    chatId: string,
    workspaceType: 'appointments' | 'ecommerce',
    session: SessionContext,
    platform: 'instagram' | 'whatsapp'
): Promise<void> {
    try {
        const payload = {
            user_id: userId,
            workspace_id: workspaceId,
            workspace_type: workspaceType,
            chat_id: chatId,
            external_chat_id: chatId,
            stage: session.state,
            platform: platform.toUpperCase(),
            data: {
                ...(session.data || {}),
                loopCount: session.loopCount,
                lastBotMessage: session.lastBotMessage,
                stateEnteredAt: session.stateEnteredAt,
                postContext: session.postContext
            },
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('conversation_states')
            .upsert(payload, { onConflict: 'user_id,workspace_id,chat_id,workspace_type,platform' });

        if (error) {
            v2log.error('SESSION_MANAGER', 'Failed to upsert conversation state', { error, payload });
        } else {
            v2log.info('SESSION_MANAGER', 'Saved conversation session', {
                chatId,
                stage: session.state,
                loopCount: session.loopCount
            });
        }
    } catch (err) {
        v2log.error('SESSION_MANAGER', 'Exception saving session', { error: err });
    }
}
