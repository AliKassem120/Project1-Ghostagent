const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function fullBlastTests() {
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
    const igAccountId = '17841480050016999';

    console.log("Starting full blast to satisfy Meta...");

    // 1. instagram_business_content_publish
    try {
        await fetch(`https://graph.facebook.com/v21.0/${igAccountId}/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_url: "https://hub.dummyapis.com/Image?text=Test&height=120&width=120",
                caption: "Test App Review Publish",
                access_token: token
            })
        });
        console.log("✅ Publish endpoint hit.");
    } catch (e) { }

    // 2. instagram_business_manage_messages (GET conversations)
    try {
        await fetch(`https://graph.facebook.com/v21.0/${igAccountId}/conversations?access_token=${token}`);
        console.log("✅ Messages endpoint hit.");
    } catch (e) { }

    // 3. instagram_business_manage_comments (GET comments on media)
    try {
        await fetch(`https://graph.facebook.com/v21.0/18011332682675270/comments?access_token=${token}`);
        console.log("✅ Comments endpoint hit.");
    } catch (e) { }

    // 4. public_profile (GET me)
    try {
        await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name,picture&access_token=${token}`);
        console.log("✅ Public Profile endpoint hit.");
    } catch (e) { }

    // 5. Human Agent (POST messages with tag)
    try {
        await fetch(`https://graph.facebook.com/v21.0/${igAccountId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: "1433718888490869" }, // Using ali_kassem10 IG scope ID
                message: { text: "Human agent response test" },
                messaging_type: "MESSAGE_TAG",
                tag: "HUMAN_AGENT",
                access_token: token
            })
        });
        console.log("✅ Human Agent endpoint hit.");
    } catch (e) { }

    console.log("\nDone! Please hard refresh the Meta Dashboard (Ctrl+Shift+R or Cmd+Shift+R)");
}

fullBlastTests();
