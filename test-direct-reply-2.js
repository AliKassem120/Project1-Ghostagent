const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function directReplyTest() {
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
    const commentId = '17886893661329515'; // Older comment
    const message = "Testing a reply API call.";

    const url = `https://graph.facebook.com/v21.0/${commentId}/replies`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: message,
                access_token: token,
            }),
        });

        const data = await response.json();
        console.log("Reply to older comment:", data);
    } catch (e) { }
}
directReplyTest();
