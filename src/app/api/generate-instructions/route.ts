import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { description, businessName } = await req.json();

        if (!description || typeof description !== 'string') {
            return NextResponse.json({ error: 'Description is required' }, { status: 400 });
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
        }

        const prompt = `You are a helpful assistant that writes detailed, professional system instructions for an AI customer service chatbot.

The business is called "${businessName || 'a business'}".

The user gave you this short description of what their bot should do:
"${description}"

Based on that, write detailed system instructions that cover:
- What the business sells and does
- How to greet customers
- How to handle pricing questions
- Shipping and return policies (make reasonable assumptions)
- Tone and personality guidelines
- What to do when the bot doesn't know the answer

Write the instructions in second person (e.g., "You are a customer service agent for..."). Keep it under 500 words. Be specific and actionable. Do NOT use markdown formatting — write plain text only.`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 800,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Groq API error:', err);
            return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
        }

        const data = await response.json();
        const generatedText = data.choices?.[0]?.message?.content?.trim() || '';

        return NextResponse.json({ text: generatedText });
    } catch (error) {
        console.error('Generate error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
