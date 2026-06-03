'use server';

import { generateSmartLink } from '@/lib/whatsapp';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export async function approveInteraction(id: number, comment: string) {
    try {
        const deepseekKey = process.env.DEEPSEEK_API_KEY;
        if (!deepseekKey) {
            throw new Error('DEEPSEEK_API_KEY is missing');
        }

        const deepseek = createOpenAI({
            baseURL: 'https://api.deepseek.com/v1',
            apiKey: deepseekKey,
        });
        // Use DeepSeek V4-Flash
        const model = deepseek('deepseek-chat');

        // Use Groq to analyze intent and detect product info
        const system = `You are GhostAgent, a high-end AI sales assistant for an Instagram store. 
Analyze the customer's comment and extract product information. 
If no specific product is mentioned, assume they are asking about the "Phantom Hoodie" ($85.00).
Respond in a helpful, premium tone.`;

        const completion = await generateObject({
            model,
            system,
            prompt: `Analyze this comment: "${comment}"`,
            schema: z.object({
                productName: z.string().default('Phantom Hoodie'),
                price: z.number().default(85.00),
                personalizedMessage: z.string(),
            }),
            temperature: 0.2,
        });

        const aiOutput = completion.object;
        const productName = aiOutput.productName || 'Phantom Hoodie';
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
