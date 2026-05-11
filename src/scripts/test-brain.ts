// Test the GhostAgent brain with a full simulated conversation
// Run with: npx tsx src/scripts/test-brain.ts

import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && !key.startsWith('#')) {
        process.env[key.trim()] = vals.join('=').trim();
    }
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runBrainTest() {
    const { data: workspaces } = await supabase
        .from('ai_settings')
        .select('id, user_id, business_name, business_type')
        .limit(3);

    if (!workspaces || workspaces.length === 0) {
        console.log('No workspaces found');
        return;
    }

    const ws = workspaces[0];
    console.log(`Testing: "${ws.business_name}" (${ws.business_type})\n${'='.repeat(60)}`);

    const { generateGhostReply } = await import('../utils/ghost-brain');
    const TEST_CHAT_ID = 'test_brain_session_002';

    const conversation = [
        'hey',
        'how are you',
        'what do you sell',
        'do you have hoodies',
        'how much is it',
        'i wanna buy one',
        'what is your return policy',
        'ok thanks bye',
    ];

    const results: { msg: string, reply: string | null, action: string }[] = [];

    for (const msg of conversation) {
        try {
            const result = await generateGhostReply(
                ws.user_id, msg, supabase, TEST_CHAT_ID, ws.id, 'whatsapp'
            );
            results.push({
                msg,
                reply: result?.replyText || null,
                action: result?.actions?.join(', ') || 'llm_path'
            });
        } catch (err: any) {
            results.push({ msg, reply: `ERROR: ${err.message}`, action: 'error' });
        }
        await new Promise(r => setTimeout(r, 800));
    }

    // Print clean summary
    console.log('\n--- CONVERSATION RESULTS ---\n');
    for (const r of results) {
        console.log(`USER: ${r.msg}`);
        console.log(`BOT:  ${r.reply}`);
        console.log(`      [${r.action}]\n`);
    }

    // Cleanup
    await supabase.from('conversation_states').delete().eq('chat_id', TEST_CHAT_ID);
}

runBrainTest().catch(console.error);
