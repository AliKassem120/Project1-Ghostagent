import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runV3Agent } from '../ai/agent';
import { generateText } from 'ai';

// Mock Vercel AI SDK generateText function
vi.mock('ai', async (importOriginal) => {
    const original: any = await importOriginal();
    return {
        ...original,
        generateText: vi.fn(),
    };
});

// Mock OpenAI (DeepSeek) completions for decoupled Brain Layer pipeline in tests using vi.hoisted for hoisted references
const { mockChatCompletionsCreate } = vi.hoisted(() => {
    const mockFn = vi.fn().mockImplementation(async (args) => {
        // Import generateText dynamically inside to get its value at execution time
        const { generateText } = await import('ai');
        // If Thinking Layer (strategist JSON)
        if (args.response_format?.type === 'json_object') {
            const genTextResult = await (generateText as any).mock.results.slice(-1)[0]?.value;
            const text = genTextResult?.text || '';
            // If the mocked Groq output is a handoff, return handoff strategy
            const isHandoff = text.includes('[HANDOFF]');
            return {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            intentAnalysis: 'mock intent',
                            emotion: 'neutral',
                            goal: isHandoff ? 'redirect_human' : 'gather_info',
                            knownFacts: [],
                            unknownGaps: [],
                            templateSuitable: false,
                            customStrategy: 'mock strategy',
                            toneInstruction: 'Friendly',
                            shouldHandoff: isHandoff,
                            handoffReason: isHandoff ? 'human_requested' : undefined
                        })
                    }
                }]
            };
        }
        // Else Response Generator (mouth text)
        const genTextResult = await (generateText as any).mock.results.slice(-1)[0]?.value;
        const text = genTextResult?.text || 'Mock response';
        return {
            choices: [{
                message: {
                    content: text
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

describe('AI Agent Offline Backtesting Suite', () => {
    let mockSupabase: any;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Re-stub the Groq API key before each test to ensure it's always set
        vi.stubEnv('GROQ_API_KEY', 'mock-groq-api-key');
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

        mockSupabase = {
            from: vi.fn().mockReturnValue(chain),
        };
    });

    it('Scenario 1: Triggers check_slot tool call for appointments', async () => {
        const mockGenerateText = generateText as any;
        mockGenerateText.mockResolvedValue({
            text: 'I will check if there is a slot available.',
            steps: [
                {
                    toolResults: [
                        {
                            toolName: 'check_slot',
                            args: { date: '2026-05-21', time: '15:00', service: 'Haircut' },
                            result: { success: true, available: true }
                        }
                    ]
                }
            ]
        });

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
        const mockGenerateText = generateText as any;
        mockGenerateText.mockResolvedValue({
            text: 'Checking stock for the jacket.',
            steps: [
                {
                    toolResults: [
                        {
                            toolName: 'search_products',
                            args: { query: 'leather jacket' },
                            result: { success: true, products: [{ itemName: 'Leather Jacket', stockLevel: 5 }] }
                        }
                    ]
                }
            ]
        });

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
        const mockGenerateText = generateText as any;
        mockGenerateText.mockResolvedValue({
            text: '[HANDOFF] Let me transfer you to a human manager.',
            steps: []
        });

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

    it('Scenario 4: Triggers LLM fallback when primary model fails', async () => {
        const mockGenerateText = generateText as any;
        // First call fails, second call succeeds (the fallback)
        mockGenerateText
            .mockRejectedValueOnce(new Error('Rate limit exceeded'))
            .mockResolvedValueOnce({
                text: 'Fallback response works!',
                steps: []
            });

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
