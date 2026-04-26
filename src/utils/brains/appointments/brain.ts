import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { BusinessProfile } from '../types';
import { getConversationMemory, summarizeConversationIfNeeded, trackConversationMessage } from '../../rolling-memory';
import { classifyAppointmentIntent, AppointmentIntent } from './intent';
import { buildAppointmentFinalReplyPrompt, buildAppointmentFinalReplyUserPrompt, cleanAppointmentReply } from './prompt';
import {
    checkAppointmentAvailability,
    getBusinessHours,
    getServices,
} from './tools';
import { getAppointmentSlotDuration, getWorkspaceTimezone } from '@/lib/appointments/business-hours';
import { createAppointmentBooking } from '@/lib/appointments/create-appointment';
import { 
    getConversationState, 
    updateConversationState, 
    clearConversationState, 
    ConversationState 
} from '@/lib/appointments/conversation-state';

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
        if (!workspaceId) {
            console.error('❌ [APPOINTMENTS] No workspaceId provided.');
            return null;
        }

        const { data: settings } = await supabase
            .from('ai_settings')
            .select('*')
            .eq('id', workspaceId)
            .maybeSingle();

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

        const cleanMessage = cleanMessageText(userMessage);
        const intent = await classifyAppointmentIntent({
            message: cleanMessage,
            historyContext,
            contextSummary,
            businessLanguage: business.language,
        });

        if (intent.intent === 'human_handoff') return null;

        // Load Conversation State
        let state: ConversationState = { stage: 'idle', data: {} };
        if (chatId) {
            state = await getConversationState(supabase, userId, workspaceId, chatId);
        }

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

            if (chatId) await safeTrackMemory({ supabase, userId, chatId, workspaceId, fullHistory });
            return cleanAppointmentReply(final.text);
        };

        // HANDLE CONFIRMATION FLOW
        if (intent.intent === 'confirmation' && state.stage === 'awaiting_booking_confirmation' && state.data.date && state.data.startTime) {
            const booking = await createAppointmentBooking({
                supabase,
                userId,
                workspaceId,
                chatId: chatId!,
                serviceId: state.data.serviceId,
                serviceName: state.data.serviceName || 'Service',
                customerName: state.data.customerName || intent.customer_name || 'Customer',
                customerPhone: state.data.customerPhone || intent.customer_phone || '',
                date: state.data.date,
                startTime: state.data.startTime,
                timezone: state.data.timezone || 'Asia/Beirut',
                source: 'automation'
            });

            if (booking) {
                await clearConversationState(supabase, userId, workspaceId, chatId!);
                return replyWithTruth({ booking_success: true, booking }, [
                    `Confirm that the appointment is set for ${booking.appointment_date} at ${booking.start_time}.`
                ]);
            } else {
                return replyWithTruth({ booking_failed: true }, [
                    "Say you are having trouble confirming the appointment right now and ask them to try again."
                ]);
            }
        }

        switch (intent.intent) {
            case 'business_hours': {
                const hours = await getBusinessHours({ supabase, userId, workspaceId, day: intent.day });
                return replyWithTruth(
                    { requested_day: intent.day, hours: hours.hours, timezone: hours.timezone, error: hours.error },
                    ['Answer opening/closing hours only based on TRUTH.']
                );
            }

            case 'appointment_availability': {
                const date = chooseDateFromIntent(intent);
                if (!date) {
                    return replyWithTruth({ needs_date: true }, ['Ask which specific day or date they want.']);
                }

                const services = await getServices({ supabase, userId, workspaceId, serviceName: intent.service_name, limit: 1 });
                const duration = services.services[0]?.duration_minutes || await getAppointmentSlotDuration(supabase, workspaceId);
                const availability = await checkAppointmentAvailability({ supabase, userId, workspaceId, date, durationMinutes: duration });

                return replyWithTruth(
                    { requested_date: date, requested_time: intent.time, service: services.services[0] || null, availability },
                    ['Offer only slots listed in TRUTH. If closed, say closed.']
                );
            }

            case 'book_appointment': {
                const date = chooseDateFromIntent(intent);
                const time = intent.time;
                if (!date || !time) {
                    return replyWithTruth({ needs_date_or_time: true }, ['Ask for the date and time they want to book.']);
                }

                const services = await getServices({ supabase, userId, workspaceId, serviceName: intent.service_name, limit: 1 });
                const service = services.services[0];
                const timezone = await getWorkspaceTimezone(supabase, workspaceId);

                // Check for missing customer details
                const customerName = intent.customer_name || state.data.customerName;
                const customerPhone = intent.customer_phone || state.data.customerPhone;

                const pendingData = {
                    workspaceId,
                    serviceId: service?.id,
                    serviceName: service?.name || intent.service_name || 'Service',
                    date,
                    startTime: time,
                    customerName,
                    customerPhone,
                    timezone
                };

                if (!customerName || !customerPhone) {
                    await updateConversationState(supabase, userId, workspaceId, chatId!, {
                        stage: 'collecting_customer_details',
                        data: pendingData
                    });
                    return replyWithTruth({ missing_details: true, pendingData }, [
                        "Tell them you can book that slot, but you need their name and phone number first."
                    ]);
                }

                await updateConversationState(supabase, userId, workspaceId, chatId!, {
                    stage: 'awaiting_booking_confirmation',
                    data: pendingData
                });

                return replyWithTruth({ awaiting_confirmation: true, pendingData }, [
                    `Ask if they want to confirm the booking for ${date} at ${time}.`
                ]);
            }

            case 'service_question':
            case 'price_question':
            case 'duration_question': {
                const services = await getServices({ supabase, userId, workspaceId, serviceName: intent.service_name });
                return replyWithTruth({ requested_service: intent.service_name, services: services.services });
            }

            default: {
                // God Mode & Knowledge injection...
                let knowledgeQuery = supabase.from('business_knowledge').select('content').eq('workspace_id', workspaceId);
                const { data: knowledgeData } = await knowledgeQuery.maybeSingle();

                return replyWithTruth({ 
                    custom_instructions: business.system_instructions, 
                    location: business.store_location, 
                    business_knowledge: knowledgeData?.content || null
                });
            }
        }
    } catch (error: any) {
        console.error('❌ [APPOINTMENTS] Fatal error:', error);
        return null;
    }
}
