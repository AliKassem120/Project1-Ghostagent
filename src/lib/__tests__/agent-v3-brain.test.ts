import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.DEEPSEEK_API_KEY = 'mock-key';

import { runV3Agent } from '../ai/agent';
import { getTemplate } from '../automation-v3/templates';
import { checkVoiceConsistency } from '../automation-v3/voice-consistency-guard';

// Mock OpenAI (DeepSeek client calls) using vi.hoisted for hoisted references
const { mockChatCompletionsCreate } = vi.hoisted(() => {
    const mockFn = vi.fn().mockImplementation(async (args) => {
        const messages = args.messages || [];
        const content = messages[messages.length - 1]?.content || '';

        // 1. Intent Classifier Mock
        if (content.includes('intent classifier')) {
            return {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            intent: 'product_availability',
                            entities: { productName: 'hoodie' },
                            confidence: 0.99,
                            languageScript: 'franco',
                            needsClarification: false,
                            sentimentScore: 0.2,
                            urgencyLevel: 'medium'
                        })
                    }
                }]
            };
        }

        // 2. Thinking Layer Mock
        if (content.includes('You are the internal strategist')) {
            return {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            intentAnalysis: 'Customer wants to buy a hoodie',
                            emotion: 'excited',
                            goal: 'close_sale',
                            toolsNeeded: ['search_products'],
                            suggestedNextState: 'awaiting_variant',
                            customStrategy: 'Tell customer we only have 5 left'
                        })
                    }
                }]
            };
        }

        // 3. Response Generator Mock
        // Return a response that includes Arabizi scarcity template words to satisfy the test assertions
        return {
            choices: [{
                message: {
                    content: 'Badda 5 bas mn Essential Hoodie b $65'
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

describe('V3 Brain Layer Unit and Integration Tests', () => {
    let mockSupabase: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Stub env keys
        vi.stubEnv('DEEPSEEK_API_KEY', 'mock-deepseek-key');

        // Supabase Mock Client Chain
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

    describe('Templates Module', () => {
        it('should correctly fetch and compile templates', () => {
            const template = getTemplate('greeting_vip', 'english', { name: 'Ali' });
            expect(template).toBe('Hey Ali! Good to see you again 🙌');
        });

        it('should fallback to english if language match is not found', () => {
            const template = getTemplate('scarcity_last_one', 'unknown');
            expect(template).toBe("That's the last one 😬 Want it?");
        });
    });

    describe('Voice Consistency Guard', () => {
        it('should remove robotic phrases and formal greetings in casual tone', () => {
            const result = checkVoiceConsistency(
                "As an AI, I am here to help you. Dear customer, how can I help you today?",
                { tone: 'Casual' },
                []
            );
            expect(result.approved).toBe(false);
            expect(result.violations.length).toBeGreaterThan(0);
            expect(result.correctedText).not.toContain("As an AI");
            expect(result.correctedText).not.toContain("dear");
        });

        it('should correct hallucinated prices against tool results', () => {
            const toolResults = [
                {
                    tool: 'search_products',
                    result: { itemName: 'Crewneck', price: 25.0, stockLevel: 10 }
                }
            ];
            const result = checkVoiceConsistency(
                "The Crewneck costs $45.",
                { tone: 'Casual' },
                toolResults
            );
            expect(result.approved).toBe(false);
            expect(result.violations).toContain("Hallucinated price: expected $25, found $45");
            expect(result.correctedText).toBe("The Crewneck costs $25.");
        });
    });

    describe('Agent V3 Brain Integration Flow', () => {
        it('Scenario: Runs thinking layer and response generator correctly', async () => {
            const config = {
                id: 'ws_123',
                user_id: 'user_123',
                businessName: 'Ali Shop',
                businessType: 'ecommerce' as const,
                tone: 'Casual',
                language: 'franco',
                useEmojis: true,
                timezone: 'America/New_York'
            };

            const result = await runV3Agent({
                supabase: mockSupabase,
                userId: 'user_123',
                workspaceId: 'ws_123',
                workspaceType: 'ecommerce',
                chatId: 'chat_v3_test',
                message: 'Do you have the hoodie?',
                platform: 'instagram'
            }, config as any);

            expect(result.shouldReply).toBe(true);
            expect(result.replyText).toContain('Badda 5 bas mn');
            expect(result.replyText).toContain('$65');
            expect(result.actions).toContain('v3_brain_reply');
        });
    });
});
