import { tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// Helper to get Admin Supabase client internally (Read Only)
const getAdminClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
    );
};

export const checkEcommerceInventoryTool = (workspaceId: string) => ({
    description: "Queries the exact, real-time stock count and variants for the active workspace's store. Call this before confirming product availability.",
    parameters: z.object({
        product_name: z.string().describe("The name or category of the product to check. Be broad if checking availability of types.")
    }),
    execute: async ({ product_name }: any) => {
        const supabase = getAdminClient();
        console.log(`[Read Tool] check_ecommerce_inventory: ${product_name} | ws: ${workspaceId}`);
        const { data, error } = await supabase.from('inventory')
            .select('item_name, stock_level, price, description')
            .eq('workspace_id', workspaceId)
            .ilike('item_name', `%${product_name}%`)
            .limit(10);
            
        if (error) {
            console.error('[Read Tool] Inventory error:', error);
            return "Failed to check inventory due to a system error.";
        }
        if (!data || data.length === 0) return `Product matching "${product_name}" is NOT found in the inventory system.`;
        
        return data.map(item => `- ${item.item_name}: ${item.stock_level > 0 ? `${item.stock_level} in stock` : 'OUT OF STOCK'} ($${item.price}). ${item.description || ''}`).join('\n');
    }
});
