
import { translateReply } from '../src/lib/automation-v2/model';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testArabiziTranslation() {
    const templates = [
        "What service would you like to book?",
        "Sure — what day and time would you like?",
        "That slot is taken. Do you have another time in mind?",
        "Perfect — your haircut is confirmed for Tomorrow at 11:00 AM. ✅"
    ];

    console.log('🌍 [TEST] Simulating Arabizi Translations...\n');

    for (const text of templates) {
        const translated = await translateReply({
            reply: text,
            targetLanguage: 'arabizi',
            tone: 'Professional but friendly'
        });
        
        console.log(`🇬🇧 English: "${text}"`);
        console.log(`🇱🇧 Arabizi: "${translated}"`);
        console.log('---');
    }
}

testArabiziTranslation().catch(console.error);
