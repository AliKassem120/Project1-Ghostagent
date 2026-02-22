const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function fixWebhook() {
    const pageId = '925088537362385'; // GhostAgent Page ID
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

    console.log("Re-subscribing Page correctly...");
    // Only 'messages' and 'feed' are valid page fields. 'feed' covers comments.
    const postUrl = `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?subscribed_fields=messages,feed&access_token=${token}`;

    try {
        const postRes = await fetch(postUrl, { method: 'POST' });
        const result = await postRes.json();
        console.log("Fix Result:", result);
    } catch (e) {
        console.error("Fix failed:", e.message);
    }
}

fixWebhook();
