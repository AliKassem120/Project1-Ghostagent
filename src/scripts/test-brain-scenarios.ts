/**
 * GhostAgent Brain — Multi-Turn Scenario Backtesting Suite
 * Tests actual conversational flows (bookings, cancellations, e-commerce checkouts,
 * session timeouts, and human handoffs) against the live LLM agent.
 * 
 * Run: npx tsx src/scripts/test-brain-scenarios.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
    console.error('❌ Missing .env.local file');
    process.exit(1);
}
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && !key.startsWith('#')) process.env[key.trim()] = vals.join('=').trim();
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Turn {
    userMessage: string;
    expectedStateAfter?: string;
    simulateDelayMinutes?: number; // to test session/state timeout resets
    assert?: (result: any, turnIndex: number) => void;
}

interface Scenario {
    name: string;
    type: 'appointments' | 'ecommerce';
    turns: Turn[];
    setup?: (ws: any, chat_id: string) => Promise<any>;
    teardown?: (ws: any, chat_id: string, setupData: any) => Promise<void>;
}

const SCENARIOS: Scenario[] = [
    {
        name: 'Scenario 1: Happy Path Appointment Booking',
        type: 'appointments',
        setup: async (ws) => {
            // Ensure mock Haircut service exists
            const { data } = await supabase
                .from('services')
                .select('id')
                .eq('workspace_id', ws.id)
                .eq('name', 'Haircut')
                .maybeSingle();

            if (!data) {
                await supabase.from('services').insert({
                    user_id: ws.user_id,
                    workspace_id: ws.id,
                    name: 'Haircut',
                    price: 15,
                    duration_minutes: 30
                });
            }
            return null;
        },
        turns: [
            {
                userMessage: 'hi kifak, do you offer haircuts?',
                expectedStateAfter: 'awaiting_service', // transitions to service stage
                assert: (res) => {
                    if (!res.replyText.toLowerCase().includes('haircut') && !res.replyText.toLowerCase().includes('service')) {
                        throw new Error('Bot reply did not mention haircut services');
                    }
                }
            },
            {
                userMessage: 'great, I want to book a haircut appointment please',
                expectedStateAfter: 'awaiting_date_time',
            },
            {
                userMessage: 'Monday at 11 am works best',
                expectedStateAfter: 'awaiting_customer_details', // or awaiting_booking_confirmation
            },
            {
                userMessage: 'My name is Ali, phone is 71262815',
                expectedStateAfter: 'awaiting_booking_confirmation',
            },
            {
                userMessage: 'yes please confirm it',
                expectedStateAfter: 'idle',
                assert: (res) => {
                    if (!res.actions.includes('tool_book_appointment')) {
                        throw new Error('Bot failed to execute book_appointment tool');
                    }
                }
            }
        ],
        teardown: async (ws, chat_id) => {
            // Delete created test appointments
            await supabase.from('appointments').delete().eq('chat_id', chat_id);
        }
    },
    {
        name: 'Scenario 2: Cancellation & State Reschedule Escape',
        type: 'appointments',
        setup: async (ws, chat_id) => {
            // Insert mock upcoming confirmed appointment to cancel
            const { data } = await supabase.from('appointments').insert({
                user_id: ws.user_id,
                workspace_id: ws.id,
                platform: 'whatsapp',
                chat_id: chat_id,
                instagram_user_id: chat_id,
                instagram_handle: 'Customer',
                customer_name: 'Ali',
                customer_phone: '71262815',
                service: 'Haircut',
                appointment_date: '2026-05-25', // Monday
                start_time: '11:00',
                end_time: '11:30',
                duration_minutes: 30,
                status: 'confirmed'
            }).select('id').single();
            return data?.id;
        },
        turns: [
            {
                userMessage: 'Hi, I need to cancel my haircut appointment for Monday',
                expectedStateAfter: 'post_appointment_modify', // Cancellation routes to modify
                assert: (res) => {
                    if (!res.actions.includes('tool_cancel_appointment')) {
                        throw new Error('Bot did not trigger cancel_appointment tool');
                    }
                    if (!res.replyText.toLowerCase().includes('cancel')) {
                        throw new Error('Bot did not confirm cancellation to user');
                    }
                }
            }
        ],
        teardown: async (ws, chat_id, setupData) => {
            if (setupData) {
                await supabase.from('appointments').delete().eq('id', setupData);
            }
        }
    },
    {
        name: 'Scenario 3: Session Inactivity Reset to Idle (No Silent Crash)',
        type: 'appointments',
        setup: async (ws) => {
            // Ensure mock Haircut service exists
            const { data } = await supabase
                .from('services')
                .select('id')
                .eq('workspace_id', ws.id)
                .eq('name', 'Haircut')
                .maybeSingle();

            if (!data) {
                await supabase.from('services').insert({
                    user_id: ws.user_id,
                    workspace_id: ws.id,
                    name: 'Haircut',
                    price: 15,
                    duration_minutes: 30
                });
            }
            return null;
        },
        turns: [
            {
                userMessage: 'hi, can I book a haircut?',
                expectedStateAfter: 'awaiting_service',
            },
            {
                userMessage: 'Hey how r u',
                simulateDelayMinutes: 20, // 20 mins gap triggers session timeout reset
                expectedStateAfter: 'idle', // should reset to idle because session is stale
                assert: (res) => {
                    if (!res.replyText || res.replyText.trim() === '') {
                        throw new Error('Bot went silent on returning user message');
                    }
                    if (res.replyText.includes('[HANDOFF]')) {
                        throw new Error('Bot triggered an unwanted handoff on stale state return');
                    }
                }
            }
        ]
    },
    {
        name: 'Scenario 4: E-Commerce Happy Path Purchase',
        type: 'ecommerce',
        setup: async (ws) => {
            // Ensure mock Leather Jacket item exists in inventory
            const { data } = await supabase
                .from('inventory')
                .select('id')
                .eq('workspace_id', ws.id)
                .eq('item_name', 'Leather Jacket')
                .maybeSingle();

            if (!data) {
                await supabase.from('inventory').insert({
                    user_id: ws.user_id,
                    workspace_id: ws.id,
                    item_name: 'Leather Jacket',
                    stock_level: 5,
                    price: 120
                });
            }
            return null;
        },
        turns: [
            {
                userMessage: 'hello, do you have leather jackets?',
                expectedStateAfter: 'idle', // remains in idle while browsing
                assert: (res) => {
                    if (!res.actions.includes('tool_search_products')) {
                        throw new Error('Bot did not search for products in stock');
                    }
                }
            },
            {
                userMessage: 'I want to buy the leather jacket in size M',
                expectedStateAfter: 'awaiting_order_details',
            },
            {
                userMessage: 'My address is Beirut, name is Ali, phone is 71262815',
                expectedStateAfter: 'awaiting_checkout_confirmation',
            },
            {
                userMessage: 'Looks perfect, place the order',
                expectedStateAfter: 'idle',
                assert: (res) => {
                    if (!res.actions.includes('tool_place_order')) {
                        throw new Error('Bot did not execute place_order tool');
                    }
                }
            }
        ],
        teardown: async (ws, chat_id) => {
            await supabase.from('orders').delete().eq('chat_id', chat_id);
        }
    },
    {
        name: 'Scenario 5: Excessive Loop Handoff Safety Escalation',
        type: 'appointments',
        setup: async (ws) => {
            const { data } = await supabase
                .from('services')
                .select('id')
                .eq('workspace_id', ws.id)
                .eq('name', 'Haircut')
                .maybeSingle();

            if (!data) {
                await supabase.from('services').insert({
                    user_id: ws.user_id,
                    workspace_id: ws.id,
                    name: 'Haircut',
                    price: 15,
                    duration_minutes: 30
                });
            }
            return null;
        },
        turns: [
            {
                userMessage: 'what services do you offer?',
                expectedStateAfter: 'awaiting_service',
            },
            {
                userMessage: 'what services do you offer?', // Repeat 1
                expectedStateAfter: 'awaiting_service',
            },
            {
                userMessage: 'what services do you offer?', // Repeat 2 (triggers loop count fallback)
                expectedStateAfter: 'handoff',
                assert: (res) => {
                    if (res.stateAfter !== 'handoff') {
                        throw new Error('Bot did not escalate to handoff state on repeat loop');
                    }
                }
            }
        ]
    }
];

async function runScenarioBacktests() {
    console.log('🚀 Starting Multi-Turn Scenario Backtesting Suite...\n');
    
    // Find active workspaces to run tests against
    const { data: workspaces } = await supabase
        .from('ai_settings')
        .select('id, user_id, business_name, business_type')
        .order('created_at', { ascending: false });

    if (!workspaces?.length) {
        console.error('❌ No workspaces found in database');
        return;
    }

    const apptWs = workspaces.find(w => w.business_type === 'appointments') || workspaces[0];
    const ecomWs = workspaces.find(w => w.business_type === 'ecommerce') || workspaces[0];

    const { generateGhostReply } = await import('../utils/ghost-brain');
    
    let totalScenarios = SCENARIOS.length;
    let passedScenarios = 0;

    const logLines: string[] = ['=== SCENARIO BACKTEST RESULTS ===\n'];

    for (const scenario of SCENARIOS) {
        const ws = scenario.type === 'appointments' ? apptWs : ecomWs;
        const testChatId = `scenario_test_${scenario.type}_${Date.now()}`;
        
        console.log(`\n======================================================================`);
        console.log(`🎬 Running: ${scenario.name}`);
        console.log(`   Workspace: "${ws.business_name}" (${ws.business_type}) | Chat ID: ${testChatId}`);
        console.log(`======================================================================`);
        logLines.push(`\nScenario: ${scenario.name}`);

        // Temporarily patch workspace business_type for test validity if needed
        const originalType = ws.business_type;
        if (ws.business_type !== scenario.type) {
            await supabase.from('ai_settings').update({ business_type: scenario.type }).eq('id', ws.id);
            ws.business_type = scenario.type;
        }

        let setupData: any = null;
        if (scenario.setup) {
            setupData = await scenario.setup(ws, testChatId);
        }

        let scenarioFailed = false;

        for (let i = 0; i < scenario.turns.length; i++) {
            const turn = scenario.turns[i];
            console.log(`\n👉 TURN ${i + 1}:`);
            console.log(`   User: "${turn.userMessage}"`);

            // ⏱️ Simulate delay/inactivity if defined
            if (turn.simulateDelayMinutes) {
                console.log(`   [Simulating ${turn.simulateDelayMinutes} minutes of inactivity...]`);
                const staleTime = new Date(Date.now() - turn.simulateDelayMinutes * 60 * 1000).toISOString();
                
                // Get current state to modify
                const { data: currentState } = await supabase
                    .from('conversation_states')
                    .select('*')
                    .eq('chat_id', testChatId)
                    .maybeSingle();

                if (currentState) {
                    const data = currentState.data || {};
                    await supabase
                        .from('conversation_states')
                        .update({
                            updated_at: staleTime,
                            data: {
                                ...data,
                                stateEnteredAt: staleTime
                            }
                        })
                        .eq('id', currentState.id);
                }
            }

            try {
                const result = await generateGhostReply(
                    ws.user_id,
                    turn.userMessage,
                    supabase,
                    testChatId,
                    ws.id,
                    'whatsapp'
                );

                const reply = result?.replyText || '(No reply)';
                const auto = result?.automationResult;
                const stateBefore = auto?.stateBefore || 'idle';
                const stateAfter = auto?.stateAfter || 'idle';
                const actions = auto?.actions || [];

                console.log(`   Bot:  "${reply}"`);
                console.log(`   State Transition: [${stateBefore}] ➡️ [${stateAfter}]`);
                console.log(`   Actions Executed: [${actions.join(', ') || 'none'}]`);

                // Assert expected final state
                if (turn.expectedStateAfter && stateAfter !== turn.expectedStateAfter) {
                    throw new Error(`State mismatch: Expected stage to be "${turn.expectedStateAfter}", but got "${stateAfter}"`);
                }

                // Assert custom logic
                if (turn.assert) {
                    turn.assert({ replyText: reply, stateBefore, stateAfter, actions }, i);
                }

                console.log(`   🟢 PASS`);
                logLines.push(`  Turn ${i + 1}: PASS | User: "${turn.userMessage}" | Bot: "${reply}" | State: [${stateBefore}] -> [${stateAfter}]`);

            } catch (err: any) {
                console.log(`   🔴 FAIL: ${err.message}`);
                logLines.push(`  Turn ${i + 1}: FAIL | User: "${turn.userMessage}" | Error: ${err.message}`);
                scenarioFailed = true;
                break; // stop scenario turns if one fails
            }

            // Pause slightly between turns for realism
            await new Promise(resolve => setTimeout(resolve, 800));
        }

        // Clean up scenario test-specific entities
        if (scenario.teardown) {
            await scenario.teardown(ws, testChatId, setupData);
        }

        // Restore original type if patched
        if (originalType !== ws.business_type) {
            await supabase.from('ai_settings').update({ business_type: originalType }).eq('id', ws.id);
            ws.business_type = originalType;
        }

        // Clean up conversation state
        await supabase.from('conversation_states').delete().eq('chat_id', testChatId);

        if (!scenarioFailed) {
            passedScenarios++;
            console.log(`\n🎉 Scenario Completed Successfully!`);
            logLines.push(`Result: SUCCESS`);
        } else {
            console.log(`\n❌ Scenario Failed!`);
            logLines.push(`Result: FAILED`);
        }
    }

    console.log(`\n============================================================`);
    console.log(`RESULTS: ${passedScenarios}/${totalScenarios} Scenarios Passed`);
    console.log(`============================================================`);
    logLines.push(`\nSummary: Passed ${passedScenarios}/${totalScenarios} scenarios.`);

    const reportPath = path.resolve(process.cwd(), 'src/scripts/test-scenarios-results.txt');
    fs.writeFileSync(reportPath, logLines.join('\n'), 'utf-8');
    console.log(`Detailed report written to: ${reportPath}`);
}

runScenarioBacktests().catch(console.error);
