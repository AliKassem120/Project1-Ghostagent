import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { BusinessProfile } from '../types';
import { getConversationMemory, summarizeConversationIfNeeded, trackConversationMessage } from '../../rolling-memory';
import { classifyAppointmentIntent, AppointmentIntent } from './intent';
import { buildAppointmentFinalReplyPrompt, buildAppointmentFinalReplyUserPrompt, cleanAppointmentReply } from './prompt';
import {
    checkAppointmentAvailability,
    finalizeAppointmentBooking,
    getBusinessHours,
    getServices,
} from './tools';
import { getAppointmentSlotDuration } from '@/lib/appointments/business-hours';

import { GHOST_AGENT_MASTER_KNOWLEDGE } from '../master-knowledge';

function cleanMessageText(message: string): string {
    return message.replace(/\[ATTACHMENT:.*?\]/g, '').trim() || 'Hello';
}

function chooseDateFromIntent(intent: AppointmentIntent): string | null {
    if (intent.date) return intent.date;
    return null;
}

async function safeTrackMemory(args: {
    supabase: any;
    userId: string;
    chatId?: string;
    workspaceId?: string;
    fullHistory: any[];
}) {
    const { supabase, userId, chatId, workspaceId, fullHistory } = args;
    if (!chatId || !fullHistory?.length) return;
    trackConversationMessage(supabase, userId, chatId, workspaceId).catch(console.error);
    summarizeConversationIfNeeded(supabase, userId, chatId, fullHistory, workspaceId).catch(console.error);
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
        let settingsQuery = supabase
            .from('ai_settings')
            .select('business_name, business_type, tone, system_instructions, urgency_mode, handoff_keywords, language, store_location, contact_info, use_emojis, use_local_slang, shipping_rules, is_autopilot_enabled');

        if (workspaceId) {
            settingsQuery = settingsQuery.eq('id', workspaceId);
        } else {
            settingsQuery = settingsQuery.eq('user_id', userId).is('id', null);
        }

        const { data: settings } = await settingsQuery.limit(1).maybeSingle();

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

        if (Array.isArray(business.handoff_keywords) && business.handoff_keywords.some(
            (kw: string) => userMessage.toLowerCase().includes(kw.toLowerCase())
        )) {
            console.log('🛑 [APPOINTMENTS] Handoff Keyword Detected. Pausing AI.');
            return null;
        }

        let historyContext = '';
        let contextSummary: string | null = null;
        let fullHistory: any[] = [];

        if (chatId) {
            const memory = await getConversationMemory(supabase, userId, chatId, workspaceId);
            contextSummary = memory.contextSummary;
            historyContext = memory.recentHistory;
            fullHistory = memory.fullHistory;
        }

        if (checkoutContext) {
            historyContext += `\n[SYSTEM NOTE: The customer just attempted to book. Form content: ${checkoutContext}]`;
        }

        const cleanMessage = cleanMessageText(userMessage);
        const intent = await classifyAppointmentIntent({
            message: cleanMessage,
            historyContext,
            contextSummary,
            businessLanguage: business.language,
        });

        if (intent.intent === 'human_handoff') return null;

        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

        const replyWithTruth = async (truth: unknown, constraints: string[] = []) => {
            const final = await generateText({
                model: groq('llama-3.3-70b-versatile'),
                system: buildAppointmentFinalReplyPrompt({ business, intent, constraints }),
                prompt: buildAppointmentFinalReplyUserPrompt({
                    customerMessage: cleanMessage,
                    intent,
                    truth,
                    contextSummary,
                    historyContext,
                }),
                temperature: 0.1,
            });

            await safeTrackMemory({ supabase, userId, chatId, workspaceId, fullHistory });
            return cleanAppointmentReply(final.text);
        };

        switch (intent.intent) {
            case 'business_hours': {
                if (!workspaceId) {
                    return replyWithTruth(
                        { error: 'I’m having trouble checking our schedule right now. Please try again in a moment.' },
                        ['Say you are having trouble checking the schedule and ask them to try again soon.']
                    );
                }
                const hours = await getBusinessHours({ supabase, userId, workspaceId, day: intent.day });
                return replyWithTruth(
                    { requested_day: intent.day, hours: hours.hours, timezone: hours.timezone, error: hours.error },
                    ['Answer opening/closing hours only based on TRUTH. Use exact hours. If closed, say closed. Do not invent.']
                );
            }

            case 'appointment_availability': {
                if (!workspaceId) {
                    return replyWithTruth(
                        { error: 'I’m having trouble checking availability right now. Please try again in a moment.' },
                        ['Say you are having trouble checking availability and ask them to try again soon.']
                    );
                }
                const date = chooseDateFromIntent(intent);
                if (!date) {
                    return replyWithTruth(
                        { needs_date: true, requested_day: intent.day, requested_time: intent.time },
                        ['Ask which specific day or date they want. Do not invent available slots.']
                    );
                }

                const services = await getServices({ supabase, userId, workspaceId, serviceName: intent.service_name, limit: 1 });
                const duration = services.services[0]?.duration_minutes || await getAppointmentSlotDuration(supabase, workspaceId);
                const availability = await checkAppointmentAvailability({ supabase, userId, workspaceId, date, durationMinutes: duration });

                return replyWithTruth(
                    { requested_date: date, requested_time: intent.time, service: services.services[0] || null, availability, slotDurationUsed: duration },
                    ['Offer only slots listed in TRUTH. If closed, say closed. If a time is requested but unavailable, say why (closed or booked) based on TRUTH.']
                );
            }

            case 'book_appointment': {
                if (!workspaceId) {
                    return replyWithTruth(
                        { error: 'I’m having trouble processing your booking right now. Please try again in a moment.' },
                        ['Say you are having trouble processing the booking and ask them to try again soon.']
                    );
                }
                const date = chooseDateFromIntent(intent);
                const result = await finalizeAppointmentBooking({
                    supabase,
                    userId,
                    workspaceId,
                    chatId,
                    customerName: intent.customer_name,
                    customerPhone: intent.customer_phone,
                    serviceName: intent.service_name,
                    date,
                    time: intent.time,
                });

                return replyWithTruth(
                    { booking_result: result },
                    ['If missing fields, ask only for missing fields. If saved, confirm with date and time. If blocked (closed/conflict), explain exactly why.']
                );
            }

            case 'service_question':
            case 'price_question':
            case 'duration_question': {
                const services = await getServices({ supabase, userId, workspaceId, serviceName: intent.service_name });
                return replyWithTruth(
                    { requested_service: intent.service_name, services: services.services, error: services.error },
                    ['Answer only from services in TRUTH. If no service is clear, ask which service they mean.']
                );
            }

            case 'location_question': {
                return replyWithTruth(
                    { location: business.store_location, contact: business.contact_info },
                    ['Answer only with provided location/contact.']
                );
            }

            case 'gratitude_goodbye': {
                return replyWithTruth(
                    { outcome: 'customer_thanked_or_closed_conversation' },
                    ['Acknowledge briefly. Do not restart booking.']
                );
            }

            default: {
                // Incorporate GOD MODE INJECTION if master account
                const { data: ownerUser } = await supabase.from('users').select('email').eq('id', userId).maybeSingle();
                let masterKnowledge = null;
                if (ownerUser?.email?.toLowerCase() === 'alisalemkassem@gmail.com') {
                    masterKnowledge = GHOST_AGENT_MASTER_KNOWLEDGE;
                }

                let knowledgeQuery = supabase.from('business_knowledge').select('content');
                if (workspaceId) knowledgeQuery = knowledgeQuery.eq('workspace_id', workspaceId);
                else knowledgeQuery = knowledgeQuery.eq('user_id', userId).is('workspace_id', null);

                const { data: knowledgeData } = await knowledgeQuery.maybeSingle();

                return replyWithTruth(
                    { 
                        custom_instructions: business.system_instructions, 
                        location: business.store_location, 
                        contact: business.contact_info,
                        business_knowledge: knowledgeData?.content || null,
                        saas_master_knowledge: masterKnowledge 
                    },
                    ['Answer only if the business context clearly contains the answer. Otherwise ask one short clarifying question.']
                );
            }
        }
    } catch (error: any) {
        if (error?.statusCode === 429) {
            console.warn('⚠️ [APPOINTMENTS] Rate limited. Staying silent.');
            return null;
        }
        console.error('❌ [APPOINTMENTS] Fatal error:', error);
        return null;
    }
}
