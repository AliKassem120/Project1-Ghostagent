import { google } from "@ai-sdk/google";
import { streamText, convertToModelMessages } from "ai";
import dns from "node:dns";
import { createClient } from "@/lib/supabase-server";

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
        // Check if userId is passed in body (for public widgets) or derive from session (for dashboard testing)
        const supabase = await createClient();
        let ownerId = userId;

        if (!ownerId) {
            const { data: { user } } = await supabase.auth.getUser();
            ownerId = user?.id;
        }

        let systemPrompt = "You are a helpful assistant.";

        if (ownerId) {
            // 2. FETCH THE BRAIN (User Settings)
            const { data: settings } = await supabase
                .from('bot_settings')
                .select('business_name, system_instructions, tone')
                .eq('user_id', ownerId)
                .single();

            // 3. INJECT THE CONTEXT
            if (settings) {
                console.log(`Injecting context for business: ${settings.business_name}`);
                systemPrompt = `You are the AI support agent for ${settings.business_name || 'our company'}.
Your tone is ${settings.tone || 'Professional'}.

Here is your KNOWLEDGE BASE. You must answer based strictly on this:
---
${settings.system_instructions || ''}
---

If the answer is not in the text above, say: "I need to check with a human agent." or provide a helpful generic response if appropriate for the tone.`;
            }
        }

        const result = await streamText({
            model: google("gemini-flash-latest"),
            messages: await convertToModelMessages(messages),
            system: systemPrompt,
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
