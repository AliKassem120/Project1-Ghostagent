const fetch = require('node-fetch');

async function checkPageFields() {
    const pageId = '925088537362385';
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

    // We can infer exactly what fields are allowed from the error message we get when we pass a wrong one
    const postUrl = `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?subscribed_fields=WRONG_FIELD&access_token=${token}`;
    try {
        const res = await fetch(postUrl, { method: 'POST' });
        console.log(await res.json());
    } catch (e) { }
}
require('dotenv').config({ path: '.env.local' });
checkPageFields();
