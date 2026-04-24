import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const systemToken = process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN;
const fromPhoneId = process.env.WHATSAPP_FROM_PHONE_NUMBER_ID;
const to = '96178820707'; // Ali's verified number

async function run() {
    console.log('Testing WhatsApp API...');
    console.log('From Phone ID:', fromPhoneId);
    console.log('Token length:', systemToken?.length);
    
    const res = await fetch(`https://graph.facebook.com/v18.0/${fromPhoneId}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${systemToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: 'Hello! This is a backend diagnostic test message from Ghost Agent. 👻' }
        })
    });
    console.log('Status:', res.status);
    console.log('Response:', await res.text());
}
run();
