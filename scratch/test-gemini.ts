import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
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
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    console.log('API Key exists:', !!apiKey);
    if (!apiKey) return;

    try {
        const google = createGoogleGenerativeAI({ apiKey });
        console.log('Testing gemini-2.0-flash...');
        const result = await generateText({
            model: google('gemini-2.0-flash'),
            prompt: 'Reply with the word "hello" and nothing else.',
        });
        console.log('Result:', result.text);
    } catch (e) {
        console.error('Error during test:', e);
    }
}

main();
