const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function privateReplyTest() {
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
    const commentId = '18003277562850399';
    const igAccountId = '17841480050016999';

    const url = `https://graph.facebook.com/v21.0/${igAccountId}/messages?access_token=${token}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                recipient: { comment_id: commentId },
                message: { text: "This is a private reply to your comment!" },
            }),
        });

        const data = await response.json();
        console.log("Private reply:", data);
    } catch (e) {
        console.error(e);
    }
}
privateReplyTest();
