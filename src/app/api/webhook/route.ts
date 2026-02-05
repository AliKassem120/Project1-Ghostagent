import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateText, convertToModelMessages, tool } from 'ai';
import { google } from "@ai-sdk/google";
import { z } from 'zod';

export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const unipileKey = process.env.UNIPILE_API_KEY;

        if (!unipileKey) {
            console.error('Missing UNIPILE_API_KEY');
            return NextResponse.json({ error: 'Configuration Error' }, { status: 500 });
        }

        // Validate Event
        if (body.event !== 'message.received') {
            return NextResponse.json({ status: 'ignored', reason: 'Not a message.received event' });
        }

        const { text, sender_id, chat_id, thread_id, account_id } = body.data;
        const chatId = chat_id || thread_id; // Unipile sometimes uses different names

        // Ignore own messages (if sender_id matches account_id? Unipile usually filters, but good to check)
        // For now, assume Unipile sends incoming messages.

        console.log(`Received Webhook Message from ${sender_id}: ${text}`);

        // 1. IDENTIFY OWNER (Supabase User)
        // In a real app, we'd look up which user owns this Instagram account (account_id).
        // For this single-user workspace, we'll fetch the first user who has an inventory, or just the first user in 'auth.users' if possible.
        // Since we can't query auth.users directly easily, we'll finding a user_id from the 'inventory' table as a heuristic.
        const supabase = await createClient();
        const { data: inventoryUser } = await supabase.from('inventory').select('user_id').limit(1).single();

        const ownerId = inventoryUser?.user_id;

        if (!ownerId) {
            console.error('No Store Owner found in DB');
            return NextResponse.json({ error: 'No owner found' }, { status: 404 });
        }

        // 2. BUILD CONTEXT (Duplicate of chat/route.ts)
        let inventoryContext = "No inventory items listed currently.";
        let catalogContext = "";

        const { data: inventory } = await supabase
            .from('inventory')
            .select('item_name, stock_level, price')
            .eq('user_id', ownerId);

        if (inventory?.length) {
            inventoryContext = inventory
                .map((i: any) => `- ${i.item_name}: ${i.stock_level} in stock ($${i.price})`)
                .join('\n');
        }

        const { data: knowledgeData } = await supabase
            .from('business_knowledge')
            .select('content, file_name')
            .eq('user_id', ownerId)
            .single();

        if (knowledgeData?.content) {
            try {
                const catalogItems = JSON.parse(knowledgeData.content);
                catalogContext = `\nPRODUCT CATALOG (from ${knowledgeData.file_name}):\n---\n${JSON.stringify(catalogItems, null, 2)}\n---`;
            } catch (e) {
                console.warn('Failed to parse catalog JSON:', e);
            }
        }

        const systemPrompt = `You are the GhostAgent Store Manager handling an Instagram DM.
        
CURRENT LIVE INVENTORY:
---
${inventoryContext}
---
${catalogContext}

INSTRUCTIONS:
- Answer the customer's question based on the inventory and catalog.
- If they want to buy, you can "reserve" items by removing them from stock using the tool (simulating a sale or hold).
- Be concise and friendly. This is Instagram.
- Use emojis.
- IF YOU USE A TOOL, DO NOT SAY "I have used the tool". Just say "I've added that to your order!" or similar.
`;

        // 3. DEFINE TOOLS
        const manageInventoryTool = tool({
            description: 'Update stock levels (sell/add).',
            inputSchema: z.object({
                itemName: z.string(),
                quantity: z.number(),
                price: z.number().optional(),
                action: z.enum(['add', 'remove']),
            }),
            execute: async ({ itemName, quantity, price, action }) => {
                // Simplified execute logic for brevity - copying core parts
                const { data: existingItem } = await supabase.from('inventory').select('*').eq('user_id', ownerId).ilike('item_name', itemName).single();

                if (action === 'remove') {
                    if (!existingItem || existingItem.stock_level < quantity) return `Error: Not enough stock of ${itemName}`;
                    const newStock = existingItem.stock_level - quantity;
                    await supabase.from('inventory').update({ stock_level: newStock }).eq('id', existingItem.id);
                    await supabase.from('activity_log').insert({
                        user_id: ownerId,
                        event_type: 'IG_SALE', // distinct event
                        description: `Sold ${quantity} ${itemName} via Instagram DM`,
                        timestamp: new Date().toISOString()
                    });
                    return `Success: Sold ${quantity} ${itemName}. Remaining: ${newStock}`;
                }
                return "Action not supported in DM mode yet.";
            },
        });

        // 4. GENERATE AI RESPONSE (Non-streaming)
        const { text: aiResponse } = await generateText({
            model: google("gemini-2.5-flash"),
            system: systemPrompt,
            messages: [
                { role: 'user', content: text } // Single turn context for now
            ],
            tools: { manageInventory: manageInventoryTool },
            // @ts-ignore - maxSteps is supported in AI SDK Core but types might be lagging
            maxSteps: 5, // Allow multi-step tool use
        });

        console.log(`AI Response: ${aiResponse}`);

        // 5. REPLY VIA UNIPILE
        const replyResponse = await fetch(`https://api23.unipile.com:15397/api/v1/chats/${chatId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': unipileKey,
            },
            body: JSON.stringify({
                text: aiResponse
            }),
        });

        if (!replyResponse.ok) {
            console.error('Failed to send reply to Unipile:', await replyResponse.text());
            // We still return 200 to the webhook provider to acknowledge receipt
        }

        // Log the interaction
        await supabase.from('activity_log').insert({
            user_id: ownerId,
            event_type: 'IG_INTERACTION',
            description: `Replied to DM from ${sender_id}`,
            timestamp: new Date().toISOString()
        });

        return NextResponse.json({ status: 'processed', reply: aiResponse });

    } catch (e: any) {
        console.error('Webhook Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
