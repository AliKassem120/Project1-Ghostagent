const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function directReplyTest() {
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
    const commentId = '18003277562850399'; // The comment we just webhook'd
    const message = "Thanks for asking! Our Pro plan is $49/mo. Let me know if you need a setup link! 🚀";

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
        console.log(data);
    } catch (e) {
        console.error(e.message);
    }
}
directReplyTest();
