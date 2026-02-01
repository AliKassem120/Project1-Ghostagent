const https = require('https');
require('dotenv').config({ path: '.env.local' });

const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

if (!key) {
    console.error('No API key found');
    process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error('Error:', json.error.message);
                return;
            }
            console.log('Available Models:');
            json.models.forEach(m => {
                if (m.name.includes('gemini')) {
                    console.log(`- ${m.name} (${m.displayName})`);
                }
            });
        } catch (e) {
            console.error('Parse Error:', e.message);
        }
    });
}).on('error', (e) => {
    console.error('Fetch Error:', e.message);
});
