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
}

export interface StateWriteResult {
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
            return { stage: 'idle', data: null, postContext: null };
        }

        if (!data || !data.stage || data.stage === 'idle') {
            // Even in idle, there may be postContext from a previous action
            const pc = data?.data?.postContext || null;
            return { stage: 'idle', data: null, postContext: pc };
        }

        return {
            stage: data.stage as ConversationStage,
            data: data.data as StateData || null,
            postContext: data.data?.postContext || null,
        };
    } catch (err) {
        v2log.warn('STATE_STORE', 'Exception loading state', { err, chatId });
        return { stage: 'idle', data: null, postContext: null };
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
    stateData: StateData | null,
    platform: string = 'instagram'
): Promise<StateWriteResult> {
    const now = new Date().toISOString();

    try {
        const { data: existing, error: selectError } = await supabase
            .from('conversation_states')
            .select('id')
            .eq('user_id', userId)
            .eq('workspace_id', workspaceId)
            .eq('chat_id', chatId)
            .eq('workspace_type', workspaceType)
            .maybeSingle();

        if (selectError) {
            v2log.error('STATE_STORE', 'Failed to find existing state', { error: selectError, chatId, stage });
            return { success: false, error: selectError.message || 'state_select_failed' };
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
                return { success: false, error: error.message || 'state_update_failed' };
            }
        } else {
            const { error } = await supabase
                .from('conversation_states')
                .insert({
                    user_id: userId,
                    workspace_id: workspaceId,
                    chat_id: chatId,
                    workspace_type: workspaceType,
                    platform,
                    stage,
                    data: stateData || {},
                    updated_at: now,
                });
            if (error) {
                v2log.error('STATE_STORE', 'Failed to insert state', { error, chatId, stage });
                return { success: false, error: error.message || 'state_insert_failed' };
            }
        }

        v2log.info('STATE_STORE', `Saved state: ${stage}`, { chatId, stage });
        return { success: true };
    } catch (err) {
        v2log.error('STATE_STORE', 'Failed to save state', { err, chatId, stage });
        return { success: false, error: err instanceof Error ? err.message : String(err) };
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
    postContext?: PostActionContext | null,
    platform: string = 'instagram'
): Promise<StateWriteResult> {
    const data = postContext ? { stage: 'idle', postContext } : {};
    return await saveConversationState(supabase, userId, workspaceId, chatId, workspaceType, 'idle', data as any, platform);
}
