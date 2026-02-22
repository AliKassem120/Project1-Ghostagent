const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function fixPageSubscription() {
    const pageId = '925088537362385';
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

    console.log("Subscribing Page to all app-level subscribed fields...");
    const postUrl = `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?access_token=${token}`;

    try {
        const postRes = await fetch(postUrl, { method: 'POST' });
        const result = await postRes.json();
        console.log("Fix Result:", result);

        // Check it again
        const checkRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?access_token=${token}`);
        const checkData = await checkRes.json();
        console.log("Current Page Subscriptions:", JSON.stringify(checkData, null, 2));

    } catch (e) {
        console.error("Fix failed:", e.message);
    }
}

fixPageSubscription();
