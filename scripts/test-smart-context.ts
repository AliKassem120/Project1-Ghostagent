
import { createClient } from '@supabase/supabase-js';
import { handleAutomationMessage } from '../src/lib/automation-v2';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testSmartContext() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const workspaceId = '6b890517-958b-464c-b808-49830e13823a';
    const userId = 'e05a5ce0-115a-4ddc-95b2-3604abb9195c';
    const chatId = 'test-smart-context-123';

    console.log('🚀 [TEST] Setting up recent appointment context...');

    // 0. Clear state
    await supabase.from('conversation_states').delete().eq('chat_id', chatId);

    // 1. Create a "just finished" appointment
    const { error: insertErr } = await supabase
        .from('appointments')
        .insert({
            user_id: userId,
            workspace_id: workspaceId,
            instagram_user_id: chatId,
            customer_name: 'Ali Test',
            customer_phone: '70123456',
            service: 'haircut',
            appointment_date: '2026-04-30',
            start_time: '12:00:00',
            end_time: '12:30:00',
            duration_minutes: 30,
            status: 'confirmed',
            created_at: new Date().toISOString()
        });

    if (insertErr) {
        console.error('❌ Failed to insert test appointment:', insertErr);
        return;
    }

    console.log('✅ Recent appointment created (12:00 PM - 12:30 PM)');

    // 2. Send "after mine" message
    console.log('\n💬 Sending: "My friend also want a haircut, can he have it directly after i finish?"');
    
    const result = await handleAutomationMessage({
        workspaceId,
        workspaceType: 'appointments',
        chatId,
        message: 'My friend also want a haircut, can he have it directly after i finish?',
        platform: 'instagram',
        supabase,
        userId,
    });

    console.log('\n--- 🧠 ENGINE RESULT ---');
    console.log('Reply:', result.replyText);
    console.log('State After:', result.stateAfter);
    console.log('Actions:', result.actions);
    
    if (result.replyText?.includes('12:30 PM')) {
        console.log('\n✅ SUCCESS: Engine correctly identified the 12:30 PM slot from context!');
    } else {
        console.log('\n❌ FAILURE: Engine did not use the recent context.');
    }

    // Cleanup
    await supabase.from('appointments').delete().eq('instagram_user_id', chatId);
}

testSmartContext().catch(console.error);
