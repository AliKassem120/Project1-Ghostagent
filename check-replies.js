const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function checkReplies() {
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
    const commentId = '18003277562850399'; // ali_kassem10 comment
    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${commentId}/replies?fields=id,text,from,timestamp&access_token=${token}`);
        const data = await res.json();
        console.log("Replies directly from Instagram:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}
checkReplies();
