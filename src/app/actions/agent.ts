'use server';

import { generateSmartLink } from '@/lib/whatsapp';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function approveInteraction(id: number, comment: string) {
    try {
        // Use OpenAI to analyze intent and detect product info
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are GhostAgent, a high-end AI sales assistant for an Instagram store. 
                    Analyze the customer's comment and extract product information. 
                    If no specific product is mentioned, assume they are asking about the "Phantom Hoodie" ($85.00).
                    Respond in a helpful, premium tone. 
                    Return your response as a JSON object with: 
                    "productName", "price", "personalizedMessage"`
                },
                {
                    role: "user",
                    content: `Analyze this comment: "${comment}"`
                }
            ],
            response_format: { type: "json_object" }
        });

        const aiOutput = JSON.parse(completion.choices[0].message.content || "{}");
        const productName = aiOutput.productName || "Phantom Hoodie";
        const price = aiOutput.price || 85.00;
        const personalizedMessage = aiOutput.personalizedMessage;

        // Generate Smart WhatsApp Link
        const whatsappLink = generateSmartLink({
            phoneNumber: '+961 70 123 456', // From settings
            productName: productName,
            price: price
        });

        // Construct the DM response
        const response = `${personalizedMessage} 

Click here to complete your order on WhatsApp:
${whatsappLink}

Looking forward to serving you! 👻`;

        return {
            success: true,
            response,
            whatsappLink
        };
    } catch (error) {
        console.error('AI Processing Error:', error);
        return {
            success: false,
            error: 'Failed to process with AI'
        };
    }
}
