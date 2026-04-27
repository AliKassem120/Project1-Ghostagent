/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Test Harness
 * ═══════════════════════════════════════════════════════════════
 * CLI script to simulate conversations with the V2 engine.
 * Does not send real Instagram messages.
 *
 * Usage: npx tsx scripts/test-automation-v2.ts <workspaceId> <userId> "<message>"
 */

import { createClient } from '@supabase/supabase-js';
import { handleAutomationMessage } from '../src/lib/automation-v2';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runTest() {
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.log('Usage: npx tsx scripts/test-automation-v2.ts <workspaceId> <userId> "<message>" [chatId]');
        process.exit(1);
    }

    const [workspaceId, userId, message, chatId = 'test-chat-123'] = args;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch workspace type
    const { data: ws } = await supabase
        .from('ai_settings')
        .select('business_type')
        .eq('id', workspaceId)
        .single();

    if (!ws) {
        console.error(`Error: Workspace ${workspaceId} not found`);
        process.exit(1);
    }

    console.log('\n--- 🤖 GHOST V2 TEST HARNESS ---');
    console.log(`Input: "${message}"`);
    console.log(`Workspace: ${workspaceId} (${ws.business_type})`);
    console.log(`Chat ID: ${chatId}`);
    console.log('-------------------------------\n');

    const result = await handleAutomationMessage({
        workspaceId,
        workspaceType: ws.business_type,
        chatId,
        message,
        platform: 'instagram',
        supabase,
        userId,
        customer: { name: 'Test User', username: 'testuser' }
    });

    console.log('\n--- 🧠 ENGINE RESULT ---');
    console.log(`Should Reply: ${result.shouldReply}`);
    if (result.replyText) {
        console.log(`Reply: "${result.replyText}"`);
    }
    console.log(`Actions: ${result.actions.join(', ') || 'none'}`);
    console.log(`State: ${result.stateBefore} -> ${result.stateAfter}`);
    console.log(`Intent: ${result.debug.intent || 'n/a'}`);
    console.log(`Language: ${result.debug.language}`);
    console.log(`DB Write: ${result.debug.dbWriteAttempted ? (result.debug.dbWriteSuccess ? 'SUCCESS ✅' : 'FAILED ❌') : 'n/a'}`);
    console.log(`Duration: ${result.debug.durationMs}ms`);
    if (result.error) console.log(`Error: ${result.error}`);
    console.log('------------------------\n');
}

runTest().catch(console.error);
