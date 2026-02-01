const { GoogleGenerativeAI } = require('@google/generative-ai');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

async function connectivityCheck(host) {
    return new Promise((resolve) => {
        console.log(`2. Diagnostic: Pinging ${host} via Node.js https...`);
        const req = https.get(`https://${host}`, (res) => {
            console.log(`   - Connection successful (Status: ${res.statusCode})`);
            resolve(true);
        });
        req.on('error', (e) => {
            console.error(`   - Connection FAILED to ${host}: ${e.message} (Code: ${e.code})`);
            resolve(false);
        });
        req.setTimeout(5000, () => {
            console.error(`   - Connection TIMEOUT to ${host}`);
            req.destroy();
            resolve(false);
        });
    });
}

async function test() {
    console.log(`Node Version: ${process.version}`);
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
    console.log('1. Checking Key:', key ? 'Present (Starts with ' + key.substring(0, 4) + '...)' : 'MISSING');

    if (!key) {
        console.error('ERROR: No API Key found in .env.local');
        return;
    }

    const testHost = 'generativelanguage.googleapis.com';
    const canConnectGoogle = await connectivityCheck('www.google.com');
    const canConnectGemini = await connectivityCheck(testHost);

    if (!canConnectGemini) {
        console.error(`CRITICAL: Node.js cannot reach ${testHost}.`);
        console.log("Tip: Try running with node --dns-result-order=ipv4first test-key.js");
        return;
    }

    try {
        console.log('3. Listing available models...');
        const genAI = new GoogleGenerativeAI(key);
        // We can't easily list models with the standard library without v1?
        // Let's try to just use "gemini-1.5-flash" but check if the key is valid by another mean.
        // Actually, let's try calling a model with no version specified if possible, or try 'v1'.

        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const result = await model.generateContent("Say 'Ready'");
        const response = await result.response;
        console.log('4. SUCCESS! Response:', response.text());
    } catch (error) {
        console.error('4. FAILED:', error.message);
        if (error.status === 404) {
            console.log("Tip: 404 often means the model name is slightly off or not enabled for this key.");
        }
    }
}
test();
