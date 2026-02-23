// import { google } from "@ai-sdk/google";
import { createGroq } from '@ai-sdk/groq';
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

        /*
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing!");
        }
        */

        const groq = createGroq({
            apiKey: process.env.GROQ_API_KEY,
        });

        // 3. IDENTIFY THE USER (BOT OWNER)
        const supabase = await createClient();
        let ownerId = userId;
        let ownerName = "Boss";

        if (!ownerId) {
            const { data: { user } } = await supabase.auth.getUser();
            ownerId = user?.id;
            if (user?.user_metadata?.full_name) {
                ownerName = user.user_metadata.full_name.split(' ')[0];
            } else if (user?.email) {
                ownerName = user.email.split('@')[0];
            }
        }

        if (!ownerId) {
            return new Response("Unauthorized", { status: 401 });
        }

        // 3.5 CHECK BILLING / TRIAL LIMITS
        const { checkUserLimit } = await import('@/lib/billing');
        const limitCheck = await checkUserLimit(ownerId);
        if (!limitCheck.allowed) {
            return new Response(
                JSON.stringify({
                    error: "Subscription limit reached",
                    message: limitCheck.reason
                }),
                { status: 403, headers: { "Content-Type": "application/json" } }
            );
        }

        // 2. FETCH CURRENT INVENTORY FOR CONTEXT (Keep existing logic...)
        // ... (We just need to ensure the variable names match what's below or above) ...
        // Actually, to avoid breaking the surrounding code organization, I will rewrite the section 1-3.

        // RE-FETCHING INVENTORY LOGIC TO BE SAFE WITH VARIABLE SCOPE
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
        const systemPrompt = `You are the GhostAgent Store Manager. You have full authority to manage inventory and communicate with customers via Instagram DM.

CURRENT LIVE INVENTORY:
---
${inventoryContext}
---
${catalogContext ? catalogContext : ''}

CONTEXT:
You are speaking to the business owner, ${ownerName}. Answer questions about system status or test your capabilities. Do not try to sell them products.

INSTRUCTIONS:
- If the owner asks to add stock, set prices, or sell items, USE YOUR TOOLS IMMEDIATELY.
- If the owner asks to SEND A DM to someone (e.g., "send a dm to USER saying MESSAGE"), use the 'sendInstagramDM' tool immediately.
- Do not refuse. Do not ask for permission. Just do it.
- When adding new items, use the 'add' action with the manageInventory tool.
- When selling or removing items, use the 'remove' action.
- Always confirm the action you took with the updated stock level or a confirmation that the DM was sent.
- Be professional but efficient. You are a manager, reporting to the owner.

CATALOG-INVENTORY SYNC RULES:
- Always prioritize LIVE INVENTORY stock levels over CSV catalog levels if there is a conflict.
- The live inventory is the source of truth for actual stock availability.`;

        // 4. LOG CHAT ACTIVITY
        // ... handled per tool execution ...

        // Create the manageInventory tool
        const manageInventoryTool = tool({
            description: 'Add new inventory items, update existing stock levels, set prices, or remove/sell items. Use this tool immediately when the user requests any inventory changes.',
            inputSchema: z.object({
                itemName: z.string().describe('The name of the inventory item'),
                quantity: z.coerce.number().describe('The quantity to add or remove'),
                price: z.coerce.number().optional().describe('The price per unit (required when adding new items)'),
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
                        const newStock = (existingItem.stock_level || 0) + quantity;
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

        // Create the sendInstagramDM tool
        const sendInstagramDMTool = tool({
            description: 'Send a direct message to an Instagram user by their username. Use this when the user asks you to send a DM.',
            inputSchema: z.object({
                username: z.string().describe('The Instagram username (e.g., ali_kassem10)'),
                content: z.string().describe('The message content to send'),
            }),
            execute: async ({ username, content }) => {
                if (!ownerId) return "Error: No user context found.";

                try {
                    // 1. Get Instagram connection
                    const { data: connection } = await supabase
                        .from('user_connections')
                        .select('*')
                        .eq('user_id', ownerId)
                        .eq('provider', 'INSTAGRAM')
                        .single();

                    if (!connection) return "Error: No Instagram account connected. Please connect Instagram in settings first.";

                    // 2. Setup Unipile credentials
                    const dsn = process.env.UNIPILE_DSN || '';
                    let baseUrl = 'https://api23.unipile.com:15397';
                    let apiKey = process.env.UNIPILE_API_KEY || '';

                    if (dsn.includes('@')) {
                        const [proto, rest] = dsn.split('://');
                        const [auth, domain] = rest.split('@');
                        baseUrl = `${proto}://${domain}`;
                        apiKey = auth;
                    }

                    // 3. Search for existing chat with this username
                    const searchRes = await fetch(`${baseUrl}/api/v1/chats?account_id=${connection.account_id}`, {
                        headers: { 'X-API-KEY': apiKey }
                    });

                    if (!searchRes.ok) return `Error searching chats: ${await searchRes.text()}`;

                    const searchData = await searchRes.json();
                    const chats = searchData.items || [];

                    // Find chat where an attendee matches the username
                    const targetChat = chats.find((c: any) =>
                        c.attendees?.some((a: any) =>
                            a.attendee_specifics?.public_identifier?.toLowerCase() === username.toLowerCase() ||
                            a.attendee_name?.toLowerCase().includes(username.toLowerCase())
                        )
                    );

                    if (!targetChat) return `Error: Could not find an active chat with "${username}". Make sure you have messaged them before or they have messaged you.`;

                    // 4. Send Message
                    const sendRes = await fetch(`${baseUrl}/api/v1/chats/${targetChat.id}/messages`, {
                        method: 'POST',
                        headers: {
                            'X-API-KEY': apiKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            text: content,
                            sender_id: connection.account_id
                        })
                    });

                    if (!sendRes.ok) return `Error sending message: ${await sendRes.text()}`;

                    // 5. Log activity with metadata for threading
                    await supabase.from('activity_log').insert({
                        user_id: ownerId,
                        event_type: 'AI_REPLY',
                        description: `Sent DM to ${username}: "${content.substring(0, 30)}..."`,
                        metadata: {
                            chat_id: targetChat.id,
                            username: username,
                            is_sender: true
                        },
                        timestamp: new Date().toISOString()
                    });

                    return `✅ SUCCESS: Message sent to ${username}.`;

                } catch (error: any) {
                    console.error('sendInstagramDM Error:', error);
                    return `Error: ${error.message}`;
                }
            }
        });

        // 5. STREAM WITH TOOLS (Groq)
        // Note: AI SDK automatically converts tools to OpenAI format compatible with Groq
        const result = streamText({
            model: groq("llama-3.3-70b-versatile"),
            messages: await convertToModelMessages(messages),
            system: systemPrompt,
            stopWhen: stepCountIs(5),
            tools: {
                manageInventory: manageInventoryTool,
                sendInstagramDM: sendInstagramDMTool,
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
