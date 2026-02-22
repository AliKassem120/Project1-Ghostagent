const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function runTests() {
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
    const igAccountId = '17841480050016999';
    const mediaId = '18011332682675270';
    const commentId = '18003277562850399';

    console.log("Hitting Facebook endpoints to trigger checklist...\n");

    const requests = [
        // 1. instagram_business_content_publish test
        {
            name: "instagram_business_content_publish",
            url: `https://graph.facebook.com/v21.0/${igAccountId}/media`,
            method: 'POST',
            body: { image_url: "https://example.com/test.jpg", access_token: token }
        },
        // 2. instagram_business_manage_messages
        {
            name: "instagram_business_manage_messages",
            url: `https://graph.facebook.com/v21.0/${igAccountId}/conversations?access_token=${token}`,
            method: 'GET'
        },
        // 3. instagram_business_manage_comments
        {
            name: "instagram_business_manage_comments",
            url: `https://graph.facebook.com/v21.0/${mediaId}/comments?access_token=${token}`,
            method: 'GET'
        },
        // 4. public_profile
        {
            name: "public_profile",
            url: `https://graph.facebook.com/v21.0/me?fields=id,name,picture&access_token=${token}`,
            method: 'GET'
        },
        // 5. Human Agent
        {
            name: "Human Agent",
            url: `https://graph.facebook.com/v21.0/${igAccountId}/messages`,
            method: 'POST',
            body: {
                recipient: { comment_id: commentId },
                message: { text: "Human agent test" },
                messaging_type: "MESSAGE_TAG",
                tag: "HUMAN_AGENT",
                access_token: token
            }
        }
    ];

    for (const req of requests) {
        console.log(`Testing [${req.name}]...`);
        try {
            const options = { method: req.method, headers: { 'Content-Type': 'application/json' } };
            if (req.body) options.body = JSON.stringify(req.body);

            const res = await fetch(req.url, options);
            const data = await res.json();
            console.log(`Status: ${res.status}`);
            console.log(`Response: ${JSON.stringify(data).substring(0, 150)}...\n`);
        } catch (e) {
            console.error(`Error: ${e.message}\n`);
        }
    }
}

runTests();
