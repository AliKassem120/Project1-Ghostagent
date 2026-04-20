import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { z } from 'zod';
import { BusinessProfile } from '../types';
import { buildAppointmentsSystemPrompt } from './prompt';
import { getConversationMemory, summarizeConversationIfNeeded, trackConversationMessage } from '../../rolling-memory';
import { checkCalendarAvailabilityTool } from './tools';

const cleanResponseText = (str: string | null | undefined) => {
    if (!str) return null;
    return str
        .replace(/<function[^>]*>[\s\S]*?(?:<\/function>|$)/gi, '')
        .replace(/<tool_call>[\s\S]*?(?:<\/tool_call>|$)/gi, '')
        .replace(/finalize_transaction/g, '')
        .replace(/check_calendar_availability/g, '')
        .replace(/\{[^}]*\}/g, '') // Strips stranded raw JSON braces that leak
        .trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// Date/Time resolvers for appointment finalization
// ─────────────────────────────────────────────────────────────────────────────
function resolveAppointmentDate(input?: string): string {
    if (!input) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return fmtDate(d);
    }
    const lower = input.toLowerCase().trim();
    const now = new Date();

    if (lower === 'today' || lower === 'lyom' || lower === 'lyawm') return fmtDate(now);
    if (lower === 'tomorrow' || lower === 'bokra' || lower === 'bukra') {
        const d = new Date(now); d.setDate(d.getDate() + 1); return fmtDate(d);
    }

    const dayMap: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
        l7ad: 0, tnen: 1, tleta: 2, arba3a: 3, khamis: 4, '5amis': 4, jom3a: 5, jum3a: 5, sabt: 6, sebt: 6,
    };
    if (dayMap[lower] !== undefined) {
        const target = dayMap[lower];
        let diff = target - now.getDay();
        if (diff <= 0) diff += 7;
        const d = new Date(now); d.setDate(d.getDate() + diff); return fmtDate(d);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    const d = new Date(now); d.setDate(d.getDate() + 1); return fmtDate(d);
}

function resolveAppointmentTime(input?: string): string {
    if (!input) return '10:00';
    const lower = input.toLowerCase().trim();

    // Handle "3 PM", "10 AM", "3PM"
    const ampmMatch = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    if (ampmMatch) {
        let hour = parseInt(ampmMatch[1]);
        const min = ampmMatch[2] ? parseInt(ampmMatch[2]) : 0;
        if (ampmMatch[3] === 'pm' && hour !== 12) hour += 12;
        if (ampmMatch[3] === 'am' && hour === 12) hour = 0;
        return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }

    // Handle "10:00", "14:30"
    const timeMatch = lower.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) return `${String(parseInt(timeMatch[1])).padStart(2, '0')}:${timeMatch[2]}`;

    // Handle bare number "10", "3"
    const bareNum = lower.match(/^(\d{1,2})$/);
    if (bareNum) {
        const h = parseInt(bareNum[1]);
        return `${String(h > 12 ? h : h).padStart(2, '0')}:00`;
    }

    return '10:00';
}

function fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
            language: settings?.language || 'Auto-Detect',
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

        // --- NEW TIME GAP LOGIC ---
        if (chatId && fullHistory && fullHistory.length > 0) {
            // Find the last message before the current one
            const lastMsg = fullHistory[fullHistory.length - 1];
            if (lastMsg && lastMsg.timestamp) {
                const lastTime = new Date(lastMsg.timestamp).getTime();
                const now = Date.now();
                const hoursDiff = (now - lastTime) / (1000 * 60 * 60);

                if (hoursDiff > 12) {
                    historyContext += `\n[SYSTEM EVENT: ${Math.floor(hoursDiff)} hours have passed since the previous message. Treat this as a new session.]`;
                    
                    if (hoursDiff >= 24) {
                        // Check if they booked recently
                        let recentApptQ = supabase.from('appointments')
                            .select('service, appointment_date, start_time, status, created_at')
                            .eq('user_id', userId)
                            .eq('instagram_user_id', chatId)
                            .order('created_at', { ascending: false })
                            .limit(1);

                        if (workspaceId) recentApptQ = recentApptQ.eq('workspace_id', workspaceId);
                        
                        const { data: recentAppt } = await recentApptQ.maybeSingle();

                        if (recentAppt) {
                            historyContext += `\n[SYSTEM KNOWLEDGE: The customer booked "${recentAppt.service}" recently for ${recentAppt.appointment_date} at ${recentAppt.start_time}. Current booking status: ${recentAppt.status}.]`;
                        }
                    }
                }
            }
        }
        // --- END TIME GAP LOGIC ---

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

        // toolsMapping['finalize_transaction'] is available on all plans
        // toolsMapping['finalize_transaction'] is available on all plans
        const { tool } = require('ai');
        toolsMapping['finalize_transaction'] = tool({
                description: 'Save the booking to the database. REQUIRED: Name, phone, and time.',
                parameters: z.object({
                    name: z.string().optional().describe('Full name of the customer.'),
                    phone: z.string().optional().describe('Phone number.'),
                    email: z.string().email().optional().describe('Optional email address.'),
                    service: z.string().optional().describe('The service/appointment type.'),
                    date: z.string().optional().describe('Date (e.g. 2026-04-15 or "tomorrow").'),
                    time: z.string().optional().describe('Time (e.g. 10:00 or "3 PM").'),
                }),
                execute: async (a: any) => {
                    const name = a?.name || null;
                    const phone = a?.phone || null;
                    const service = a?.service || 'Unknown service';
                    const preferred_date = a?.date || null;
                    const preferred_time = a?.time || null;

                    console.log('📅 [APPOINTMENTS] Executing finalize_transaction:', { name, phone, service, date: preferred_date, time: preferred_time });
                    try {
                        // Duplicate guard
                        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
                        let recentQuery = supabase
                            .from('appointments').select('id')
                            .eq('user_id', userId)
                            .eq('service', service)
                            .gte('created_at', fiveMinsAgo);

                        if (chatId) recentQuery = recentQuery.eq('instagram_user_id', chatId);
                        if (workspaceId) recentQuery = recentQuery.eq('workspace_id', workspaceId);

                        const { data: recentAppts } = await recentQuery;
                        if (recentAppts && recentAppts.length > 0) {
                            return 'DUPLICATE PREVENTED. Do not save again. Confirm the booking warmly.';
                        }

                        // Get instagram handle
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

                        // Parse date and time
                        const resolvedDate = resolveAppointmentDate(preferred_date);
                        const resolvedTime = resolveAppointmentTime(preferred_time);

                        // Get slot duration
                        let slotDuration = 60;
                        if (workspaceId) {
                            const { data: sd } = await supabase
                                .from('ai_settings').select('slot_duration_minutes')
                                .eq('id', workspaceId).maybeSingle();
                            if (sd?.slot_duration_minutes) slotDuration = sd.slot_duration_minutes;
                        }

                        // Save to appointments table (for calendar)
                        const { error: apptError } = await supabase.from('appointments').insert({
                            user_id: userId,
                            workspace_id: workspaceId || null,
                            customer_name: name,
                            customer_phone: phone,
                            customer_email: a?.customer_email || null,
                            service: service,
                            appointment_date: resolvedDate,
                            start_time: resolvedTime,
                            duration_minutes: slotDuration,
                            status: 'confirmed',
                            instagram_user_id: chatId || null,
                            instagram_handle: handle,
                            created_at: new Date().toISOString(),
                        });

                        if (apptError) {
                            console.error('❌ [APPOINTMENTS] appointments insert error:', JSON.stringify(apptError));
                            throw apptError;
                        }

                        // Also save to orders table (for orders page)
                        await supabase.from('orders').insert({
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
                            raw_message: JSON.stringify({ preferred_date: resolvedDate, preferred_time: resolvedTime }),
                        }).then(({ error }: any) => {
                            if (error) console.warn('⚠️ [APPOINTMENTS] orders mirror insert error:', error.message);
                        });

                        console.log('✅ [APPOINTMENTS] Booking saved successfully!');
                        return `Booking saved for "${service}" on ${resolvedDate} at ${resolvedTime}. Confirm the appointment to the customer warmly.`;
                    } catch (err: any) {
                        console.error('❌ [APPOINTMENTS] Failed to save booking:', err);
                        return 'Database error. Apologize briefly and tell the customer to message again.';
                    }
                }
            };

            if (workspaceId) {
                toolsMapping['check_calendar_availability'] = checkCalendarAvailabilityTool(workspaceId);
            }

        // ── 9. First AI pass (with tool-call retry safety) ──────────────────
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

        let result: any;
        try {
            result = await generateText({
                model: groq(selectedModel),
                system: systemPrompt,
                messages,
                tools: toolsMapping,
                toolChoice: 'auto',
                temperature: 0.15,
            });
        } catch (toolErr: any) {
            const isGroqSchemaError = toolErr?.statusCode === 400 &&
                toolErr?.responseBody?.includes('tool_use_failed');

            if (isGroqSchemaError) {
                console.warn('[APPOINTMENTS] Groq rejected tool call schema. Retrying without tools...');
                result = await generateText({
                    model: groq(selectedModel),
                    system: systemPrompt,
                    messages,
                    temperature: 0.15,
                });
            } else {
                throw toolErr;
            }
        }

        if (result.usage) {
            const { promptTokens, completionTokens, totalTokens } = result.usage as any;
            console.log(`📊 [Usage P1] Tokens: ${promptTokens}in / ${completionTokens}out — Total: ${totalTokens}`);
        }

        // ── 10. Second pass: convert tool result into a conversational reply ─
        const toolCalls = result.toolCalls || [];
        const toolResults = (result as any).toolResults || [];

        if (toolCalls.length > 0 && toolResults.length > 0) {
            console.log('[APPOINTMENTS] Tool executed. Running second pass for conversational reply...');

            // Build a plain-text summary of what the tools did
            const toolSummary = toolResults.map((tr: any) => {
                const resultText = tr.result != null ? String(tr.result) : 'Action completed.';
                return `[Tool: ${tr.toolName}] Result: ${resultText}`;
            }).join('\n');

            console.log('[APPOINTMENTS] Tool summary for second pass:', toolSummary);

            // Simple, bulletproof second pass — no fragile message reconstruction
            const secondPassMessages: any[] = [
                ...messages,
                { role: 'user', content: `[SYSTEM: The following actions were just performed automatically:\n${toolSummary}\nNow reply to the customer naturally based on the tool results. Do NOT mention tools or system actions.]` },
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

            return cleanResponseText(secondPass.text) || null;
        }

        // ── 11. Return direct text reply ─────────────────────────────────────
        if (chatId && fullHistory.length > 0) {
            trackConversationMessage(supabase, userId, chatId, workspaceId).catch(console.error);
            summarizeConversationIfNeeded(supabase, userId, chatId, fullHistory, workspaceId).catch(console.error);
        }

        return cleanResponseText(result.text) || null;

    } catch (error: any) {
        if (error?.statusCode === 429) {
            console.warn('⚠️ [APPOINTMENTS] Rate limited. Staying silent.');
            return null;
        }
        console.error('❌ [APPOINTMENTS] Fatal error:', error);
        return null;
    }
}
