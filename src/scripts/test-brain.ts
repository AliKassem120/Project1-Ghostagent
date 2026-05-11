/**
 * GhostAgent Brain — Full Coverage Test
 * Tests all customer intent types across a variety of approaches.
 * Run: npx tsx src/scripts/test-brain.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && !key.startsWith('#')) process.env[key.trim()] = vals.join('=').trim();
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TestCase {
    label: string;
    message: string;
    expectedIntent?: string; // for documentation only
}

const TEST_GROUPS: { group: string; tests: TestCase[] }[] = [
    {
        group: '1. GREETINGS & SMALL TALK',
        tests: [
            { label: 'English greeting',         message: 'hey',                     expectedIntent: 'greeting' },
            { label: 'Arabic greeting',           message: 'salam',                   expectedIntent: 'greeting' },
            { label: 'Arabizi greeting',          message: 'hala kifak',              expectedIntent: 'greeting' },
            { label: 'Small talk - how are you',  message: 'how are you',             expectedIntent: 'small_talk' },
            { label: 'Small talk - wsh',          message: 'wsh',                     expectedIntent: 'small_talk' },
            { label: 'Small talk - kif el 7al',   message: 'kif el 7al',              expectedIntent: 'small_talk' },
        ],
    },
    {
        group: '2. PRODUCT INQUIRY',
        tests: [
            { label: 'What do you sell',          message: 'what do you sell?',       expectedIntent: 'product_availability' },
            { label: 'Do you have hoodies',        message: 'do you have hoodies?',   expectedIntent: 'product_question' },
            { label: 'Arabizi - fi 3andkon',       message: 'fi 3andkon hoodies?',    expectedIntent: 'product_availability' },
            { label: 'Saw product on page',        message: 'I saw the hoodie on your page', expectedIntent: 'product_question' },
        ],
    },
    {
        group: '3. PRICE QUESTIONS',
        tests: [
            { label: 'How much',                   message: 'how much is the hoodie?', expectedIntent: 'price_question' },
            { label: 'Arabizi addesh',             message: 'addesh l hoodie?',        expectedIntent: 'price_question' },
        ],
    },
    {
        group: '4. PURCHASE INTENT',
        tests: [
            { label: 'I want to buy',              message: 'i want to buy a hoodie',  expectedIntent: 'purchase_intent' },
            { label: 'Arabizi bade',               message: 'bade eshtere hoodie',     expectedIntent: 'purchase_intent' },
            { label: 'Give me one',                message: 'give me one',             expectedIntent: 'purchase_intent' },
        ],
    },
    {
        group: '5. ORDER STATUS',
        tests: [
            { label: 'Where is my order',          message: 'where is my order?',      expectedIntent: 'order_status' },
            { label: 'Arabizi wein l order',       message: 'wein l order taba3e?',    expectedIntent: 'order_status' },
        ],
    },
    {
        group: '6. CANCEL ORDER',
        tests: [
            { label: 'Cancel my order',            message: 'cancel my order',         expectedIntent: 'cancel_order' },
            { label: 'Arabizi el8e',               message: 'el8e l order',            expectedIntent: 'cancel_order' },
        ],
    },
    {
        group: '7. SHIPPING & POLICY',
        tests: [
            { label: 'How long shipping',          message: 'how long does shipping take?', expectedIntent: 'shipping_question' },
            { label: 'Return policy',              message: 'what is your return policy?',  expectedIntent: 'faq_question' },
            { label: 'Where are you located',      message: 'where are you located?',       expectedIntent: 'location_question' },
            { label: 'Business hours',             message: 'what are your working hours?',  expectedIntent: 'business_hours' },
        ],
    },
    {
        group: '8. HUMAN HANDOFF & FRUSTRATION',
        tests: [
            { label: 'Talk to human',              message: 'i want to talk to a real person', expectedIntent: 'human_handoff' },
            { label: 'Speak to manager',           message: 'let me speak to the manager',     expectedIntent: 'human_handoff' },
            { label: 'Frustration - leave alone',  message: 'forget it, leave me alone',       expectedIntent: 'frustration_stop' },
            { label: 'Arabizi - hel 3ane',         message: 'khalas hel 3ane',                 expectedIntent: 'frustration_stop' },
        ],
    },
    {
        group: '9. CORRECTIONS & OFF-TOPIC',
        tests: [
            { label: 'You misunderstood',          message: 'you misunderstood me',     expectedIntent: 'correction' },
            { label: 'Arabizi ma fhemte',          message: 'ma fhemte',                expectedIntent: 'correction' },
            { label: 'Random off-topic',           message: 'do you know what time it is?', expectedIntent: 'unknown' },
            { label: 'Compliment',                 message: 'your service is amazing',  expectedIntent: 'unknown' },
        ],
    },
    {
        group: '10. GOODBYE',
        tests: [
            { label: 'Bye',                        message: 'ok thanks bye',            expectedIntent: 'goodbye' },
            { label: 'Thank you',                  message: 'thank you so much!',        expectedIntent: 'unknown' },
        ],
    },
];

async function runBrainTest() {
    const { data: workspaces } = await supabase
        .from('ai_settings')
        .select('id, user_id, business_name, business_type')
        .limit(3);

    if (!workspaces?.length) { console.log('No workspaces found'); return; }

    const ws = workspaces[0];
    console.log(`\nTesting workspace: "${ws.business_name || 'unnamed'}" (${ws.business_type})`);
    console.log('='.repeat(70) + '\n');

    const { generateGhostReply } = await import('../utils/ghost-brain');
    const TEST_CHAT_ID = `test_full_${Date.now()}`;

    let passed = 0; let total = 0;
    const lines: string[] = [`Testing: "${ws.business_name || 'unnamed'}" (${ws.business_type})\n`];

    for (const group of TEST_GROUPS) {
        lines.push(`\n--- ${group.group} ---`);

        for (const tc of group.tests) {
            total++;
            try {
                const result = await generateGhostReply(
                    ws.user_id, tc.message, supabase, TEST_CHAT_ID, ws.id, 'whatsapp'
                );
                const reply = result?.replyText || '(no reply)';
                const action = result?.actions?.join(', ') || 'llm_path';
                const replyShort = reply.length > 90 ? reply.slice(0, 87) + '...' : reply;
                
                const ok = !!result?.replyText;
                if (ok) passed++;

                const status = ok ? 'PASS' : 'FAIL';
                lines.push(`[${status}] ${tc.label}`);
                lines.push(`  USER: "${tc.message}"`);
                lines.push(`  BOT:  "${replyShort}"`);
                lines.push(`  ACT:  [${action}]`);
            } catch (err: any) {
                lines.push(`[ERROR] ${tc.label}: ${err.message}`);
            }

            await new Promise(r => setTimeout(r, 600));
        }
    }

    lines.push(`\n${'='.repeat(60)}`);
    lines.push(`RESULTS: ${passed}/${total} tests got a reply`);
    lines.push('='.repeat(60));

    const outPath = path.resolve(process.cwd(), 'src/scripts/test-results.txt');
    fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
    console.log(`\nResults written to: ${outPath}`);
    console.log(`RESULTS: ${passed}/${total} tests got a reply`);

    // Cleanup
    await supabase.from('conversation_states').delete().eq('chat_id', TEST_CHAT_ID);
}

runBrainTest().catch(console.error);
