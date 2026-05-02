import type { V3BusinessContext, V3ConversationMemory } from './schema';
import { findProduct, findService } from './validator';
import { clearV3Memory } from './context';

export async function runV3Action(args: {
    supabase: any;
    chatId: string;
    ctx: V3BusinessContext;
    memory: V3ConversationMemory;
}): Promise<{ success: boolean; reply?: string; actionName?: string }> {
    const { supabase, chatId, ctx, memory } = args;

    if (ctx.workspaceType === 'ecommerce' && memory.mode === 'ordering' && memory.confirmed) {
        const product = findProduct(ctx, memory.productName);
        if (!product) return { success: false };

        const { error } = await supabase.from('orders').insert({
            user_id: ctx.userId,
            workspace_id: ctx.workspaceId,
            instagram_user_id: chatId,
            instagram_handle: 'Customer',
            customer_name: memory.customerName,
            customer_phone: memory.customerPhone,
            customer_address: memory.customerAddress,
            item_requested: product.name,
            status: 'Pending',
            raw_message: JSON.stringify({ source: 'automation-v3', memory }),
            created_at: new Date().toISOString(),
        });

        if (error) return { success: false };
        await clearV3Memory({ supabase, userId: ctx.userId, workspaceId: ctx.workspaceId, chatId, workspaceType: ctx.workspaceType });
        return { success: true, actionName: 'order_created', reply: 'Tmm, t2akad el order.' };
    }

    // Appointment creation is intentionally conservative in V3 phase 1.
    // V2 booking flow remains safer until date/time normalization is fully replaced.
    return { success: false };
}
