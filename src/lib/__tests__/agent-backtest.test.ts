import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runV3Agent } from '../ai/agent';

// Mock OpenAI (DeepSeek) completions for the new pipeline
const { mockChatCompletionsCreate } = vi.hoisted(() => {
    const mockFn = vi.fn().mockImplementation(async (args) => {
        const messages = args.messages || [];
        const content = messages[messages.length - 1]?.content || '';

        // Extract the customer message from the prompt
        let userMsg = '';
        const intentMatch = content.match(/CUSTOMER MESSAGE: "([^"]+)"/i);
        const thinkingMatch = content.match(/=== USER MESSAGE ===\s*"([^"]+)"/i);
        const responseMatch = content.match(/=== CUSTOMER'S LATEST MESSAGE ===\s*"([^"]+)"/i);
        
        if (intentMatch) {
            userMsg = intentMatch[1].toLowerCase();
        } else if (thinkingMatch) {
            userMsg = thinkingMatch[1].toLowerCase();
        } else if (responseMatch) {
            userMsg = responseMatch[1].toLowerCase();
        } else {
            userMsg = content.toLowerCase();
        }

        // 1. Intent Classifier Mock
        if (content.includes('intent classifier')) {
            let intent = 'unknown';
            let entities: any = {};
            if (userMsg.includes('haircut')) {
                intent = 'booking_intent';
                entities = { serviceName: 'Haircut' };
            } else if (userMsg.includes('jacket')) {
                intent = 'purchase_intent';
                entities = { productName: 'leather jacket' };
            } else if (userMsg.includes('human') || userMsg.includes('speak')) {
                intent = 'human_handoff';
            } else if (userMsg.includes('hello') || userMsg.includes('hi')) {
                intent = 'greeting';
            }
            return {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            intent,
                            entities,
                            confidence: 0.99,
                            languageScript: 'english',
                            needsClarification: false,
                            sentimentScore: 0.1,
                            urgencyLevel: 'medium'
                        })
                    }
                }]
            };
        }

        // 2. Thinking Layer Mock
        if (content.includes('You are the internal strategist')) {
            let toolsNeeded: string[] = [];
            let suggestedNextState = 'idle';
            if (userMsg.includes('haircut')) {
                toolsNeeded = ['check_slot'];
                suggestedNextState = 'awaiting_date_time';
            } else if (userMsg.includes('jacket')) {
                toolsNeeded = ['search_products'];
                suggestedNextState = 'awaiting_variant';
            } else if (userMsg.includes('human') || userMsg.includes('speak')) {
                suggestedNextState = 'handoff';
            }
            return {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            intentAnalysis: 'mocked intent analysis',
                            emotion: 'neutral',
                            goal: 'gather_info',
                            toolsNeeded,
                            suggestedNextState,
                            customStrategy: 'mocked strategy'
                        })
                    }
                }]
            };
        }

        // 3. Response Generator Mock
        let reply = 'Fallback response works!';
        if (userMsg.includes('haircut') || userMsg.includes('book')) {
            reply = 'I will check if there is a slot available.';
        } else if (userMsg.includes('jacket') || userMsg.includes('leather')) {
            reply = 'Checking stock for the jacket.';
        } else if (userMsg.includes('human') || userMsg.includes('speak')) {
            reply = 'Connecting you to a human agent shortly...';
        }

        return {
            choices: [{
                message: {
                    content: reply
                }
            }]
        };
    });
    return {
        mockChatCompletionsCreate: mockFn
    };
});

vi.mock('openai', () => {
    class MockOpenAI {
        chat = {
            completions: {
                create: mockChatCompletionsCreate
            }
        };
    }
    return {
        default: MockOpenAI
    };
});

// Mock service lookup and product lookup for deterministic FSM flow
vi.mock('../ai/appointments/services', async (importOriginal) => {
    const original: any = await importOriginal();
    return {
        ...original,
        loadActiveServices: vi.fn().mockResolvedValue([
            { id: 'serv_1', name: 'Haircut', price: 20, durationMinutes: 30 }
        ]),
        findBestServiceMatch: vi.fn().mockReturnValue({
            id: 'serv_1', name: 'Haircut', price: 20, durationMinutes: 30
        }),
    };
});

vi.mock('../ai/ecommerce/products', async (importOriginal) => {
    const original: any = await importOriginal();
    return {
        ...original,
        searchProducts: vi.fn().mockResolvedValue([
            { id: 'prod_1', itemName: 'Leather Jacket', price: 120, stockLevel: 5 }
        ]),
        findBestProductMatch: vi.fn().mockReturnValue({
            id: 'prod_1', itemName: 'Leather Jacket', price: 120, stockLevel: 5
        }),
    };
});

