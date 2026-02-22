const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function checkMedia() {
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
    const mediaId = '18011332682675270';
    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${mediaId}?fields=media_type,media_product_type&access_token=${token}`);
        const data = await res.json();
        console.log(data);
    } catch (e) { }
}
checkMedia();
