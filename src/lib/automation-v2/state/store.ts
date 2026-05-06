/**
 * GhostAgent — State Store
 * Reads/writes conversation state from conversation_states.
 * State persistence is fail-closed: if a state transition cannot be saved,
 * the engine must not continue as if the flow exists.
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

function failStateSave(message: string, details: any): never {
    v2log.error('STATE_STORE', message, details);
    throw new Error(details?.error?.message || details?.error || message);
}

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
            failStateSave('Failed to look up existing state', { error: lookupError, chatId, stage });
        }

        if (existing) {
            const { error } = await supabase
                .from('conversation_states')
                .update({ stage, data: stateData || {}, updated_at: now })
                .eq('id', existing.id);

            if (error) failStateSave('Failed to update state', { error, chatId, stage });
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

            if (error) failStateSave('Failed to insert state', { error, chatId, stage });
        }

        v2log.info('STATE_STORE', `Saved state: ${stage}`, { chatId, stage });
        return { success: true };
    } catch (err: any) {
        const message = err?.message || String(err);
        v2log.error('STATE_STORE', 'Failed to save state', { err, chatId, stage });
        throw new Error(message);
    }
}

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