describe('AI Agent Offline Backtesting Suite', () => {
    let mockSupabase: any;

    beforeEach(() => {
        vi.clearAllMocks();
        
        vi.stubEnv('DEEPSEEK_API_KEY', 'mock-deepseek-api-key');
        vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'mock-google-api-key');
        vi.stubEnv('OPENAI_API_KEY', 'mock-openai-key');
        
        // Setup mock Supabase client that implements a complete chainable API
        const chain: any = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.or = vi.fn().mockReturnValue(chain);
        chain.filter = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
        chain.upsert = vi.fn().mockResolvedValue({ error: null });
        chain.insert = vi.fn().mockResolvedValue({ error: null });
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
        chain.ilike = vi.fn().mockReturnValue(chain);
        chain.in = vi.fn().mockReturnValue(chain);
        chain.lt = vi.fn().mockReturnValue(chain);
        chain.gt = vi.fn().mockReturnValue(chain);
        chain.gte = vi.fn().mockReturnValue(chain);

        mockSupabase = {
            from: vi.fn().mockReturnValue(chain),
        };
    });

    it('Scenario 1: Triggers check_slot tool call for appointments', async () => {
        const config = {
            id: 'ws_123',
            user_id: 'user_123',
            name: 'Ali Salon',
            business_type: 'appointments' as const,
            tone: 'Casual',
            language: 'English',
            useEmojis: true,
            timezone: 'America/New_York'
        };

        const result = await runV3Agent({
            supabase: mockSupabase,
            userId: 'user_123',
            workspaceId: 'ws_123',
            workspaceType: 'appointments',
            chatId: 'chat_appointment_test',
            message: 'Book a haircut for tomorrow at 3 PM',
            platform: 'instagram'
        }, config as any);

        expect(result.shouldReply).toBe(true);
        expect(result.replyText).toBe('I will check if there is a slot available.');
        expect(result.actions).toContain('tool_check_slot');
        expect(result.debug.dbWriteAttempted).toBe(false);
    });

    it('Scenario 2: Triggers search_products tool call for ecommerce', async () => {
        const config = {
            id: 'ws_456',
            user_id: 'user_123',
            name: 'Ali Boutique',
            business_type: 'ecommerce' as const,
            tone: 'Professional',
            language: 'English',
            useEmojis: false,
            timezone: 'America/New_York'
        };

        const result = await runV3Agent({
            supabase: mockSupabase,
            userId: 'user_123',
            workspaceId: 'ws_456',
            workspaceType: 'ecommerce',
            chatId: 'chat_ecommerce_test',
            message: 'Do you have the leather jacket in S?',
            platform: 'whatsapp'
        }, config as any);

        expect(result.shouldReply).toBe(true);
        expect(result.replyText).toBe('Checking stock for the jacket.');
        expect(result.actions).toContain('tool_search_products');
    });

    it('Scenario 3: Triggers human handoff when requested', async () => {
        const config = {
            id: 'ws_123',
            user_id: 'user_123',
            name: 'Ali Salon',
            business_type: 'appointments' as const,
            tone: 'Casual',
            language: 'English',
            useEmojis: true,
            timezone: 'America/New_York'
        };

        const result = await runV3Agent({
            supabase: mockSupabase,
            userId: 'user_123',
            workspaceId: 'ws_123',
            workspaceType: 'appointments',
            chatId: 'chat_handoff_test',
            message: 'let me speak to a human',
            platform: 'instagram'
        }, config as any);

        expect(result.shouldReply).toBe(true);
        expect(result.replyText).toContain('Connecting you to a human agent shortly');
        expect(result.actions).toContain('handoff');
        expect(result.stateAfter).toBe('handoff');
        expect(mockSupabase.from).toHaveBeenCalledWith('conversation_states');
    });

    it('Scenario 4: Triggers fallback when Hello is sent', async () => {
        const config = {
            id: 'ws_123',
            user_id: 'user_123',
            name: 'Ali Salon',
            business_type: 'appointments' as const,
            tone: 'Casual',
            language: 'English',
            useEmojis: true,
            timezone: 'America/New_York'
        };

        const result = await runV3Agent({
            supabase: mockSupabase,
            userId: 'user_123',
            workspaceId: 'ws_123',
            workspaceType: 'appointments',
            chatId: 'chat_fallback_test',
            message: 'Hello',
            platform: 'instagram'
        }, config as any);

        expect(result.shouldReply).toBe(true);
        expect(result.replyText).toBe('Fallback response works!');
        expect(result.actions).toContain('llm_reply');
    });
});
