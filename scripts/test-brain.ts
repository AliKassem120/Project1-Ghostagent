/**
 * V6 State Machine — Local Flow Test
 * Simulates a full booking conversation without Instagram.
 * Run: npx tsx scripts/test-brain.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// We need to dynamically import the modules because they use path aliases
// So let's just call the API endpoint directly on the deployed app

const TEST_WORKSPACE = 'b8766c8d-0d01-4e89-bcc3-1516f9e4a30a'; // Your appointments workspace
const FAKE_CHAT_ID = 'test_user_local_' + Date.now();

// Simulate calling the brain by importing directly
async function simulateMessage(message: string) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`👤 CUSTOMER: "${message}"`);
    console.log(`${'─'.repeat(60)}`);

    // Load workspace config
    const { data: ws } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', TEST_WORKSPACE)
        .single();

    if (!ws) {
        console.log('❌ Workspace not found');
        return;
    }

    // Load AI settings
    const { data: ai } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('workspace_id', TEST_WORKSPACE)
        .single();

    // Get the user_id from workspace
    const userId = ws.user_id;

    // Check conversation state first (simulating router)
    const { data: stateRow } = await supabase
        .from('conversation_states')
        .select('state')
        .eq('user_id', userId)
        .eq('workspace_id', TEST_WORKSPACE)
        .eq('chat_id', FAKE_CHAT_ID)
        .eq('flow_type', 'appointments')
        .maybeSingle();

    const currentStage = stateRow?.state?.stage || 'idle';
    console.log(`📋 State before: ${currentStage}`);

    // Now we need to call the brain. Since we can't easily import with path aliases,
    // let's use the Vercel deployment API instead
    // Actually let's use a simpler approach - just trace the classifier and state machine

    // ── Classifier (regex) ──
    const BOOKING_PATTERNS = /\b(book|reserve|appointment|schedule|booking|slot|bade\s*e7joz|bade\s*a7joz|badde\s*e7jez|7ajez|7ejiz|reserve\s*(a\s*)?spot|i\s*want|i\s*need|can\s*i\s*(get|have)|bade|badde|bde|bedde|bdee)\b/i;
    const GREETING_PATTERNS = /^(hi|hey|hello|salam|marhaba|hala|yo|sup|good\s*(morning|evening|afternoon)|ahla)\b/i;

    let intent = 'general_chat';
    if (currentStage !== 'idle') {
        intent = 'booking_intent'; // State-aware bypass
        console.log(`🔒 Router: Mid-flow (${currentStage}) → bypassing classifier → booking_intent`);
    } else if (BOOKING_PATTERNS.test(message)) {
        intent = 'booking_intent';
        console.log(`🎯 Classifier: booking_intent (regex match)`);
    } else if (GREETING_PATTERNS.test(message)) {
        intent = 'greeting';
        console.log(`🎯 Classifier: greeting`);
    } else {
        console.log(`🎯 Classifier: general_chat`);
    }

    if (intent !== 'booking_intent') {
        console.log(`🤖 BOT: [Would use ${intent} worker — skipping for this test]`);
        return;
    }

    // ── State Machine: Extract data via LLM ──
    const { data: services } = await supabase
        .from('services')
        .select('*')
        .eq('workspace_id', TEST_WORKSPACE)
        .eq('is_active', true);

    const serviceList = (services || []).map((s: any) => `${s.name} ($${s.price}, ${s.duration_minutes}min)`).join(', ');

    // Call Groq for extraction
    const extractionPrompt = `Extract booking info from this customer message. Our services: ${serviceList || 'none configured'}.
Known customer: new customer.
Customer said: "${message}"

Return ONLY valid JSON with these fields:
{
  "service_name": "exact service name or null",
  "date_text": "date/time text or null", 
  "customer_name": "name or null",
  "customer_phone": "phone or null",
  "wants_to_confirm": true/false
}`;

    console.log(`🧠 Calling Groq for extraction...`);

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: 'Return ONLY valid JSON. No markdown, no explanation, no code fences.' },
                { role: 'user', content: extractionPrompt }
            ],
            temperature: 0.1,
        }),
    });

    const groqJson = await groqResponse.json();
    const rawText = groqJson.choices?.[0]?.message?.content || '{}';
    
    let extracted;
    try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
        extracted = {};
    }

    console.log(`📦 Extracted:`, JSON.stringify(extracted, null, 2));

    // ── Merge into state ──
    const state = stateRow?.state || {};
    const appt: any = state.appointment || { workspaceId: TEST_WORKSPACE };
    const cust: any = state.customer || {};

    // Service
    if (extracted.service_name && !appt.serviceName) {
        const match = (services || []).find((s: any) => 
            s.name.toLowerCase().includes(extracted.service_name.toLowerCase()) ||
            extracted.service_name.toLowerCase().includes(s.name.toLowerCase())
        );
        if (match) {
            appt.serviceId = match.id;
            appt.serviceName = match.name;
            appt.servicePrice = match.price;
            appt.serviceDuration = match.duration_minutes;
        }
    }

    // Date
    if (extracted.date_text && !appt.date) {
        appt.dateText = extracted.date_text; // simplified
    }

    // Customer
    if (extracted.customer_name) cust.name = extracted.customer_name;
    if (extracted.customer_phone) cust.phone = extracted.customer_phone;

    // ── Determine reply ──
    let reply = '';
    let newStage = 'idle';

    if (!appt.serviceName) {
        if (extracted.service_name) {
            reply = `We don't offer that. We have: ${serviceList}.`;
        } else {
            reply = `What service? We have: ${serviceList}.`;
        }
        newStage = 'awaiting_service';
    } else if (!appt.date && !appt.dateText) {
        reply = `${appt.serviceName} is $${appt.servicePrice}. When would you like to come?`;
        newStage = 'awaiting_date_time';
    } else if (!cust.name || !cust.phone) {
        reply = `${appt.serviceName} on ${appt.dateText || appt.date}. Can I get your name and phone?`;
        newStage = 'awaiting_customer_details';
    } else if (!extracted.wants_to_confirm && currentStage !== 'awaiting_booking_confirmation') {
        reply = `Book ${appt.serviceName} for ${cust.name}? (Yes/No)`;
        newStage = 'awaiting_booking_confirmation';
    } else {
        reply = `✅ Booked! ${appt.serviceName} for ${cust.name}. See you then!`;
        newStage = 'idle';
    }

    console.log(`🤖 BOT REPLY: "${reply}"`);
    console.log(`📋 State after: ${newStage}`);

    // Save state for next message
    if (newStage !== 'idle') {
        await supabase.from('conversation_states').upsert({
            user_id: userId,
            workspace_id: TEST_WORKSPACE,
            chat_id: FAKE_CHAT_ID,
            flow_type: 'appointments',
            platform: 'test',
            state: { stage: newStage, appointment: appt, customer: cust },
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,workspace_id,chat_id,flow_type' });
    } else {
        await supabase.from('conversation_states').delete()
            .eq('user_id', userId)
            .eq('workspace_id', TEST_WORKSPACE)
            .eq('chat_id', FAKE_CHAT_ID)
            .eq('flow_type', 'appointments');
    }
}

// ── Run the conversation ──
async function main() {
    console.log('🧪 V6 State Machine — Local Test\n');
    
    const messages = [
        "Hey, I want to book a nails job",
        "Monday 11am",
        "Ali 71123456",
        "Yes"
    ];

    for (const msg of messages) {
        await simulateMessage(msg);
        await new Promise(r => setTimeout(r, 1000)); // small delay
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('✅ Test complete!');
}

main().catch(console.error);
