import { SupabaseClient } from '@supabase/supabase-js';

export type AppointmentStateData = {
    workspaceId: string;
    serviceId?: string;
    serviceName: string;
    date: string;
    startTime: string;
    endTime?: string;
    customerName?: string;
    customerPhone?: string;
    timezone: string;
};

export type ConversationState = {
    stage: 'idle' | 'awaiting_booking_confirmation' | 'collecting_customer_details';
    data: Partial<AppointmentStateData>;
};

export async function getConversationState(
    supabase: SupabaseClient, 
    userId: string, 
    workspaceId: string, 
    chatId: string
): Promise<ConversationState> {
    const { data, error } = await supabase
        .from('conversation_states')
        .select('stage, data')
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId)
        .eq('chat_id', chatId)
        .eq('workspace_type', 'appointments')
        .maybeSingle();

    if (error || !data) {
        return { stage: 'idle', data: {} };
    }

    return data as ConversationState;
}

export async function updateConversationState(
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string,
    chatId: string,
    state: ConversationState
) {
    const { error } = await supabase
        .from('conversation_states')
        .upsert({
            user_id: userId,
            workspace_id: workspaceId,
            chat_id: chatId,
            workspace_type: 'appointments',
            stage: state.stage,
            data: state.data,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id, workspace_id, chat_id, workspace_type'
        });

    if (error) {
        console.error("[CONVERSATION_STATE] Update failed", error);
    }
}

export async function clearConversationState(
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string,
    chatId: string
) {
    const { error } = await supabase
        .from('conversation_states')
        .delete()
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId)
        .eq('chat_id', chatId)
        .eq('workspace_type', 'appointments');

    if (error) {
        console.error("[CONVERSATION_STATE] Clear failed", error);
    }
}
