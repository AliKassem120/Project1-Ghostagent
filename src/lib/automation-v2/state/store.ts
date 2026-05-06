/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — State Store
 * ═══════════════════════════════════════════════════════════════
 * Reads/writes conversation state from the conversation_states
 * table. All access is scoped by user_id + workspace_id + chat_id.
 *
 * Post-context: When clearing to idle after a successful action,
 * we preserve postContext so the bot can handle "change it",
 * "where is my order?", "same address", etc.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { ConversationStage, StateData, PostActionContext } from './types';
import { v2log } from '../logger';

export interface LoadedState {
    stage: ConversationStage;
    data: StateData | null;
    postContext: PostActionContext | null;
    error?: string;
}

export interface StateStoreResult {
    success: boolean;
    error?: string;
}

/**
 * Load the current conversation state for a specific chat.
 * Returns idle with null data if no state exists.
 */
export async function loadConversationState(
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string,
    chatId: string,
    workspaceType: 'appointments' | 'ecommerce' | 'saas_support'
): Promise<LoadedState> {
    try {
        const { data, error } = await supabase
            .from('conversation_states')
            .select('stage, data')
            .eq('user_id', userId)
            .eq('workspace_id', workspaceId)
            .eq('chat_id', chatId)
            .eq('workspace_type', workspaceType)
            .maybeSingle();

        if (error) {
            v2log.warn('STATE_STORE', 'Failed to load conversation state', { error, chatId });
            return { stage: 'idle', data: null, postContext: null, error: error.message };
        }

        if (!data || !data.stage || data.stage === 'idle') {
            const pc = data?.data?.postContext || null;
            return { stage: 'idle', data: null, postContext: pc };
        }

        return {
            stage: data.stage as ConversationStage,
            data: data.data as StateData || null,
            postContext: data.data?.postContext || null,
        };
    } catch (err: any) {
        const message = err?.message || String(err);
        v2log.warn('STATE_STORE', 'Exception loading state', { err, chatId });
        return { stage: 'idle', data: null, postContext: null, error: message };
    }
}

/**
 * Save/upsert the conversation state for a specific chat.
 * Uses the unique constraint on (user_id, workspace_id, chat_id, workspace_type).
 */
export async function saveConversationState(
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string,
    chatId: string,
    workspaceType: 'appointments' | 'ecommerce' | 'saas_support',
    stage: ConversationStage,
    stateData: StateData | null
): Promise<StateStoreResult> {
    const now = new Date().toISOString();

    try {
        const { data: existing, error: lookupError } = await supabase
            .from('conversation_states')
            .select('id')
            .eq('user_id', userId)
            .eq('workspace_id', workspaceId)
            .eq('chat_id', chatId)
            .eq('workspace_type', workspaceType)
            .maybeSingle();

        if (lookupError) {
            v2log.error('STATE_STORE', 'Failed to look up existing state', { error: lookupError, chatId, stage });
            return { success: false, error: lookupError.message };
        }

        if (existing) {
            const { error } = await supabase
                .from('conversation_states')
                .update({
                    stage,
                    data: stateData || {},
                    updated_at: now,
                })
                .eq('id', existing.id);

            if (error) {
                v2log.error('STATE_STORE', 'Failed to update state', { error, chatId, stage });
                return { success: false, error: error.message };
            }
        } else {
            const { error } = await supabase
                .from('conversation_states')
                .insert({
                    user_id: userId,
                    workspace_id: workspaceId,
                    chat_id: chatId,
                    workspace_type: workspaceType,
                    stage,
                    data: stateData || {},
                    updated_at: now,
                });

            if (error) {
                v2log.error('STATE_STORE', 'Failed to insert state', { error, chatId, stage });
                return { success: false, error: error.message };
            }
        }

        v2log.info('STATE_STORE', `Saved state: ${stage}`, { chatId, stage });
        return { success: true };
    } catch (err: any) {
        const message = err?.message || String(err);
        v2log.error('STATE_STORE', 'Failed to save state', { err, chatId, stage });
        return { success: false, error: message };
    }
}

/**
 * Clear the conversation state to idle, but optionally preserve postContext.
 */
export async function clearConversationState(
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string,
    chatId: string,
    workspaceType: 'appointments' | 'ecommerce' | 'saas_support',
    postContext?: PostActionContext | null
): Promise<StateStoreResult> {
    const data = postContext ? { stage: 'idle', postContext } : {};
    return saveConversationState(supabase, userId, workspaceId, chatId, workspaceType, 'idle', data as any);
}
