import { google } from "@ai-sdk/google";
import { streamText } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        console.log('Message received on server:', messages);

        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing!");
        }

        const result = streamText({
            model: google("gemini-1.5-pro"),
            messages,
        });

        return result.toTextStreamResponse();
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
