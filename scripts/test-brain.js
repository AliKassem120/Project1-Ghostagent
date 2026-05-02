/**
 * V6 State Machine — Local Flow Test (Plain JS)
 * Run: node -r dotenv/config scripts/test-brain.js dotenv_config_path=.env.local
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const TEST_WORKSPACE = 'b8766c8d-0d01-4e89-bcc3-1516f9e4a30a';
const FAKE_CHAT_ID = 'test_local_' + Date.now();

const BOOKING_PATTERNS = /\b(book|reserve|appointment|schedule|booking|slot|bade\s*e7joz|bade\s*a7joz|badde\s*e7jez|7ajez|7ejiz|reserve\s*(a\s*)?spot|i\s*want|i\s*need|can\s*i\s*(get|have)|bade|badde|bde|bedde|bdee)\b/i;

let userId = null;
let savedState = { stage: 'idle', appointment: {}, customer: {} };

async function callGroq(prompt) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: 'Return ONLY valid JSON. No markdown, no explanation, no code fences.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
        }),
    });
    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content || '{}';
    try {
        const m = raw.match(/\{[\s\S]*\}/);
        return m ? JSON.parse(m[0]) : {};
    } catch { return {}; }
}

async function simulateMessage(message, services, serviceList) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  CUSTOMER: "${message}"`);
    console.log(`${'─'.repeat(60)}`);

    const currentStage = savedState.stage;
    console.log(`  State before: ${currentStage}`);

    // Router
    let intent = 'general_chat';
    if (currentStage !== 'idle') {
        intent = 'booking_intent';
        console.log(`  Router: Mid-flow (${currentStage}) -> bypass classifier -> booking_intent`);
    } else if (BOOKING_PATTERNS.test(message)) {
        intent = 'booking_intent';
        console.log(`  Classifier: booking_intent (regex match)`);
    } else {
        console.log(`  Classifier: ${intent} (no match — would go to general chat)`);
        return;
    }

    // Extract
    console.log(`  Calling Groq for extraction...`);
    const extracted = await callGroq(
        `Extract booking info from this customer message. Our services: ${serviceList}.
Known customer: new customer.
Customer said: "${message}"

Return JSON: {"service_name": "name or null", "date_text": "date/time or null", "customer_name": "name or null", "customer_phone": "phone or null", "wants_to_confirm": true/false}`
    );
    console.log(`  Extracted:`, JSON.stringify(extracted));

    // Merge
    const appt = savedState.appointment || {};
    const cust = savedState.customer || {};

    if (extracted.service_name && !appt.serviceName) {
        const match = services.find(s =>
            s.name.toLowerCase().includes((extracted.service_name || '').toLowerCase()) ||
            (extracted.service_name || '').toLowerCase().includes(s.name.toLowerCase())
        );
        if (match) {
            appt.serviceName = match.name;
            appt.servicePrice = match.price;
            appt.serviceDuration = match.duration_minutes;
            console.log(`  Matched service: ${match.name}`);
        }
    }

    if (extracted.date_text && !appt.dateText) {
        appt.dateText = extracted.date_text;
    }
    if (extracted.customer_name) cust.name = extracted.customer_name;
    if (extracted.customer_phone) cust.phone = extracted.customer_phone;

    // Determine reply
    let reply = '';
    let newStage = 'idle';

    if (!appt.serviceName) {
        reply = extracted.service_name
            ? `We don't offer that. We have: ${serviceList}.`
            : `What service? We have: ${serviceList}.`;
        newStage = 'awaiting_service';
    } else if (!appt.dateText) {
        reply = `${appt.serviceName} is $${appt.servicePrice}. When would you like to come?`;
        newStage = 'awaiting_date_time';
    } else if (!cust.name || !cust.phone) {
        reply = `${appt.serviceName} on ${appt.dateText}. Can I get your name and phone?`;
        newStage = 'awaiting_customer_details';
    } else if (!extracted.wants_to_confirm && currentStage !== 'awaiting_booking_confirmation') {
        reply = `Book ${appt.serviceName} on ${appt.dateText} for ${cust.name}? (Yes/No)`;
        newStage = 'awaiting_booking_confirmation';
    } else {
        reply = `Booked! ${appt.serviceName} on ${appt.dateText} for ${cust.name}. See you then!`;
        newStage = 'idle';
    }

    console.log(`\n  BOT REPLY: "${reply}"`);
    console.log(`  State after: ${newStage}`);

    savedState = { stage: newStage, appointment: appt, customer: cust };
}

async function main() {
    console.log('V6 State Machine — Local Test\n');

    // Load services
    const { data: ws } = await supabase.from('workspaces').select('user_id').eq('id', TEST_WORKSPACE).single();
    userId = ws?.user_id;
    const { data: services } = await supabase.from('services').select('*').eq('workspace_id', TEST_WORKSPACE).eq('is_active', true);
    const serviceList = (services || []).map(s => `${s.name} ($${s.price}, ${s.duration_minutes}min)`).join(', ');
    console.log(`Services: ${serviceList || 'NONE'}`);
    console.log(`User ID: ${userId}`);

    const messages = [
        "Hey, I want to book a nails job",
        "Monday 11am",
        "Ali 71123456",
        "Yes"
    ];

    for (const msg of messages) {
        await simulateMessage(msg, services || [], serviceList);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('Test complete!');
}

main().catch(console.error);
