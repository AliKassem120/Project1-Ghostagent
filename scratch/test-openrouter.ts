import { createOpenAI } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, ...vals] = line.split('=');
        if (key && !key.startsWith('#')) {
            process.env[key.trim()] = vals.join('=').trim();
        }
    });
}

async function main() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return;

    const openrouter = createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
    });

    try {
        console.log('Testing tool calling with openrouter/free...');
        const result = await generateText({
            model: openrouter('openrouter/free'),
            prompt: 'Please check the current weather in Beirut.',
            tools: {
                getWeather: tool({
                    description: 'Get the current weather for a city',
                    parameters: z.object({
                        city: z.string().describe('The city name'),
                    }),
                    execute: async ({ city }) => {
                        console.log(`Tool getWeather called for city: ${city}`);
                        return { temperature: '22°C', condition: 'Sunny' };
                    },
                }),
            },
        });
        console.log('Text result:', result.text);
        console.log('Tool calls made:', result.toolCalls.length);
        if (result.toolCalls.length > 0) {
            console.log('First tool call:', result.toolCalls[0].args);
        }
    } catch (e) {
        console.error('Error during tool call test:', e);
    }
}

main();
