const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function checkTokenPage() {
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${token}`);
        const data = await res.json();
        console.log("Page associated with token:", data);

        const resIg = await fetch(`https://graph.facebook.com/v21.0/me?fields=instagram_business_account&access_token=${token}`);
        const dataIg = await resIg.json();
        console.log("Instagram account linked to page:", dataIg);

    } catch (e) { }
}
checkTokenPage();
