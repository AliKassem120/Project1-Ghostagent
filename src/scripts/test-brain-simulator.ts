/**
 * GhostAgent Brain — Conversational Simulation Sandbox & Benchmark Suite
 * Runs multi-turn conversations between a User Simulator LLM and the Ghost Agent,
 * then audits transcripts using an independent Auditor LLM to score bot performance.
 * 
 * Run: npx tsx src/scripts/test-brain-simulator.ts
 */

import { createClient } from '@supabase/supabase-js';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
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

// Force the agent to use openrouter/free during simulation
process.env.AGENT_MODEL = 'openrouter/free';

const openrouterInstance = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

interface Persona {
    id: string;
    name: string;
    description: string;
    businessType: 'appointments' | 'ecommerce';
    goal: string;
    personality: string;
    language: 'english' | 'arabizi' | 'mixed';
    initialMessage: string;
    maxTurns: number;
    setup?: (ws: any, chat_id: string) => Promise<any>;
    teardown?: (ws: any, chat_id: string, setupData: any) => Promise<void>;
}

const PERSONAS: Persona[] = [
    {
        id: 'ali_standard',
        name: 'Ali',
        description: 'Standard Appointments Booker (English)',
        businessType: 'appointments',
        goal: 'Book a Haircut appointment for next Monday at 11:00 AM.',
        personality: 'Polite, direct, answers questions quickly. Provides phone 71262815 and name Ali when prompted.',
        language: 'english',
        initialMessage: 'hi kifak, do you offer haircuts?',
        maxTurns: 6,
        setup: async (ws) => {
            // Ensure Haircut service exists
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
        teardown: async (ws, chat_id) => {
            await supabase.from('appointments').delete().eq('chat_id', chat_id);
        }
    },
    {
        id: 'samer_confused',
        name: 'Samer',
        description: 'Hesitant Franco-Arabic Booker (Arabizi)',
        businessType: 'appointments',
        goal: 'Book a haircut. First ask how much a haircut is, then ask if you are open today, then finally book for next Monday at 2 PM.',
        personality: 'Speaks Lebanese Franco-Arabic (Arabizi/Franco, using numbers like 3, 7, 2, etc.). Slightly hesitant. Asks questions step-by-step. Provides name Samer and phone 03123456.',
        language: 'arabizi',
        initialMessage: 'mar7aba, addesh se3r l haircut 3ndkn?',
        maxTurns: 7,
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
        teardown: async (ws, chat_id) => {
            await supabase.from('appointments').delete().eq('chat_id', chat_id);
        }
    },
    {
        id: 'sarah_angry',
        name: 'Sarah',
        description: 'Frustrated Appt Canceller (English)',
        businessType: 'appointments',
        goal: 'Cancel a confirmed haircut appointment for next Tuesday. Do NOT agree to reschedule. Insist on immediate cancellation. If the bot tries to push rescheduling, get angry and use ALL CAPS.',
        personality: 'Impatient, frustrated, types in short capitalized bursts if she feels she is being ignored or redirected. Name: Sarah, Phone: 76543210.',
        language: 'english',
        initialMessage: 'Hi, I need to cancel my haircut appointment for next Tuesday immediately.',
        maxTurns: 4,
        setup: async (ws, chat_id) => {
            // Setup a mock confirmed appointment to cancel
            const { data } = await supabase.from('appointments').insert({
                user_id: ws.user_id,
                workspace_id: ws.id,
                platform: 'whatsapp',
                chat_id: chat_id,
                instagram_user_id: chat_id,
                instagram_handle: 'SarahHandle',
                customer_name: 'Sarah',
                customer_phone: '76543210',
                service: 'Haircut',
                appointment_date: '2026-06-02', // Next Tuesday
                start_time: '14:00',
                end_time: '14:30',
                duration_minutes: 30,
                status: 'confirmed'
            }).select('id').single();
            return data?.id;
        },
        teardown: async (ws, chat_id, setupData) => {
            if (setupData) {
                await supabase.from('appointments').delete().eq('id', setupData);
            }
            await supabase.from('appointments').delete().eq('chat_id', chat_id);
        }
    },
    {
        id: 'chloe_ecom',
        name: 'Chloe',
        description: 'Direct E-Commerce Purchaser (English)',
        businessType: 'ecommerce',
        goal: 'Order a Leather Jacket, size M, shipped to Beirut.',
        personality: 'Friendly and cooperative, ready to buy, provides name Chloe, phone 70987654, and address Beirut immediately when asked.',
        language: 'english',
        initialMessage: 'hello, do you have leather jackets?',
        maxTurns: 6,
        setup: async (ws) => {
            // Ensure Leather Jacket exists
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
        teardown: async (ws, chat_id) => {
            await supabase.from('orders').delete().eq('chat_id', chat_id);
        }
    },
    {
        id: 'jad_sunday',
        name: 'Jad',
        description: 'Stubborn Sunday Slot Booker (Mixed Arabic/English)',
        businessType: 'appointments',
        goal: 'Book a haircut. He wants it ONLY on Sunday. When told that Sunday is closed, he should ask "why?" or complain, then reluctantly settle for Saturday at 12 PM instead.',
        personality: 'Stubborn customer, speaks mixed English and Arabizi ("bade e7joz nhar l a7ad"). Name Jad, phone 71888999.',
        language: 'mixed',
        initialMessage: 'hi, bade e7joz haircut la nhar l a7ad please',
        maxTurns: 7,
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
        teardown: async (ws, chat_id) => {
            await supabase.from('appointments').delete().eq('chat_id', chat_id);
        }
    }
];

async function generateUserSimulatorTurn(
    persona: Persona,
    history: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
    const systemPrompt = `You are a mock customer texting a business on WhatsApp.
Your profile:
- Name: ${persona.name}
- Goal: ${persona.goal}
- Personality/Tone: ${persona.personality}
- Language Preference: ${persona.language} (If arabizi or mixed, write in Franco-Arabic like "bde e7joz maw3ed" using numbers like 3, 7, 2, 5, etc. Do NOT use Arabic script. If english, use english.)

Guidelines:
1. Stay in character at all times.
2. Keep your messages extremely short and conversational, like a real person typing on WhatsApp (1-2 sentences max).
3. Do NOT mention you are an AI or simulator.
4. Try to achieve your goal. If the business bot asks you for details (e.g., name, phone, date), provide them if you have them, or invent them realistically.
5. If the bot is unhelpful, gets stuck, or repeats itself, react naturally (e.g. get annoyed, ask to speak to a human, or say forget it).
6. If your goal is met (e.g., the bot successfully books the appointment or confirms the order), thank them and say goodbye.
`;

    // Map roles: Bot's assistant -> Simulator's user, Bot's user -> Simulator's assistant
    const simulatorMessages = [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({
            role: h.role === 'assistant' ? 'user' : 'assistant',
            content: h.content
        }))
    ];

    const response = await generateText({
        model: openrouterInstance('openrouter/free'),
        messages: simulatorMessages as any,
        temperature: 0.5,
    });

    return response.text.trim();
}

async function auditConversation(
    persona: Persona,
    transcript: string
): Promise<any> {
    const prompt = `Review the following conversation between a customer (User) and a business automated agent (Bot).
The customer persona was:
Name: ${persona.name}
Goal: ${persona.goal}
Personality: ${persona.personality}
Language: ${persona.language}

TRANSCRIPT:
${transcript}

Assess the bot's performance and output a JSON object containing:
{
  "goalCompletion": <number 0-10>,
  "flowCompliance": <number 0-10>,
  "toneAdherence": <number 0-10>,
  "toolCorrectness": <number 0-10>,
  "overallScore": <number 0-10>,
  "reasoning": [
    "<short bullet point comments about the highlights or errors>"
  ]
}`;

    const response = await generateText({
        model: openrouterInstance('openrouter/free'),
        system: `You are an expert AI conversation auditor. You grade bot-user transcripts. You MUST respond with ONLY a valid raw JSON object matching the requested schema. Do not wrap in markdown code blocks.`,
        prompt,
        temperature: 0.1,
    });

    try {
        let cleanText = response.text.trim();
        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        }
        return JSON.parse(cleanText);
    } catch (err) {
        console.error('Failed to parse auditor JSON. Raw output was:', response.text);
        return {
            goalCompletion: 0,
            flowCompliance: 0,
            toneAdherence: 0,
            toolCorrectness: 0,
            overallScore: 0,
            reasoning: ['Failed to parse auditor response JSON']
        };
    }
}

