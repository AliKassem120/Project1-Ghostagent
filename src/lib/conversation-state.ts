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

export type EcomStateData = {
    workspaceId: string;
    productId?: string;
    variantId?: string;
    productName: string;
    variantLabel?: string;
    quantity: number;
    price: number;
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
};

export type ConversationState = {
    stage:
        | 'idle'
        | 'awaiting_service'
        | 'awaiting_date_time'
        | 'awaiting_customer_details'
        | 'awaiting_booking_confirmation'
        | 'collecting_customer_details'
        | 'awaiting_product_variant'
        | 'awaiting_order_details'
        | 'awaiting_checkout_confirmation'
        | 'booking_failed'
        | 'order_failed'
        | 'handoff';
    data: any;
};

export async function getConversationState(
    supabase: SupabaseClient, 
    userId: string, 
    workspaceId: string, 
    chatId: string,
    workspaceType: 'appointments' | 'ecommerce'
): Promise<ConversationState> {
    const { data, error } = await supabase
        .from('conversation_states')
        .select('stage, data')
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId)
        .eq('chat_id', chatId)
        .eq('workspace_type', workspaceType)
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
    workspaceType: 'appointments' | 'ecommerce',
    state: ConversationState
) {
    const { error } = await supabase
        .from('conversation_states')
        .upsert({
            user_id: userId,
            workspace_id: workspaceId,
            chat_id: chatId,
            workspace_type: workspaceType,
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
        console.error("[CONVERSATION_STATE] Clear failed", error);
    }
}
