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

        // The generated text goes into `system_instructions`, which is injected into the
        // BUSINESS INSTRUCTIONS section of our master system prompt (buildSystemPrompt).
        // It must be concise, additive context — NOT a full standalone system prompt.
        const prompt = `You are an expert AI assistant that writes concise, business-specific instructions for a customer service chatbot.

The business is called "${businessName || 'this business'}".

The owner described their business as:
"${description}"

Your task: Write ONLY the specific, additive instructions that make this chatbot unique to this business.
Focus on:
- What makes this business special (unique products, services, or offers)
- Any specific policies the bot should know (returns, delivery areas, operating hours if mentioned)
- Specific upsell opportunities or frequently asked questions for this niche
- Any edge cases unique to this type of business

STRICT RULES:
- Do NOT write generic chatbot instructions (greetings, politeness, tone) — those are already handled by the system.
- Do NOT repeat instructions about language, emojis, or handoff — those are already in the system.
- Do NOT write "You are a customer service agent for..." — start directly with business-specific context.
- Keep it under 200 words. Be specific and actionable. Plain text only, no markdown.
- Write in second person (e.g., "When asked about delivery...").`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.6,
                max_tokens: 400,
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