async function runSimulatorSuite() {
    console.log('🚀 Starting Conversational Simulation Sandbox & Benchmark Suite (Ghost Eval Sandbox)...\n');

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

    const resultsSummary: any[] = [];
    const detailLogs: string[] = ['# Ghost Eval Sandbox — Simulation Results Report\n'];
    detailLogs.push(`Generated: ${new Date().toLocaleString()}\n`);

    for (const persona of PERSONAS) {
        const ws = persona.businessType === 'appointments' ? apptWs : ecomWs;
        const testChatId = `sim_test_${persona.id}_${Date.now()}`;

        console.log(`\n======================================================================`);
        console.log(`🎬 Persona: ${persona.name} - ${persona.description}`);
        console.log(`   Goal: "${persona.goal}"`);
        console.log(`   Workspace: "${ws.business_name}" (${ws.business_type}) | Chat ID: ${testChatId}`);
        console.log(`======================================================================`);

        // Temporarily patch workspace business_type for test validity if needed
        const originalType = ws.business_type;
        if (ws.business_type !== persona.businessType) {
            await supabase.from('ai_settings').update({ business_type: persona.businessType }).eq('id', ws.id);
            ws.business_type = persona.businessType;
        }

        let setupData: any = null;
        if (persona.setup) {
            setupData = await persona.setup(ws, testChatId);
        }

        const history: { role: 'user' | 'assistant'; content: string }[] = [];
        let nextUserMsg = persona.initialMessage;

        detailLogs.push(`## Persona: ${persona.name} (${persona.description})`);
        detailLogs.push(`**Target Goal:** ${persona.goal}`);
        detailLogs.push(`**Personality:** ${persona.personality}\n`);
        detailLogs.push(`### Dialogue Transcript\n`);

        for (let turn = 0; turn < persona.maxTurns; turn++) {
            console.log(`\n👉 Turn ${turn + 1}:`);
            console.log(`   User Simulator: "${nextUserMsg}"`);
            history.push({ role: 'user', content: nextUserMsg });
            detailLogs.push(`- **User**: "${nextUserMsg}"`);

            try {
                const botResult = await generateGhostReply(
                    ws.user_id,
                    nextUserMsg,
                    supabase,
                    testChatId,
                    ws.id,
                    'whatsapp'
                );

                const botReply = botResult?.replyText || '(no reply)';
                const auto = botResult?.automationResult;
                const stateBefore = auto?.stateBefore || 'idle';
                const stateAfter = auto?.stateAfter || 'idle';
                const actions = auto?.actions || [];

                console.log(`   Ghost Agent:    "${botReply}"`);
                console.log(`   [State: ${stateBefore} -> ${stateAfter}] [Actions: ${actions.join(', ') || 'none'}]`);

                history.push({ role: 'assistant', content: botReply });
                detailLogs.push(`- **Bot** (State: \`${stateBefore} -> ${stateAfter}\`, Actions: \`${actions.join(', ') || 'none'}\`): "${botReply}"`);

                if (stateAfter === 'handoff') {
                    console.log(`   ⚠️ Bot escalated to handoff. Terminating conversation loop.`);
                    detailLogs.push(`\n*Conversation terminated by bot handoff.*`);
                    break;
                }

                if (actions.includes('book_appointment_success') || actions.includes('place_order_success') || actions.includes('cancel_appointment_success')) {
                    console.log(`   🎉 Bot completed main transactional action! Terminating conversation loop.`);
                    detailLogs.push(`\n*Conversation terminated by transactional success.*`);
                    break;
                }

                if (turn === persona.maxTurns - 1) {
                    break;
                }

                // Generate next user simulation message
                nextUserMsg = await generateUserSimulatorTurn(persona, history);
                await new Promise(r => setTimeout(r, 2000)); // 2s delay between turns (Gemini rate limit safety)

            } catch (err: any) {
                console.error(`❌ Error in dialogue turn:`, err.message);
                detailLogs.push(`\n**Error during turn execution:** ${err.message}`);
                break;
            }
        }

        // Clean up conversation state
        await supabase.from('conversation_states').delete().eq('chat_id', testChatId);

        // Teardown setups
        if (persona.teardown) {
            await persona.teardown(ws, testChatId, setupData);
        }

        // Restore original type if patched
        if (originalType !== ws.business_type) {
            await supabase.from('ai_settings').update({ business_type: originalType }).eq('id', ws.id);
            ws.business_type = originalType;
        }

        // Run Auditor evaluation
        console.log(`\n🕵️ Auditing conversation transcript...`);
        const transcriptStr = history.map(h => `${h.role === 'user' ? 'User' : 'Bot'}: "${h.content}"`).join('\n');
        const audit = await auditConversation(persona, transcriptStr);

        console.log(`   Auditor Summary Score: ${audit.overallScore} / 10`);
        console.log(`   Reasoning:`);
        audit.reasoning.forEach((r: string) => console.log(`    - ${r}`));

        resultsSummary.push({
            persona: persona.name,
            desc: persona.description,
            scores: audit,
        });

        detailLogs.push(`\n### Auditor Evaluation Report`);
        detailLogs.push(`- **Overall Score**: ${audit.overallScore}/10`);
        detailLogs.push(`- **Goal Completion**: ${audit.goalCompletion}/10`);
        detailLogs.push(`- **FSM Flow & Logic Compliance**: ${audit.flowCompliance}/10`);
        detailLogs.push(`- **Tone Adherence**: ${audit.toneAdherence}/10`);
        detailLogs.push(`- **Tool Correctness**: ${audit.toolCorrectness}/10\n`);
        detailLogs.push(`**Auditor Comments:**`);
        audit.reasoning.forEach((r: string) => detailLogs.push(`- ${r}`));
        detailLogs.push(`\n---\n`);
    }

    // Build the matrix dashboard table
    const tableHeader = `| Persona | Goal Completion | FSM Flow | Tone Adherence | Tool Correctness | Overall Score |\n|---|---|---|---|---|---|`;
    const tableRows = resultsSummary.map(r => 
        `| ${r.persona} (${r.desc}) | ${r.scores.goalCompletion}/10 | ${r.scores.flowCompliance}/10 | ${r.scores.toneAdherence}/10 | ${r.scores.toolCorrectness}/10 | **${r.scores.overallScore}/10** |`
    ).join('\n');

    const matrixReport = [
        `# Ghost Eval Sandbox — Benchmark Matrix`,
        `Generated: ${new Date().toLocaleString()}\n`,
        tableHeader,
        tableRows,
        `\nDetailed transcripts and auditor notes can be found in [simulation-results.md](file:///C:/Users/ali/Project1/src/scripts/simulation-results.md).`
    ].join('\n');

    const scorePath = path.resolve(process.cwd(), 'src/scripts/simulation-matrix.md');
    fs.writeFileSync(scorePath, matrixReport, 'utf-8');

    const reportPath = path.resolve(process.cwd(), 'src/scripts/simulation-results.md');
    fs.writeFileSync(reportPath, detailLogs.join('\n'), 'utf-8');

    console.log(`\n============================================================`);
    console.log(`🎉 Benchmark Simulation Complete!`);
    console.log(`- Scoreboard Dashboard: src/scripts/simulation-matrix.md`);
    console.log(`- Detailed Transcript Report: src/scripts/simulation-results.md`);
    console.log(`============================================================\n`);
}

runSimulatorSuite().catch(console.error);
