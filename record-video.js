const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function checkCommentsAndFireDelayed() {
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
    const mediaId = '18011332682675270';

    console.log("⏳ Starting 15-second countdown...");
    console.log("🎬 START YOUR SCREEN RECORDING NOW!");
    console.log("👉 Go comment on your Instagram post...");

    setTimeout(async () => {
        console.log("\n🔍 Fetching your new comment...");

        // 1. Get real comments
        const res = await fetch(`https://graph.facebook.com/v21.0/${mediaId}/comments?fields=id,text,from,timestamp&access_token=${token}`);
        const data = await res.json();

        if (data.data?.length > 0) {
            const targetComment = data.data[0]; // Gets the most recent comment you just made!

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

            console.log(`🚀 Firing Webhook for your new comment: "${targetComment.text}"`);

            const hookRes = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hub-signature-256': 'sha256=fake_signature_for_testing_video'
                },
                body: JSON.stringify(payload)
            });

            if (hookRes.ok) {
                console.log('✅ Webhook accepted! Check the dashboard, then refresh Instagram!');
            }
        }
    }, 15000); // 15 seconds
}

checkCommentsAndFireDelayed();
