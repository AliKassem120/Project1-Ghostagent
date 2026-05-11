/**
 * GhostAgent Brain — Appointments Full Coverage Test
 * Run: npx tsx src/scripts/test-appointments.ts
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
}

const TEST_GROUPS: { group: string; tests: TestCase[] }[] = [
    {
        group: '1. GREETINGS & SMALL TALK',
        tests: [
            { label: 'English greeting',          message: 'hey' },
            { label: 'Arabic greeting',            message: 'salam' },
            { label: 'Arabizi greeting',           message: 'hala kifak' },
            { label: 'Small talk - how are you',   message: 'how are you' },
            { label: 'Small talk - wsh',           message: 'wsh' },
            { label: 'Small talk - kif el 7al',    message: 'kif el 7al' },
        ],
    },
    {
        group: '2. SERVICE INQUIRY',
        tests: [
            { label: 'What services do you offer', message: 'what services do you offer?' },
            { label: 'What do you do',             message: 'what do you do?' },
            { label: 'Arabizi - shu khedameto',    message: 'shu khedameto?' },
            { label: 'Do you do haircuts',         message: 'do you do haircuts?' },
            { label: 'Do you do lashes',           message: 'do you do eyelash extensions?' },
        ],
    },
    {
        group: '3. BOOKING INTENT',
        tests: [
            { label: 'I want to book',             message: 'i want to book an appointment' },
            { label: 'I want a haircut',           message: 'i want a haircut' },
            { label: 'Arabizi bade e7joz',         message: 'bade e7joz maw3ed' },
            { label: 'Book for tomorrow',          message: 'can I book for tomorrow?' },
            { label: 'Arabizi bade ji',            message: 'bade ji 3andkon' },
        ],
    },
    {
        group: '4. PRICE QUESTIONS',
        tests: [
            { label: 'How much for a haircut',     message: 'how much is a haircut?' },
            { label: 'Price of facial',            message: 'what is the price of a facial?' },
            { label: 'Arabizi addesh',             message: 'addesh el maw3ed?' },
        ],
    },
    {
        group: '5. APPOINTMENT STATUS',
        tests: [
            { label: 'When is my appointment',     message: 'when is my appointment?' },
            { label: 'Do I have a booking',        message: 'do I have a booking?' },
            { label: 'Arabizi wein maw3ede',       message: 'wein maw3ede?' },
        ],
    },
    {
        group: '6. CANCEL APPOINTMENT',
        tests: [
            { label: 'Cancel my appointment',      message: 'cancel my appointment' },
            { label: "I can't come",               message: "I can't come tomorrow" },
            { label: 'Arabizi el8e maw3ed',        message: 'bde el8e l maw3ed' },
            { label: 'Arabizi ma fiyye eje',       message: 'ma fiyye eje' },
        ],
    },
    {
        group: '7. RESCHEDULE APPOINTMENT',
        tests: [
            { label: 'Reschedule',                 message: 'can I reschedule my appointment?' },
            { label: 'Change to different day',    message: 'can I change to a different day?' },
            { label: 'Arabizi bade ghayyir',       message: 'bade ghayyir maw3ede la bukra' },
        ],
    },
    {
        group: '8. BUSINESS HOURS & LOCATION',
        tests: [
            { label: 'Working hours',              message: 'what are your working hours?' },
            { label: 'Are you open on Sunday',     message: 'are you open on Sunday?' },
            { label: 'Where are you located',      message: 'where are you located?' },
            { label: 'Arabizi wen mawjudin',       message: 'wen mawjudin?' },
        ],
    },
    {
        group: '9. HUMAN HANDOFF & FRUSTRATION',
        tests: [
            { label: 'Talk to human',              message: 'i want to talk to a real person' },
            { label: 'Speak to manager',           message: 'let me speak to the manager' },
            { label: 'Frustration',                message: 'forget it, leave me alone' },
            { label: 'Arabizi khalas hel 3ane',    message: 'khalas hel 3ane' },
        ],
    },
    {
        group: '10. CORRECTIONS & OFF-TOPIC',
        tests: [
            { label: 'You misunderstood',          message: 'you misunderstood me' },
            { label: 'Arabizi ma fhemte',          message: 'ma fhemte' },
            { label: 'Off-topic question',         message: 'do you sell products too?' },
            { label: 'Compliment',                 message: 'your salon is amazing!' },
            { label: 'Goodbye',                    message: 'ok thanks bye' },
        ],
    },
];

async function runAppointmentsTest() {
    // Try to find an appointments workspace first
    const { data: workspaces } = await supabase
        .from('ai_settings')
        .select('id, user_id, business_name, business_type')
        .order('created_at', { ascending: false });

    if (!workspaces?.length) { console.log('No workspaces found'); return; }

    // Prefer appointments workspace, fallback to any
    const ws = workspaces.find(w => w.business_type === 'appointments') || workspaces[0];
    
    // If no appointments workspace, temporarily patch the type for testing
    const isPatched = ws.business_type !== 'appointments';
    if (isPatched) {
        console.log(`\nNo appointments workspace found. Patching workspace "${ws.business_name}" to appointments type for this test.`);
        await supabase.from('ai_settings').update({ business_type: 'appointments' }).eq('id', ws.id);
    }

    console.log(`\nTesting: "${ws.business_name || 'unnamed'}" (appointments)`);
    console.log('='.repeat(70) + '\n');

    const { generateGhostReply } = await import('../utils/ghost-brain');
    const TEST_CHAT_ID = `test_appt_${Date.now()}`;

    let passed = 0; let total = 0;
    const lines: string[] = [`Testing: "${ws.business_name || 'unnamed'}" (appointments)\n`];

    for (const group of TEST_GROUPS) {
        lines.push(`\n--- ${group.group} ---`);
        console.log(`\n--- ${group.group} ---`);

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
                const line1 = `[${status}] ${tc.label}`;
                const line2 = `  USER: "${tc.message}"`;
                const line3 = `  BOT:  "${replyShort}"`;
                const line4 = `  ACT:  [${action}]`;

                lines.push(line1, line2, line3, line4);
                console.log(`${status === 'PASS' ? 'OK' : 'XX'} ${tc.label}`);
                console.log(`   -> "${replyShort}"`);
                console.log(`   [${action}]`);
            } catch (err: any) {
                lines.push(`[ERROR] ${tc.label}: ${err.message}`);
                console.log(`ERROR ${tc.label}: ${err.message}`);
            }

            await new Promise(r => setTimeout(r, 700));
        }
    }

    lines.push(`\n${'='.repeat(60)}`);
    lines.push(`RESULTS: ${passed}/${total} tests got a reply`);
    lines.push('='.repeat(60));

    const outPath = path.resolve(process.cwd(), 'src/scripts/test-appointments-results.txt');
    fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');

    // Restore workspace type if patched
    if (isPatched) {
        await supabase.from('ai_settings').update({ business_type: ws.business_type }).eq('id', ws.id);
        console.log('\nRestored original workspace type.');
    }

    // Cleanup test state
    await supabase.from('conversation_states').delete().eq('chat_id', TEST_CHAT_ID);

    console.log(`\nRESULTS: ${passed}/${total} tests got a reply`);
    console.log(`Results written to: ${outPath}`);
}

runAppointmentsTest().catch(console.error);
