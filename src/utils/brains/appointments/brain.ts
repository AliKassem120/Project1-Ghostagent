import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { z } from 'zod';
import { BusinessProfile } from '../types';
import { buildAppointmentsSystemPrompt } from './prompt';
import { getConversationMemory, summarizeConversationIfNeeded, trackConversationMessage } from '../../rolling-memory';
import { checkCalendarAvailabilityTool } from './tools';

// ─────────────────────────────────────────────────────────────────────────────
// Detects if the bot is in an active booking collection phase
// i.e. the bot already asked for name/phone and is waiting for them.
// ─────────────────────────────────────────────────────────────────────────────
function isInBookingFlow(historyMessages: any[]): boolean {
    const last5 = historyMessages.slice(-5);
    return last5.some((m: any) => {
        const text = (m?.content || '').toLowerCase();
        return (
            text.includes('esm') ||
            text.includes('ra2m') ||
            text.includes('name') ||
            text.includes('phone') ||
            text.includes('maw3ed') ||
            text.includes('maw3ad') ||
            text.includes('se3a') ||
            text.includes('yom')
        );
    });
}

export async function generateAppointmentsGhostReply(
    userId: string,
    userMessage: string,
    supabase: any,
    chatId?: string,
    workspaceId?: string,
    checkoutContext?: string
) {
    console.log('📅 [APPOINTMENTS BRAIN] Generating reply for', userId, workspaceId ? `(workspace: ${workspaceId})` : '');

    try {
        // ── 1. Load workspace settings ──────────────────────────────────────
        let settingsQuery = supabase
            .from('ai_settings')
            .select('business_name, business_type, tone, system_instructions, urgency_mode, handoff_keywords, language, store_location, contact_info, use_emojis, use_local_slang, shipping_rules, is_autopilot_enabled');

        if (workspaceId) {
            settingsQuery = settingsQuery.eq('id', workspaceId);
        } else {
            settingsQuery = settingsQuery.eq('user_id', userId).is('id', null);
        }

        const { data: settings } = await settingsQuery.limit(1).maybeSingle();
        const { data: userRecord } = await supabase.from('users').select('plan_tier').eq('id', userId).single();
        const planTier = userRecord?.plan_tier?.toLowerCase() || 'free_trial';

        const business: BusinessProfile = {
            business_name: settings?.business_name || 'our business',
            business_type: 'appointments',
            tone: settings?.tone || 'Professional',
            system_instructions: settings?.system_instructions || null,
            language: settings?.language || 'Auto',
            store_location: settings?.store_location || null,
            contact_info: settings?.contact_info || null,
            use_emojis: settings?.use_emojis ?? true,
            use_local_slang: settings?.use_local_slang ?? false,
            urgency_mode: settings?.urgency_mode ?? false,
            handoff_keywords: settings?.handoff_keywords || [],
            shipping_rules: settings?.shipping_rules || null,
        };

        // ── 2. Handoff keyword check ─────────────────────────────────────────
        if (Array.isArray(business.handoff_keywords) && business.handoff_keywords.some(
            (kw: string) => userMessage.toLowerCase().includes(kw.toLowerCase())
        )) {
            console.log('🛑 [APPOINTMENTS] Handoff Keyword Detected. Pausing AI.');
            return null;
        }

        // ── 3. Load conversation memory ──────────────────────────────────────
        let historyContext = '';
        let contextSummary: string | null = null;
        let fullHistory: any[] = [];

        if (chatId) {
            const { contextSummary: fetchedContextSummary, recentHistory, fullHistory: fetchedFullHistory } =
                await getConversationMemory(supabase, userId, chatId, workspaceId);
            contextSummary = fetchedContextSummary;
            historyContext = recentHistory;
            fullHistory = fetchedFullHistory;
        }

        if (checkoutContext) {
            historyContext += `\n[SYSTEM NOTE: The customer just attempted to book. Form content: ${checkoutContext}]`;
        }

        // ── 4. Load services & knowledge ────────────────────────────────────
        let inventoryContext = 'No services listed currently.';
        let catalogContext = '';

        let inventoryQuery = supabase.from('inventory').select('item_name, price');
        if (workspaceId) inventoryQuery = inventoryQuery.eq('workspace_id', workspaceId);
        else inventoryQuery = inventoryQuery.eq('user_id', userId).is('workspace_id', null);

        const { data: inventory } = await inventoryQuery.limit(50);
        if (inventory?.length) {
            inventoryContext = inventory.map((i: any) => `- ${i.item_name} ($${i.price})`).join('\n');
        }

        let knowledgeQuery = supabase.from('business_knowledge').select('content, file_name');
        if (workspaceId) knowledgeQuery = knowledgeQuery.eq('workspace_id', workspaceId);
        else knowledgeQuery = knowledgeQuery.eq('user_id', userId).is('workspace_id', null);

        const { data: knowledgeData } = await knowledgeQuery.maybeSingle();
        if (knowledgeData?.content) {
            try {
                catalogContext = `SERVICE CATALOG:\n${JSON.stringify(JSON.parse(knowledgeData.content), null, 2)}`;
            } catch {
                catalogContext = `SERVICE KNOWLEDGE:\n${knowledgeData.content.substring(0, 1000)}`;
            }
        }

        // ── 5. Build system prompt ───────────────────────────────────────────
        const systemPrompt = buildAppointmentsSystemPrompt({
            business,
            inventoryContext,
            catalogContext,
            historyContext,
            contextSummary,
            hasGreetedRecently: false,
        });

        // ── 6. Build conversation messages ───────────────────────────────────
        const messages: any[] = (fullHistory || [])
            .filter((h: any) => h.event_type === 'INCOMING_MESSAGE' || h.event_type === 'AI_REPLY')
            .map((h: any) => ({
                role: h.event_type === 'INCOMING_MESSAGE' ? 'user' : 'assistant',
                content: h.description.includes('"') ? h.description.split('"')[1] : h.description
            })).slice(-12);

        const cleanMessage = userMessage.replace(/\[ATTACHMENT:.*?\]/g, '').trim() || 'Hello';
        messages.push({ role: 'user', content: cleanMessage });

        // ── 7. Smart model selection ─────────────────────────────────────────
        const bookingKeywords = ['maw3ed', 'maw3ad', 'mawed', 'book', 'appointment', 'schedule', 'bde', 'badi', 'reserve'];
        const isBookingIntent = bookingKeywords.some(kw => userMessage.toLowerCase().includes(kw));
        const botWasCollectingInfo = isInBookingFlow(messages.slice(0, -1));
        const useSmartModel = isBookingIntent || botWasCollectingInfo;
        const selectedModel = useSmartModel ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';

        console.log(`🚀 [APPOINTMENTS] Model: ${selectedModel} | Booking: ${isBookingIntent} | Collecting: ${botWasCollectingInfo}`);

        // ── 8. Tool definitions ──────────────────────────────────────────────
        const toolsMapping: Record<string, any> = {};

        if (planTier !== 'free_trial') {
            toolsMapping['finalize_transaction'] = {
                description: 'Call this tool IMMEDIATELY after the customer provides their name, phone, and preferred time. Save the booking to the database.',
                parameters: z.object({
                    customer_name: z.string().optional().describe('Full name of the customer.'),
                    customer_phone: z.string().optional().describe('Phone number of the customer.'),
                    customer_email: z.string().email().optional().describe('Optional email address.'),
                    service: z.string().describe('The service or appointment type being booked.'),
                    preferred_datetime: z.string().optional().describe('The agreed date and time for the appointment.'),
                }),
                execute: async (a: any) => {
                    const name = a?.customer_name || null;
                    const phone = a?.customer_phone || null;
                    const service = a?.service || 'Unknown service';

                    console.log('📅 [APPOINTMENTS] Executing finalize_transaction:', { name, phone, service, datetime: a?.preferred_datetime });
                    try {
                        // Duplicate guard: prevent re-saving the same booking within 5 minutes
                        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
                        let recentOrdersQuery = supabase
                            .from('orders').select('id')
                            .eq('user_id', userId)
                            .eq('item_requested', service)
                            .gte('created_at', fiveMinsAgo);

                        if (chatId) recentOrdersQuery = recentOrdersQuery.eq('instagram_user_id', chatId);
                        if (workspaceId) recentOrdersQuery = recentOrdersQuery.eq('workspace_id', workspaceId);

                        const { data: recentOrders } = await recentOrdersQuery;
                        if (recentOrders && recentOrders.length > 0) {
                            return 'DUPLICATE PREVENTED. Do not save again. Confirm the booking warmly.';
                        }

                        // Try to get the instagram handle from activity log
                        let handle = 'Customer';
                        if (chatId) {
                            const { data: lastMsg } = await supabase
                                .from('activity_log').select('metadata')
                                .eq('user_id', userId)
                                .filter('metadata->>chat_id', 'eq', chatId)
                                .order('timestamp', { ascending: false })
                                .limit(1).maybeSingle();
                            if (lastMsg?.metadata?.username) handle = lastMsg.metadata.username;
                        }

                        const { error } = await supabase.from('orders').insert({
                            user_id: userId,
                            workspace_id: workspaceId || null,
                            instagram_user_id: chatId || null,
                            instagram_handle: handle,
                            status: 'Pending',
                            created_at: new Date().toISOString(),
                            customer_name: name,
                            customer_phone: phone,
                            customer_email: a?.customer_email || null,
                            item_requested: service,
                            raw_message: JSON.stringify({ preferred_datetime: a?.preferred_datetime || null }),
                        });

                        if (error) {
                            console.error('❌ [APPOINTMENTS] Supabase Insert Error:', JSON.stringify(error));
                            throw error;
                        }

                        console.log('✅ [APPOINTMENTS] Booking saved successfully!');
                        return `Booking saved for "${service}". Now reply to the customer in their language confirming the appointment is confirmed.`;
                    } catch (err: any) {
                        console.error('❌ [APPOINTMENTS] Failed to save booking:', err);
                        return 'Database error. Apologize briefly and tell the customer to message again.';
                    }
                }
            };

            if (workspaceId) {
                toolsMapping['check_calendar_availability'] = checkCalendarAvailabilityTool(workspaceId);
            }
        }

        // ── 9. First AI pass ─────────────────────────────────────────────────
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

        let result = await generateText({
            model: groq(selectedModel),
            system: systemPrompt,
            messages,
            tools: toolsMapping,
            toolChoice: 'auto',
            temperature: 0.15,
        });

        if (result.usage) {
            const { promptTokens, completionTokens, totalTokens } = result.usage as any;
            console.log(`📊 [Usage P1] Tokens: ${promptTokens}in / ${completionTokens}out — Total: ${totalTokens}`);
        }

        // ── 10. Second pass: convert tool result into a conversational reply ─
        const toolCalls = result.toolCalls || [];
        const toolResults = (result as any).toolResults || [];

        if (toolCalls.length > 0 && toolResults.length > 0) {
            console.log('[APPOINTMENTS] Tool executed. Running second pass for conversational reply...');

            const secondPassMessages: any[] = [
                ...messages,
                {
                    role: 'assistant',
                    content: toolCalls.map((tc: any) => ({
                        type: 'tool-call',
                        toolCallId: tc.toolCallId,
                        toolName: tc.toolName,
                        args: tc.args,
                    })),
                },
                {
                    role: 'tool',
                    content: toolResults.map((tr: any) => ({
                        type: 'tool-result',
                        toolCallId: tr.toolCallId,
                        toolName: tr.toolName,
                        result: tr.result,
                    })),
                },
            ];

            const secondPass = await generateText({
                model: groq('llama-3.3-70b-versatile'),
                system: systemPrompt,
                messages: secondPassMessages,
                temperature: 0.15,
            });

            if (secondPass.usage) {
                const { promptTokens, completionTokens, totalTokens } = secondPass.usage as any;
                console.log(`📊 [Usage P2] Tokens: ${promptTokens}in / ${completionTokens}out — Total: ${totalTokens}`);
            }

            if (chatId && fullHistory.length > 0) {
                trackConversationMessage(supabase, userId, chatId, workspaceId).catch(console.error);
                summarizeConversationIfNeeded(supabase, userId, chatId, fullHistory, workspaceId).catch(console.error);
            }

            return secondPass.text?.replace(/finalize_transaction/g, '').trim() || null;
        }

        // ── 11. Return direct text reply ─────────────────────────────────────
        if (chatId && fullHistory.length > 0) {
            trackConversationMessage(supabase, userId, chatId, workspaceId).catch(console.error);
            summarizeConversationIfNeeded(supabase, userId, chatId, fullHistory, workspaceId).catch(console.error);
        }

        return (result.text || '').replace(/finalize_transaction/g, '').trim() || null;

    } catch (error: any) {
        if (error?.statusCode === 429) {
            console.warn('⚠️ [APPOINTMENTS] Rate limited. Staying silent.');
            return null;
        }
        console.error('❌ [APPOINTMENTS] Fatal error:', error);
        return null;
    }
}
