const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function completeFacebookTests() {
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
    const igAccountId = '17841480050016999';
    const commentId = '18003277562850399'; // ali_kassem10's comment

    console.log("🚀 Running API tests to satisfy Facebook App Review...");

    // 1. Public Profile Test
    try {
        console.log("\n1️⃣ Testing Public Profile...");
        const res1 = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${token}`);
        console.log("Result:", await res1.json());
    } catch (e) { console.error(e); }

    // 2. Instagram Business Manage Comments Test
    try {
        console.log("\n2️⃣ Testing Comments (Replying to comment)...");
        const res2 = await fetch(`https://graph.facebook.com/v21.0/${commentId}/replies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Test reply for FB Review", access_token: token })
        });
        console.log("Result:", await res2.json());
    } catch (e) { console.error(e); }

    // 3. Instagram Business Manage Messages Test & Human Agent Test
    try {
        console.log("\n3️⃣ Testing Messages & Human Agent Tag...");
        const res3 = await fetch(`https://graph.facebook.com/v21.0/${igAccountId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { comment_id: commentId }, // Or id: "USER_IG_SID"
                message: { text: "Human agent test message" },
                messaging_type: "MESSAGE_TAG",
                tag: "HUMAN_AGENT",
                access_token: token
            })
        });
        console.log("Result:", await res3.json());
    } catch (e) { console.error(e); }

    console.log("\n✅ Done. Refresh your Facebook Developer Dashboard to verify!");
}

completeFacebookTests();
