const fetch = require('node-fetch');

async function testWebhook() {
    const WEBHOOK_URL = 'https://ghostagent.qzz.io/api/webhook/instagram';

    // Real comment from ali_kassem10 asking about the Pro Plan
    const payload = {
        "object": "instagram",
        "entry": [
            {
                "id": "17841480050016999",
                "time": 1709251200,
                "changes": [
                    {
                        "field": "comments",
                        "value": {
                            "id": "17886893661329515",
                            "text": "Wow this looks amazing! How much is the pro plan?",
                            "from": {
                                "id": "1433718888490869",
                                "username": "ali_kassem10"
                            },
                            "media": {
                                "id": "18011332682675270",
                                "media_product_type": "FEED"
                            }
                        }
                    }
                ]
            }
        ]
    };

    console.log(`🚀 Firing Live Postman-style Webhook to ${WEBHOOK_URL}...`);

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hub-signature-256': 'sha256=fake_signature_for_testing_video'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log('✅ Webhook accepted the payload (Status 200)!');
            console.log('Now check your Ghost Agent Dashboard to see the AI reply LIVE.');
        } else {
            console.log(`❌ Failed: Status ${response.status}`);
            console.log(await response.text());
        }
    } catch (e) {
        console.error('Error sending webhook:', e);
    }
}

testWebhook();
