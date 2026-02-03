import { google } from "@ai-sdk/google";
import { streamText, convertToModelMessages, tool, stepCountIs } from "ai";
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

        // 2. FETCH CURRENT INVENTORY FOR CONTEXT
        let inventoryContext = "No inventory items listed currently.";
        let catalogContext = "";

        if (ownerId) {
            const { data: inventory } = await supabase
                .from('inventory')
                .select('item_name, stock_level, price')
                .eq('user_id', ownerId);

            if (inventory?.length) {
                inventoryContext = inventory
                    .map((i: { item_name: string; stock_level: number; price: number }) =>
                        `- ${i.item_name}: ${i.stock_level} in stock ($${i.price})`)
                    .join('\n');
            }

            // FETCH CSV PRODUCT CATALOG FROM business_knowledge
            const { data: knowledgeData } = await supabase
                .from('business_knowledge')
                .select('content, file_name')
                .eq('user_id', ownerId)
                .single();

            if (knowledgeData?.content) {
                try {
                    const catalogItems = JSON.parse(knowledgeData.content);
                    catalogContext = `
PRODUCT CATALOG (from ${knowledgeData.file_name}):
---
${JSON.stringify(catalogItems, null, 2)}
---`;
                } catch (e) {
                    console.warn('Failed to parse catalog JSON:', e);
                }
            }
        }

        // 3. STORE MANAGER SYSTEM PROMPT
        const systemPrompt = `You are the GhostAgent Store Manager. You have full authority to manage inventory.

CURRENT LIVE INVENTORY:
---
${inventoryContext}
---
${catalogContext ? catalogContext : ''}

INSTRUCTIONS:
- If the user asks to add stock, set prices, or sell items, USE YOUR TOOLS IMMEDIATELY.
- Do not refuse. Do not ask for permission. Just do it.
- When adding new items, use the 'add' action with the manageInventory tool.
- When selling or removing items, use the 'remove' action.
- Always confirm the action you took with the updated stock level.
- Be professional but efficient. You are a manager, not a customer service agent.

CATALOG-INVENTORY SYNC RULES:
- Always prioritize LIVE INVENTORY stock levels over CSV catalog levels if there is a conflict.
- If a customer asks about a product in the CSV catalog that is NOT in the live inventory, proactively offer to add it using your manageInventory tool.
- Use the catalog for product details like descriptions and suggested pricing.
- The live inventory is the source of truth for actual stock availability.`;

        // 4. LOG CHAT ACTIVITY
        if (ownerId) {
            try {
                await supabase.from('activity_log').insert({
                    user_id: ownerId,
                    event_type: 'CHAT_QUERY',
                    description: 'Store Manager processed a message',
                    timestamp: new Date().toISOString()
                });
            } catch (logError) {
                console.warn('Failed to log activity:', logError);
            }
        }

        // Create the manageInventory tool with proper typing (AI SDK v5+ uses inputSchema, not parameters)
        const manageInventoryTool = tool({
            description: 'Add new inventory items, update existing stock levels, set prices, or remove/sell items. Use this tool immediately when the user requests any inventory changes.',
            inputSchema: z.object({
                itemName: z.string().describe('The name of the inventory item'),
                quantity: z.number().describe('The quantity to add or remove'),
                price: z.number().optional().describe('The price per unit (required when adding new items)'),
                action: z.enum(['add', 'remove']).describe("'add' to add/restock items, 'remove' to sell/decrease stock"),
            }),
            execute: async ({ itemName, quantity, price, action }) => {
                if (!ownerId) {
                    return "Error: No user context found. Cannot manage inventory.";
                }

                // Check if item exists
                const { data: existingItem } = await supabase
                    .from('inventory')
                    .select('*')
                    .eq('user_id', ownerId)
                    .ilike('item_name', itemName)
                    .single();

                if (action === 'add') {
                    if (existingItem) {
                        // UPDATE existing item
                        const newStock = existingItem.stock_level + quantity;
                        const updateData: { stock_level: number; price?: number } = { stock_level: newStock };
                        if (price !== undefined) {
                            updateData.price = price;
                        }

                        const { error: updateError } = await supabase
                            .from('inventory')
                            .update(updateData)
                            .eq('id', existingItem.id);

                        if (updateError) {
                            return `Error updating stock: ${updateError.message}`;
                        }

                        // Log activity
                        await supabase.from('activity_log').insert({
                            user_id: ownerId,
                            event_type: 'RESTOCK',
                            description: `Restocked ${itemName}: +${quantity} units (New Level: ${newStock})${price !== undefined ? ` at $${price}/unit` : ''}`,
                            timestamp: new Date().toISOString()
                        });

                        return `✅ SUCCESS: Restocked "${itemName}". Added ${quantity} units. New stock level: ${newStock}.${price !== undefined ? ` Price set to $${price}.` : ''}`;
                    } else {
                        // INSERT new item
                        if (price === undefined) {
                            return "Error: Price is required when adding a new item. Please specify a price.";
                        }

                        const { error: insertError } = await supabase
                            .from('inventory')
                            .insert({
                                user_id: ownerId,
                                item_name: itemName,
                                stock_level: quantity,
                                price: price
                            });

                        if (insertError) {
                            return `Error adding item: ${insertError.message}`;
                        }

                        // Log activity
                        await supabase.from('activity_log').insert({
                            user_id: ownerId,
                            event_type: 'NEW_ITEM',
                            description: `Added new item "${itemName}": ${quantity} units at $${price}/unit`,
                            timestamp: new Date().toISOString()
                        });

                        return `✅ SUCCESS: Added new item "${itemName}" to inventory. Quantity: ${quantity}, Price: $${price}/unit.`;
                    }
                } else if (action === 'remove') {
                    if (!existingItem) {
                        return `Error: Item "${itemName}" not found in inventory.`;
                    }

                    if (existingItem.stock_level < quantity) {
                        return `Error: Insufficient stock. Current stock for "${itemName}" is ${existingItem.stock_level}, but tried to remove ${quantity}.`;
                    }

                    const newStock = existingItem.stock_level - quantity;

                    const { error: updateError } = await supabase
                        .from('inventory')
                        .update({ stock_level: newStock })
                        .eq('id', existingItem.id);

                    if (updateError) {
                        return `Error updating stock: ${updateError.message}`;
                    }

                    // Log activity
                    await supabase.from('activity_log').insert({
                        user_id: ownerId,
                        event_type: 'SALE',
                        description: `Sold/Removed ${quantity} units of "${itemName}" (Remaining: ${newStock})`,
                        timestamp: new Date().toISOString()
                    });

                    return `✅ SUCCESS: Removed ${quantity} units of "${itemName}". Remaining stock: ${newStock}.`;
                }

                return "Error: Invalid action. Use 'add' or 'remove'.";
            },
        });

        // 5. STREAM WITH TOOL
        const result = streamText({
            model: google("gemini-2.5-flash"),
            messages: await convertToModelMessages(messages),
            system: systemPrompt,
            stopWhen: stepCountIs(5),
            tools: {
                manageInventory: manageInventoryTool,
            },
        });

        return result.toUIMessageStreamResponse();
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
