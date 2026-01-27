import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            console.error("Error: GOOGLE_API_KEY is missing from environment variables.");
            return NextResponse.json(
                { error: "GOOGLE_API_KEY is not defined" },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Convert message history to Gemini format if needed, or just send the last message
        // For a simple chat, we'll construct the history or just send the prompt.
        // Simplifying for now: using the last user message as the prompt.
        // A more robust implementation would map the messages array to Gemini's history format.

        const lastMessage = messages[messages.length - 1];
        const prompt = lastMessage.content;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return NextResponse.json({ text });
    } catch (error) {
        console.error("Error in chat API:", error);
        return NextResponse.json(
            { error: "Failed to process chat request" },
            { status: 500 }
        );
    }
}
