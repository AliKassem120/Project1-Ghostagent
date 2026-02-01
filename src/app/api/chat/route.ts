import { google } from "@ai-sdk/google";
import { streamText, convertToModelMessages, tool } from "ai";
import { z } from "zod";
import dns from "node:dns";
import { createClient } from "@/utils/supabase/server";

// Enforce IPv4 preference to prevent "fetch failed" on networks with broken IPv6
if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

export const maxDuration = 30;

export async function POST(req: Request) {
    try {
        const { messages, userId } = await req.json();
        console.log('Message received on server:', messages);
        console.log('Stream started');

        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing!");
        }

        // 1. IDENTIFY THE USER (BOT OWNER)
        const supabase = await createClient();
        let ownerId = userId;

        if (!ownerId) {
            const { data: { user } } = await supabase.auth.getUser();
            ownerId = user?.id;
        }

        let systemPrompt = "You are a helpful assistant.";

        if (ownerId) {
            // 2. FETCH THE BRAIN (User Settings & Inventory)
            const [settingsRes, inventoryRes] = await Promise.all([
                supabase
                    .from('bot_settings')
                    .select('business_name, system_instructions, tone')
                    .eq('user_id', ownerId)
                    .single(),
                supabase
                    .from('inventory')
                    .select('item_name, stock_level, price')
                    .eq('user_id', ownerId)
            ]);

            const settings = settingsRes.data;
            const inventory = inventoryRes.data;

            const inventoryContext = inventory?.length
                ? inventory.map(i => `- ${i.item_name}: ${i.stock_level} in stock ($${i.price})`).join('\n')
                : "No inventory items listed currently.";

            // 3. INJECT THE CONTEXT
            if (settings) {
                console.log(`Injecting context for business: ${settings.business_name}`);
                systemPrompt = `You are the AI support agent for ${settings.business_name || 'our company'}.
Your tone is ${settings.tone || 'Professional'}.

KNOWLEDGE BASE:
---
${settings.system_instructions || ''}
---

LIVE INVENTORY (Current Stock):
---
${inventoryContext}
---

If the answer is not in the knowledge base or inventory above, say: "I need to check with a human agent." or provide a helpful generic response if appropriate for the tone.`;
            }

            // 4. LOG ACTIVITY
            try {
                await supabase.from('activity_log').insert({
                    user_id: ownerId,
                    event_type: 'CHAT_QUERY',
                    description: 'AI Agent processed a new user message',
                    timestamp: new Date().toISOString()
                });
            } catch (logError) {
                console.warn('Failed to log activity:', logError);
            }
        }

        const result = await streamText({
            model: google("gemini-1.5-flash-latest"),
            messages: await convertToModelMessages(messages),
            system: systemPrompt,
            maxSteps: 5,
            tools: {
                updateInventory: tool({
                    description: 'Update the stock level of an inventory item. Use -1 for a sale, +N for restock. Automatically logs the change.',
                    parameters: z.object({
                        itemName: z.string().describe('The name of the item to update (case-insensitive)'),
                        quantityChange: z.number().describe('The amount to change stock by (negative to decrease/sell, positive to increase/restock)'),
                    }),
                    execute: async ({ itemName, quantityChange }: { itemName: string, quantityChange: number }) => {
                        if (!ownerId) return "Error: No user context found. Cannot update inventory.";

                        // 1. Find the item
                        const { data: item, error: findError } = await supabase
                            .from('inventory')
                            .select('*')
                            .eq('user_id', ownerId)
                            .ilike('item_name', itemName)
                            .single();

                        if (findError || !item) {
                            return `Error: Item "${itemName}" not found in inventory.`;
                        }

                        // 2. Calculate New Stock
                        const newStock = item.stock_level + quantityChange;

                        // 3. Update DB
                        const { error: updateError } = await supabase
                            .from('inventory')
                            .update({ stock_level: newStock })
                            .eq('id', item.id);

                        if (updateError) {
                            return `Error updating stock: ${updateError.message}`;
                        }

                        // 4. Log Activity
                        await supabase.from('activity_log').insert({
                            user_id: ownerId,
                            event_type: quantityChange < 0 ? 'SALE' : 'RESTOCK',
                            description: `Updated stock for ${item.item_name}: ${quantityChange > 0 ? '+' : ''}${quantityChange} (New Level: ${newStock})`,
                            timestamp: new Date().toISOString()
                        });

                        return `Success: Stock for "${item.item_name}" updated. Old: ${item.stock_level}, New: ${newStock}.`;
                    },
                }),
            },
        } as any); // Cast options to any to bypass potential type mismatches

        return (result as any).toDataStreamResponse();
    } catch (error) {
        console.error("CRITICAL Chat API Error:", error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : "Internal Server Error",
                details: error
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
