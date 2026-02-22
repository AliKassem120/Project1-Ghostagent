const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function fixAllAppSubscriptions() {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const appToken = `${appId}|${appSecret}`;
    const callbackUrl = 'https://ghostagent.qzz.io/api/webhook/instagram';
    const verifyToken = 'ghost_agent_secret';

    const objects = ['page', 'permissions', 'application', 'user'];

    for (const obj of objects) {
        console.log(`Updating ${obj} webhook...`);
        const url = `https://graph.facebook.com/v21.0/${appId}/subscriptions`;
        const params = new URLSearchParams({
            object: obj,
            callback_url: callbackUrl,
            verify_token: verifyToken,
            access_token: appToken,
        });

        if (obj === 'page') {
            params.append('fields', 'messages,feed,conversations');
        } else if (obj === 'permissions') {
            params.append('fields', 'connected,instagram_manage_comments,instagram_manage_messages,pages_manage_metadata,pages_messaging,pages_read_engagement');
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
            });
            console.log(`Result for ${obj}:`, await res.json());
        } catch (e) {
            console.error(e.message);
        }
    }
}
fixAllAppSubscriptions();
