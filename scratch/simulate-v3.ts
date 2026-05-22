import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { runV3Agent } from '../src/lib/ai/agent';
import { loadWorkspaceConfig } from '../src/lib/ai/config';
import { verifyAgentReply } from '../src/lib/ai/guardrails/reply-verifier';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const WORKSPACE_ID = '4a4a768c-9f8d-4b49-b625-5e6292bb7a7a'; // Ali Salon
const USER_ID = '5e10d723-17ec-42d9-83fa-5fe5520d4b70'; // Owner ID
const CHAT_ID = 'test_simulation_12345';

async function testMsg(message: string) {
    console.log(`\n===================================`);
    console.log(`CUSTOMER: "${message}"`);
    
    const config = await loadWorkspaceConfig(supabase, WORKSPACE_ID, USER_ID);
    if (!config) {
        console.error('Failed to load workspace config');
        return;
    }
    
    const result = await runV3Agent({
        workspaceId: WORKSPACE_ID,
        workspaceType: 'appointments',
        chatId: CHAT_ID,
        message,
        platform: 'instagram',
        supabase,
        userId: USER_ID,
    }, config);
    
    console.log(`AGENT REPLY: "${result.replyText}"`);
    console.log(`ACTIONS: ${JSON.stringify(result.actions)}`);
    console.log(`DEBUG: ${JSON.stringify(result.debug)}`);
}

async function testVerifierDirectly() {
    console.log(`\n===================================`);
    console.log(`TESTING REPLY VERIFIER DIRECTLY`);
    console.log(`===================================`);
    
    const services = [
        { name: 'Haircut', price: 15, durationMinutes: 30 },
        { name: 'Shave', price: 10, durationMinutes: 20 }
    ];

    // Case 1: Booking claim without tool success
    const res1 = verifyAgentReply(
        "Awesome! Your haircut is booked and confirmed for tomorrow at 3pm. See you at the salon!",
        ["tool_check_slot"], // no book_appointment_success
        services
    );
    console.log("Test 1 (Booking Claim without success):");
    console.log(`- Original: "Awesome! Your haircut is booked..."`);
    console.log(`- Verified: ${res1.verified}`);
    console.log(`- Corrected: "${res1.correctedReply}"`);
    console.log(`- Violations: ${JSON.stringify(res1.violations)}`);

    // Case 2: Price mismatch
    const res2 = verifyAgentReply(
        "A haircut costs $25 and takes 30 minutes.",
        ["tool_get_services"],
        services
    );
    console.log("\nTest 2 (Price mismatch):");
    console.log(`- Original: "A haircut costs $25..."`);
    console.log(`- Verified: ${res2.verified}`);
    console.log(`- Corrected: "${res2.correctedReply}"`);
    console.log(`- Violations: ${JSON.stringify(res2.violations)}`);

    // Case 3: Availability claim without slot check
    const res3 = verifyAgentReply(
        "Sorry, we are fully booked today at 3pm.",
        ["tool_get_services"], // no slot check
        services
    );
    console.log("\nTest 3 (Availability claim without check):");
    console.log(`- Original: "Sorry, we are fully booked..."`);
    console.log(`- Verified: ${res3.verified}`);
    console.log(`- Corrected: "${res3.correctedReply}"`);
    console.log(`- Violations: ${JSON.stringify(res3.violations)}`);
}

async function main() {
    // Delete conversation states and logs for clean test
    await supabase.from('conversation_states').delete().eq('chat_id', CHAT_ID);
    
    await testMsg("Hey");
    await testMsg("How much is a haircut and how long does it take?");
    await testMsg("Okay I want to book");
    await testMsg("Today 3pm?");

    await testVerifierDirectly();
}

main().catch(console.error);

