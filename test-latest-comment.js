const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function checkComments() {
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
    const mediaId = '18011332682675270';

    // 1. Get real comments
    const res = await fetch(`https://graph.facebook.com/v21.0/${mediaId}/comments?fields=id,text,from,timestamp&access_token=${token}`);
    const data = await res.json();

    console.log("Real Comments:", JSON.stringify(data, null, 2));

    if (data.data?.length > 0) {
        const targetComment = data.data[0];
        console.log(`\nLet's test replying to comment ID: ${targetComment.id}`);

        // 2. Fire the webhook payload for this specific comment
        const WEBHOOK_URL = 'https://ghostagent.qzz.io/api/webhook/instagram';

        const payload = {
            "object": "instagram",
            "entry": [
                {
                    "id": "17841480050016999",
                    "time": Math.floor(Date.now() / 1000),
                    "changes": [
                        {
                            "field": "comments",
                            "value": {
                                "id": targetComment.id,
                                "text": targetComment.text,
                                "from": targetComment.from,
                                "media": {
                                    "id": mediaId,
                                    "media_product_type": "FEED"
                                }
                            }
                        }
                    ]
                }
            ]
        };

        console.log(`🚀 Firing Live Postman-style Webhook to ${WEBHOOK_URL} for comment ${targetComment.id}...`);

        const hookRes = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hub-signature-256': 'sha256=fake_signature_for_testing_video'
            },
            body: JSON.stringify(payload)
        });

        if (hookRes.ok) {
            console.log('✅ Webhook accepted the payload!');
        } else {
            console.log(`❌ Failed: Status ${hookRes.status}`);
        }
    }
}

checkComments();
