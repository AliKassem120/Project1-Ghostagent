import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateText, tool, stepCountIs } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';

export const maxDuration = 60;
export const dynamic = 'force-dynamic'; // Ensure webhook is always dynamic

export async function POST(req: Request) {
    console.log(" [DEBUG] /api/webhook HIT", new Date().toISOString());
    try {
        const body = await req.json();
        console.log(" [DEBUG] /api/webhook Body:", JSON.stringify(body).slice(0, 100));
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

        const systemPrompt = `Act as the 'Ghost Agent' Instagram Manager. Your goal is to process incoming data from the Unipile API and generate helpful, human-like replies for business customers.

CURRENT LIVE INVENTORY:
---
${inventoryContext}
---
${catalogContext}

YOUR RESPONSIBILITIES:
1. IDENTIFY INTENT: Determine if the user is asking about pricing, availability, or general information.
2. GENERATE RESPONSE: Create a reply that fits the brand voice (professional yet friendly).
3. MANAGE INVENTORY: If the user explicitly asks to buy or check stock, use the 'manageInventory' tool.

CONSTRAINTS:
- If a message is a complaint, set the "review_needed" flag to true in the JSON output.
- Never mention that you are an AI or using Unipile. 
- Keep responses under 500 characters.
- Your final output (after any tool use) MUST be a valid JSON object.

OUTPUT JSON FORMAT:
{
  "text": "Your generated reply goes here.",
  "review_needed": boolean
}
`;

        // 3. DEFINE TOOLS (Keep existing manageInventoryTool)
        // 4. GENERATE AI RESPONSE (Groq)
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
        const { text: rawAiResponse } = await generateText({
            model: groq("llama-3.3-70b-versatile"),
            system: systemPrompt,
            messages: [
                { role: 'user', content: text }
            ],
            // Tools removed for security in DM context (Read-Only via System Prompt)
        });

        console.log(`Raw AI Response: ${rawAiResponse}`);

        // Parse JSON output
        let replyText = rawAiResponse;
        let reviewNeeded = false;

        try {
            // Attempt to clean markdown code blocks if present (common with LLMs)
            const cleanJson = rawAiResponse.replace(/```json\n?|\n?```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            replyText = parsed.text || rawAiResponse;
            reviewNeeded = parsed.review_needed || false;
        } catch (e) {
            console.warn('AI did not return valid JSON, using raw text.');
        }

        // 5. REPLY VIA UNIPILE
        const replyResponse = await fetch(`https://api23.unipile.com:15397/api/v1/chats/${chatId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': unipileKey,
            },
            body: JSON.stringify({
                text: replyText
            }),
        });

        if (!replyResponse.ok) {
            console.error('Failed to send reply to Unipile:', await replyResponse.text());
        }

        // Log the interaction
        const eventType = reviewNeeded ? 'MANUAL_REVIEW' : 'IG_INTERACTION';
        await supabase.from('activity_log').insert({
            user_id: ownerId,
            event_type: eventType,
            description: reviewNeeded ? `Complaint flagged: ${text.substring(0, 30)}...` : `Replied to DM from ${sender_id}`,
            timestamp: new Date().toISOString()
        });

        return NextResponse.json({ status: 'processed', reply: replyText, review_needed: reviewNeeded });

    } catch (e: any) {
        console.error('Webhook Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
