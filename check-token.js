const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function checkToken() {
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
    const url = `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log("Token scopes:", data.data?.scopes);
    } catch (e) { }
}

checkToken();
