const { generateText, tool, createGroq } = require('ai');
const { createGroq: cg } = require('@ai-sdk/groq');
const { z } = require('zod');
require('dotenv').config({ path: '.env.local' });

async function test() {
    const groq = cg({ apiKey: process.env.GROQ_API_KEY });
    const result = await generateText({
        model: groq('llama-3.3-70b-versatile'),
        system: "You are a helpful assistant.",
        messages: [{ role: 'user', content: 'What is the stock of PS5?' }],
        tools: {
            check_stock: tool({
                description: "Check stock",
                inputSchema: z.object({ item: z.string() }),
                execute: async ({ item }) => {
                    console.log("Executing tool check_stock for:", item);
                    return { item, stock: 10 };
                }
            })
        }
    });

    console.log("Keys in result:", Object.keys(result));
    console.log("Tool Calls:", JSON.stringify(result.toolCalls, null, 2));
    if (result.toolResults) {
        console.log("Tool Results:", JSON.stringify(result.toolResults, null, 2));
    } else {
        console.log("No toolResults property found.");
    }
}
test();
