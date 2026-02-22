const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function checkSubscribedApps() {
    const pageId = '925088537362385';
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

    console.log("Checking Page subscriptions...");
    const url = `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?access_token=${token}`;

    try {
        const res = await fetch(url, { method: 'GET' });
        const result = await res.json();
        console.log("Subscriptions:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Check failed:", e.message);
    }
}

checkSubscribedApps();
