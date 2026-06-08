import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { runV3Agent } from '../src/lib/ai/agent';
import { loadWorkspaceConfig } from '../src/lib/ai/config';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanSession(chatId: string) {
    await supabase.from('conversation_states').delete().like('chat_id', 'sim_test_%');
    await supabase.from('appointments').delete().like('chat_id', 'sim_test_%');
    await supabase.from('orders').delete().like('chat_id', 'sim_test_%');
    await supabase.from('customers').delete().like('chat_id', 'sim_test_%');
}

async function runSimulation() {
    console.log('================================================================');
    console.log('STARTING REAL CONVERSATION SIMULATION');
    console.log('================================================================\n');

    const chatId = `sim_test_${Date.now()}`;

    // =================================================================
    // 1. APPOINTMENTS WORKSPACE SIMULATION
    // =================================================================
    const apptWorkspaceId = 'c3c68bc7-6029-4557-a364-4d2132826d7e';
    const apptUserId = 'f5917ff4-dbcc-4d15-8524-6b383bdaa09a';
    
    console.log('--- 1. APPOINTMENTS WORKSPACE (Ali Salon) ---');
    console.log(`Clearing session for chatId: ${chatId}`);
    await cleanSession(chatId);

    const apptConfig = await loadWorkspaceConfig(supabase, apptWorkspaceId, apptUserId);
    if (!apptConfig) {
        console.error('Failed to load workspace config for appointments');
        return;
    }

    // Determine a date for tomorrow (Tuesday) to avoid weekends
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // If tomorrow is Sunday, advance to Monday
    if (tomorrow.getDay() === 0) {
        tomorrow.setDate(tomorrow.getDate() + 1);
    }
    const dateStr = tomorrow.toISOString().split('T')[0];
    const weekdayName = tomorrow.toLocaleDateString('en-US', { weekday: 'long' });

    const apptConvo = [
        `Hala! I want to book my nails for ${weekdayName} at 10:00 AM`,
        "Sure, my name is Ali Kassem and phone is 78820707",
        "Yes, go ahead and book it"
    ];

    for (const msg of apptConvo) {
        console.log(`\nUser: "${msg}"`);
        const result = await runV3Agent({
            workspaceId: apptWorkspaceId,
            workspaceType: 'appointments',
            chatId,
            message: msg,
            platform: 'whatsapp',
            supabase,
            userId: apptUserId
        }, apptConfig);

        console.log(`Bot: "${result.replyText}"`);
        console.log(`FSM Stage: ${result.stateBefore} -> ${result.stateAfter}`);
        console.log(`DB Write Attempted: ${result.debug.dbWriteAttempted} | Success: ${result.debug.dbWriteSuccess}`);
    }

    // Verify appointment was written to DB
    console.log('\nVerifying appointment database record...');
    const { data: appts, error: apptErr } = await supabase
        .from('appointments')
        .select('*')
        .eq('workspace_id', apptWorkspaceId)
        .eq('chat_id', chatId);

    if (apptErr) {
        console.error('Error fetching appointments:', apptErr.message);
    } else if (appts && appts.length > 0) {
        console.log('🎉 SUCCESS! Appointment found in database:');
        console.log(JSON.stringify(appts[0], null, 2));
    } else {
        console.log('❌ FAILURE: No appointment found in the database for this session.');
    }


    // =================================================================
    // 2. E-COMMERCE WORKSPACE SIMULATION
    // =================================================================
    const ecomWorkspaceId = 'abd945bc-9d86-494b-be0e-ff9e69a3f627';
    const ecomUserId = 'a91ad903-67af-4977-951b-ab7735b34625';

    console.log('\n\n--- 2. E-COMMERCE WORKSPACE (Ali Shop) ---');
    console.log(`Clearing session for chatId: ${chatId}`);
    await cleanSession(chatId);

    const ecomConfig = await loadWorkspaceConfig(supabase, ecomWorkspaceId, ecomUserId);
    if (!ecomConfig) {
        console.error('Failed to load workspace config for ecommerce');
        return;
    }

    const ecomConvo = [
        "Hi, bade w7di ps5",
        "My details are Ali Kassem, 78820707, Beirut Hamra Street",
        "Yes"
    ];

    for (const msg of ecomConvo) {
        console.log(`\nUser: "${msg}"`);
        const result = await runV3Agent({
            workspaceId: ecomWorkspaceId,
            workspaceType: 'ecommerce',
            chatId,
            message: msg,
            platform: 'whatsapp',
            supabase,
            userId: ecomUserId
        }, ecomConfig);

        console.log(`Bot: "${result.replyText}"`);
        console.log(`FSM Stage: ${result.stateBefore} -> ${result.stateAfter}`);
        console.log(`DB Write Attempted: ${result.debug.dbWriteAttempted} | Success: ${result.debug.dbWriteSuccess}`);
    }

    // Verify order was written to DB
    console.log('\nVerifying order database record...');
    const { data: orders, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('workspace_id', ecomWorkspaceId)
        .eq('chat_id', chatId);

    if (orderErr) {
        console.error('Error fetching orders:', orderErr.message);
    } else if (orders && orders.length > 0) {
        console.log('🎉 SUCCESS! Order found in database:');
        console.log(JSON.stringify(orders[0], null, 2));
    } else {
        console.log('❌ FAILURE: No order found in the database for this session.');
    }

    console.log('\n================================================================');
    console.log('SIMULATION COMPLETED');
    console.log('================================================================');
}

runSimulation().catch(console.error);
