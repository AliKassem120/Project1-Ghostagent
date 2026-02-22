// reset-webhook.js
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function resetSubscriptions() {
    const pageId = '925088537362385'; // Your GhostAgent Page ID
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

    if (!token) {
        console.error("No token found in .env.local!");
        return;
    }

    // 1. Delete existing subscriptions
    console.log("1. Deleting old Page subscriptions...");
    const deleteUrl = `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?access_token=${token}`;
    try {
        const delRes = await fetch(deleteUrl, { method: 'DELETE' });
        console.log("Delete response:", await delRes.json());
    } catch (e) {
        console.error("Delete failed:", e.message);
    }

    // 2. Add new subscriptions
    console.log("\n2. Re-subscribing Page with 'feed' and 'messages'...");
    const postUrl = `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?subscribed_fields=messages,feed,comments&access_token=${token}`;
    try {
        const postRes = await fetch(postUrl, { method: 'POST' });
        console.log("Subscribe response:", await postRes.json());
    } catch (e) {
        console.error("Subscribe failed:", e.message);
    }
}

resetSubscriptions();
