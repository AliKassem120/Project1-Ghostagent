const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function fixSubscriptions() {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const appToken = `${appId}|${appSecret}`;
    const callbackUrl = 'https://ghostagent.qzz.io/api/webhook/instagram';
    const verifyToken = 'ghost_agent_secret';

    console.log("════════════════════════════════════════");
    console.log("🔧 FIXING INSTAGRAM WEBHOOK SUBSCRIPTION");
    console.log("════════════════════════════════════════\n");

    // Subscribe the Instagram object with 'comments' + 'messages' fields
    // AND update the callback URL to the custom domain
    const url = `https://graph.facebook.com/v21.0/${appId}/subscriptions`;

    const params = new URLSearchParams({
        object: 'instagram',
        callback_url: callbackUrl,
        verify_token: verifyToken,
        fields: 'comments,messages,messaging_postbacks,message_reactions',
        access_token: appToken,
    });

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
        const data = await res.json();
        console.log("Result:", JSON.stringify(data, null, 2));

        if (data.success) {
            console.log("\n✅ SUCCESS! Instagram webhook now subscribed to 'comments' field!");
            console.log("   Callback URL: " + callbackUrl);
        } else {
            console.log("\n❌ Failed:", data.error?.message || "Unknown error");
        }
    } catch (e) {
        console.error("Error:", e.message);
    }

    // Verify the fix
    console.log("\n📋 Verifying subscriptions...");
    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${appId}/subscriptions?access_token=${appToken}`);
        const data = await res.json();
        const igSub = data.data?.find(d => d.object === 'instagram');
        if (igSub) {
            console.log("Instagram webhook URL:", igSub.callback_url);
            console.log("Instagram fields:", igSub.fields?.map(f => f.name).join(', '));
        }
    } catch (e) { console.error(e.message); }
}

fixSubscriptions();
