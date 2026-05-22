import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectEmotion, buildEmotionPromptBlock } from '../ai/emotional-intelligence';
import { extractNoteworthyFacts, saveCustomerNotes, loadCustomerNotes } from '../ai/customer-notes';
import { buildProactiveSuggestions, getNextAvailableSlotSuggestions } from '../ai/intent-chain';
import { linkProfilesByName } from '../ai/customer-profile';
import { generateText } from 'ai';

// Mock Vercel AI SDK generateText function
vi.mock('ai', async (importOriginal) => {
    const original: any = await importOriginal();
    return {
        ...original,
        generateText: vi.fn(),
    };
});

describe('Human Brain Phase 3 Features', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('1. Emotional Intelligence', () => {
        it('detects frustrated sentiment from keywords and punctuation', () => {
            const res1 = detectEmotion('This is the worst wtf experience ever!!!');
            expect(res1.sentiment).toBe('frustrated');
            expect(res1.confidence).toBeGreaterThan(0.2);
            expect(res1.triggers).toContain('excessive_exclamation');

            const res2 = detectEmotion('khalas wtf is this service');
            expect(res2.sentiment).toBe('frustrated');
        });

        it('detects ALL CAPS frustration', () => {
            const res = detectEmotion('I HAVE BEEN WAITING FOR A RESPONSE FOR AN HOUR');
            expect(res.sentiment).toBe('frustrated');
            expect(res.triggers).toContain('all_caps');
        });

        it('detects confused sentiment', () => {
            const res1 = detectEmotion('what do you mean?? shu ya3ne?');
            expect(res1.sentiment).toBe('confused');
            expect(res1.triggers).toContain('excessive_question_marks');
        });

        it('detects urgent sentiment', () => {
            const res1 = detectEmotion('please ship it ASAP halla2 halla2');
            expect(res1.sentiment).toBe('urgent');
        });

        it('detects positive sentiment', () => {
            const res1 = detectEmotion('thank you so much! amazing service betjannin');
            expect(res1.sentiment).toBe('positive');
        });

        it('detects neutral sentiment by default', () => {
            const res1 = detectEmotion('hello, can I ask a question?');
            expect(res1.sentiment).toBe('neutral');
        });

        it('detects frustrated customer repeating themselves', () => {
            const history = [
                { role: 'user', content: 'where is my order?' },
                { role: 'assistant', content: 'Let me look that up for you.' },
                { role: 'user', content: 'where is my order? it is taking too long' },
            ];
            const res = detectEmotion('where is my order?', history);
            expect(res.sentiment).toBe('frustrated');
            expect(res.triggers).toContain('repeated_message');
        });

        it('builds appropriate emotion prompt block', () => {
            const signal = { sentiment: 'frustrated' as const, confidence: 0.8, triggers: ['all_caps'] };
            const block = buildEmotionPromptBlock(signal);
            expect(block).toContain('EMOTIONAL CONTEXT: The customer appears FRUSTRATED');
            expect(block).toContain('Be extra empathetic');

            const neutralBlock = buildEmotionPromptBlock({ sentiment: 'neutral', confidence: 1, triggers: [] });
            expect(neutralBlock).toBe('');
        });
    });

    describe('2. Customer Memory Notes', () => {
        it('extracts noteworthy facts from conversation using LLM', async () => {
            const mockGenerateText = generateText as any;
            mockGenerateText.mockResolvedValue({
                text: 'preference: prefers short hair\nfact: has a daughter named Lara\nNONE',
            });

            const mockGroq = vi.fn();
            const messages = [
                { role: 'user', content: 'I really prefer short hair. Also Lara is my daughter.' },
                { role: 'assistant', content: 'Good to know!' },
            ];

            const notes = await extractNoteworthyFacts(mockGroq, messages);
            expect(notes).toHaveLength(2);
            expect(notes[0]).toEqual({ noteType: 'preference', content: 'prefers short hair' });
            expect(notes[1]).toEqual({ noteType: 'fact', content: 'has a daughter named Lara' });
        });

        it('skips extraction if LLM says NONE or returned text is empty', async () => {
            const mockGenerateText = generateText as any;
            mockGenerateText.mockResolvedValue({
                text: 'NONE',
            });

            const mockGroq = vi.fn();
            const notes = await extractNoteworthyFacts(mockGroq, [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }]);
            expect(notes).toEqual([]);
        });

        it('saves and loads notes using supabase client', async () => {
            const insertMock = vi.fn().mockResolvedValue({ error: null });
            const chain: any = {};
            chain.select = vi.fn().mockReturnValue(chain);
            chain.eq = vi.fn().mockReturnValue(chain);
            chain.order = vi.fn().mockReturnValue(chain);
            chain.limit = vi.fn().mockResolvedValue({
                data: [
                    { content: 'prefers short hair' },
                    { content: 'allergic to ammonia' }
                ],
                error: null
            });

            const mockSupabase = {
                from: vi.fn().mockImplementation((table) => {
                    if (table === 'customer_notes') {
                        return { insert: insertMock, ...chain };
                    }
                    return chain;
                }),
            } as any;

            await saveCustomerNotes(mockSupabase, 'ws-1', 'chat-1', 'instagram', [
                { noteType: 'preference', content: 'prefers short hair' }
            ]);

            expect(insertMock).toHaveBeenCalledWith([
                {
                    workspace_id: 'ws-1',
                    chat_id: 'chat-1',
                    platform: 'instagram',
                    note_type: 'preference',
                    content: 'prefers short hair',
                    source: 'auto'
                }
            ]);

            const loaded = await loadCustomerNotes(mockSupabase, 'ws-1', 'chat-1');
            expect(loaded).toEqual(['allergic to ammonia', 'prefers short hair']); // reversed to chronological order
        });
    });

    describe('3. Intent Chaining & Proactive Suggestions', () => {
        const config = {
            id: 'ws-1',
            user_id: 'u-1',
            name: 'Test Business',
            businessType: 'appointments' as const,
            tone: 'Casual',
            language: 'English',
            useEmojis: true,
            timezone: 'UTC'
        };

        const timeContext = {
            dayName: 'Monday',
            isoDate: '2026-05-25',
            isoTime: '10:00:00'
        };

        it('generates upcoming slots based on business hours', () => {
            const slots = getNextAvailableSlotSuggestions(timeContext, config as any, 3);
            expect(slots).toHaveLength(3);
            expect(slots[0].date).toContain('Monday');
            expect(slots[0].time).toBe('12:00 PM'); // next slots after 10:00 AM
        });

        it('suggests available slots when state is awaiting_date_time', () => {
            const slots = [
                { date: 'Monday 2026-05-25', time: '12:00 PM' },
                { date: 'Monday 2026-05-25', time: '2:00 PM' },
            ];

            const suggestions = buildProactiveSuggestions({
                config: config as any,
                sessionState: 'awaiting_date_time',
                availableSlots: slots,
            });

            expect(suggestions).toContain('PROACTIVE CONTEXT');
            expect(suggestions).toContain('Available slots coming up: Monday 2026-05-25 at 12:00 PM, Monday 2026-05-25 at 2:00 PM');
        });

        it('suggests popular products in stock for e-commerce idle/browsing stage', () => {
            const ecomConfig = { ...config, businessType: 'ecommerce' as const };
            const products = [
                { itemName: 'Leather Jacket', price: 120, stockLevel: 5 },
                { itemName: 'Blue Jeans', price: 45, stockLevel: 0 },
            ];

            const suggestions = buildProactiveSuggestions({
                config: ecomConfig as any,
                sessionState: 'idle',
                products,
            });

            expect(suggestions).toContain('Popular items in stock: Leather Jacket ($120)');
            expect(suggestions).not.toContain('Blue Jeans'); // out of stock
        });

        it('suggests resuming incomplete bookings/orders from recent summaries', () => {
            const suggestions = buildProactiveSuggestions({
                config: config as any,
                sessionState: 'idle',
                recentSummaries: [
                    'Customer said hi.',
                    'Customer was interested in booking a haircut but left without booking.'
                ]
            });

            expect(suggestions).toContain('Last time this customer was interested in booking a haircut but left without booking');
            expect(suggestions).toContain('You could gently ask if they\'d still like to proceed.');
        });
    });

    describe('4. Cross-Channel Identity Stitching', () => {
        it('links profiles sharing the same normalized name across platforms', async () => {
            const updateEqMock = vi.fn().mockResolvedValue({ error: null });
            const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
            const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });
            const deleteMock = vi.fn().mockReturnValue({ eq: deleteEqMock });

            const chain: any = {};
            chain.select = vi.fn().mockReturnValue(chain);
            chain.eq = vi.fn().mockReturnValue(chain);
            chain.not = vi.fn().mockReturnValue(chain);
            chain.order = vi.fn().mockResolvedValue({
                data: [
                    {
                        id: 'p-primary',
                        workspace_id: 'ws-1',
                        name: 'Ali Kassem',
                        instagram_chat_id: 'ig-123',
                        whatsapp_chat_id: null,
                        phone: null,
                        total_orders: 1,
                        first_seen: '2026-05-01T00:00:00Z',
                        tags: ['vip']
                    },
                    {
                        id: 'p-dupe',
                        workspace_id: 'ws-1',
                        name: 'ali kassem',
                        instagram_chat_id: null,
                        whatsapp_chat_id: 'wa-456',
                        phone: '+96170123456',
                        total_orders: 2,
                        first_seen: '2026-05-02T00:00:00Z',
                        tags: ['new']
                    }
                ],
                error: null
            });

            const mockSupabase = {
                from: vi.fn().mockImplementation((table) => {
                    if (table === 'customer_profiles') {
                        return {
                            ...chain,
                            update: updateMock,
                            delete: deleteMock,
                        };
                    }
                    return chain;
                }),
            } as any;

            await linkProfilesByName(mockSupabase, 'ws-1', 'Ali Kassem');

            // Assert that primary is updated with the duplicate's WhatsApp ID and phone, and sums total orders
            expect(updateMock).toHaveBeenCalledWith({
                whatsapp_chat_id: 'wa-456',
                phone: '+96170123456',
                total_orders: 3,
                total_appointments: 0,
                tags: JSON.stringify(['vip', 'new'])
            });
            expect(updateEqMock).toHaveBeenCalledWith('id', 'p-primary');

            // Assert duplicate profile is deleted
            expect(deleteMock).toHaveBeenCalled();
            expect(deleteEqMock).toHaveBeenCalledWith('id', 'p-dupe');
        });
    });
});
