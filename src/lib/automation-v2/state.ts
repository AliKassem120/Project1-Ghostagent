/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: State Manager
 * ═══════════════════════════════════════════════════════════════
 * Handles persistence of conversation states in Supabase.
 * States are scoped by (user_id, workspace_id, chat_id, workspace_type).
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { ConversationStateV2, ConversationStage } from './types';
import { v2log } from './logger';

export async function getConversationStateV2(
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string,
    chatId: string,
    workspaceType: 'appointments' | 'ecommerce'
): Promise<ConversationStateV2> {
    const { data, error } = await supabase
        .from('conversation_states')
        .select('stage, data')
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId)
        .eq('chat_id', chatId)
        .eq('workspace_type', workspaceType)
        .maybeSingle();

    if (error) {
        v2log.error('V2_STATE', 'Failed to fetch conversation state', { error, workspaceId, chatId });
        return { stage: 'idle' };
    }

    if (!data) {
        return { stage: 'idle' };
    }

    return {
        stage: data.stage as ConversationStage,
        ...data.data,
    };
}

export async function updateConversationStateV2(
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string,
    chatId: string,
    workspaceType: 'appointments' | 'ecommerce',
    state: ConversationStateV2
) {
    const { stage, ...data } = state;
    
    const { error } = await supabase
        .from('conversation_states')
        .upsert({
            user_id: userId,
            workspace_id: workspaceId,
            chat_id: chatId,
            workspace_type: workspaceType,
            stage,
            data,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id, workspace_id, chat_id, workspace_type'
        });

    if (error) {
        v2log.error('V2_STATE', 'Failed to update conversation state', { error, workspaceId, chatId, stage });
    }
}

export async function clearConversationStateV2(
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string,
    chatId: string,
    workspaceType: 'appointments' | 'ecommerce'
) {
    const { error } = await supabase
        .from('conversation_states')
        .delete()
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId)
        .eq('chat_id', chatId)
        .eq('workspace_type', workspaceType);

    if (error) {
        v2log.error('V2_STATE', 'Failed to clear conversation state', { error, workspaceId, chatId });
    }
}
