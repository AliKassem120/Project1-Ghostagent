import { google } from "@ai-sdk/google";
import { streamText } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        console.log("Chat API called. Messages count:", messages?.length);

        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            console.error("GOOGLE_GENERATIVE_AI_API_KEY is missing!");
            throw new Error("API Key configuration error.");
        }

        const result = streamText({
            model: google("gemini-1.5-pro"),
            messages,
        });

        return result.toTextStreamResponse();
    } catch (error) {
        console.error("Error in chat API route:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
