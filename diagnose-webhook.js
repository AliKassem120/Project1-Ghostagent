const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function fullDiagnostic() {
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const igAccountId = '17841480050016999';
    const pageId = '925088537362385';

    console.log("════════════════════════════════════════");
    console.log("🔍 FULL WEBHOOK DIAGNOSTIC");
    console.log("════════════════════════════════════════\n");

    // 1. Check Page subscribed_apps
    console.log("1️⃣ Page Subscribed Apps:");
    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?access_token=${token}`);
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) { console.error(e.message); }

    // 2. Check App webhook subscriptions
    console.log("\n2️⃣ App Webhook Subscriptions (requires app access token):");
    try {
        const appToken = `${appId}|${appSecret}`;
        const res = await fetch(`https://graph.facebook.com/v21.0/${appId}/subscriptions?access_token=${appToken}`);
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) { console.error(e.message); }

    // 3. Check recent media and comments
    console.log("\n3️⃣ Recent Media on Instagram Account:");
    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${igAccountId}/media?fields=id,caption,timestamp,comments_count&limit=3&access_token=${token}`);
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));

        if (data.data && data.data.length > 0) {
            const firstMedia = data.data[0];
            console.log(`\n4️⃣ Comments on latest post (${firstMedia.id}):`);
            const commRes = await fetch(`https://graph.facebook.com/v21.0/${firstMedia.id}/comments?fields=id,text,from,timestamp&access_token=${token}`);
            const commData = await commRes.json();
            console.log(JSON.stringify(commData, null, 2));
        }
    } catch (e) { console.error(e.message); }

    // 5. Check token debug info
    console.log("\n5️⃣ Token Debug Info:");
    try {
        const res = await fetch(`https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`);
        const data = await res.json();
        console.log("App ID:", data.data?.app_id);
        console.log("Type:", data.data?.type);
        console.log("Expires:", data.data?.expires_at === 0 ? "Never" : new Date(data.data?.expires_at * 1000));
        console.log("Valid:", data.data?.is_valid);
        console.log("Scopes:", data.data?.scopes?.join(', '));
    } catch (e) { console.error(e.message); }
}

fullDiagnostic();
