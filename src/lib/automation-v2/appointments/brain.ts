/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Automation Engine V2: Appointments Brain
 * ═══════════════════════════════════════════════════════════════
 * Main state machine for appointment-based businesses.
 * Follows the "State Before Classifier" rule.
 */

import { z } from 'zod';
import type { 
    AutomationInput, 
    AutomationResult, 
    WorkspaceConfig, 
    ConversationStateV2,
    DetectedLanguage
} from '../types';
import { getConversationStateV2, updateConversationStateV2, clearConversationStateV2 } from '../state';
import { loadActiveServices, findBestServiceMatch } from './services';
import { loadBusinessHours, getHoursForDay } from './hours';
import { checkAvailability } from './availability';
import { resolveDateTime } from './date-time';
import { createAppointmentV2 } from './create-appointment';
import { buildTimeContext, formatDateLabel, formatTime12, minutesToTime } from '../time';
import { detectLanguage, detectYesNo, extractNameAndPhone } from '../language';
import { APPOINTMENT_TEMPLATES, applyTemplate } from '../templates';
import { validateReply } from '../validator';
import { classifyWithLLM, translateReply } from '../model';
import { v2log } from '../logger';

// ── Intent Schema ────────────────────────────────────────────

const AppointmentIntentSchema = z.object({
    intent: z.enum([
        'greeting',
        'book_appointment',
        'business_hours',
        'service_question',
        'price_question',
        'location_question',
        'human_handoff',
        'cancel_booking',
        'gratitude',
        'unclear'
    ]),
    serviceName: z.string().nullable().optional(),
    date: z.string().nullable().optional(),
    time: z.string().nullable().optional(),
});

type AppointmentIntent = z.infer<typeof AppointmentIntentSchema>;

// ── Main Handler ─────────────────────────────────────────────

export async function handleAppointmentMessage(
    input: AutomationInput,
    config: WorkspaceConfig
): Promise<AutomationResult> {
    const { supabase, userId, workspaceId, chatId, message } = input;
    const startTime = Date.now();

    // 1. Build context
    const timeCtx = buildTimeContext(config.timezone);
    const language = detectLanguage(message);
    
    // 2. Load state
    const state = await getConversationStateV2(supabase, userId, workspaceId, chatId, 'appointments');
    const stateBefore = state.stage;

    v2log.appointment.context({ stateBefore, language, messagePreview: message.slice(0, 50) });

    let result: Partial<AutomationResult> = {
        shouldReply: true,
        actions: [],
        stateBefore,
    };

    // 3. STATE BEFORE CLASSIFIER RULE
    if (state.stage !== 'idle') {
        const processed = await processAppointmentState(input, config, state, timeCtx);
        if (processed) {
            result = { ...result, ...processed };
        }
    }

    // 4. IF STILL IDLE (no state hit or state returned null) → CLASSIFY
    if (!result.replyText) {
        const intent = await classifyAppointmentIntent(message, config);
        const processed = await processAppointmentIntent(input, config, state, intent, timeCtx);
        result = { ...result, ...processed };
    }

    // 5. POST-PROCESSING (Translation & Validation)
    const isActuallyConfirmed = result.stateAfter === 'idle' && (result.actions || []).includes('appointment_created');
    const finalReply = await finalizeReply(result.replyText!, config, language, input.message, isActuallyConfirmed);

    return {
        shouldReply: result.shouldReply ?? true,
        replyText: finalReply,
        actions: result.actions || [],
        stateBefore,
        stateAfter: result.stateAfter || state.stage,
        debug: {
            requestId: '', // Set by index.ts
            engineVersion: 'v2',
            workspaceId,
            workspaceType: 'appointments',
            chatId,
            language,
            intent: result.debug?.intent,
            dbWriteAttempted: result.debug?.dbWriteAttempted ?? false,
            dbWriteSuccess: result.debug?.dbWriteSuccess ?? false,
            durationMs: Date.now() - startTime,
        },
    };
}

// ── State Processor ──────────────────────────────────────────

async function processAppointmentState(
    input: AutomationInput,
    config: WorkspaceConfig,
    state: ConversationStateV2,
    timeCtx: any
): Promise<Partial<AutomationResult> | null> {
    const { message, supabase, userId, workspaceId, chatId } = input;

    // Global cancel/rejection check
    const isNo = detectYesNo(message) === 'no';
    if (isNo || message.toLowerCase().includes('cancel')) {
        await clearConversationStateV2(supabase, userId, workspaceId, chatId, 'appointments');
        return {
            replyText: APPOINTMENT_TEMPLATES.REJECTION_ACK,
            stateAfter: 'idle',
            actions: ['flow_cancelled'],
        };
    }

    switch (state.stage) {
        case 'awaiting_service': {
            const services = await loadActiveServices(supabase, workspaceId);
            const match = findBestServiceMatch(services, message);
            if (match) {
                const newState: ConversationStateV2 = {
                    ...state,
                    stage: 'awaiting_date_time',
                    appointment: {
                        ...state.appointment,
                        workspaceId,
                        serviceId: match.id,
                        serviceName: match.name,
                        servicePrice: match.price,
                        serviceDuration: match.durationMinutes,
                    }
                };
                await updateConversationStateV2(supabase, userId, workspaceId, chatId, 'appointments', newState);
                return {
                    replyText: APPOINTMENT_TEMPLATES.ASK_DATE_TIME,
                    stateAfter: 'awaiting_date_time',
                    actions: ['service_resolved'],
                };
            }
            return {
                replyText: APPOINTMENT_TEMPLATES.ASK_SERVICE,
                stateAfter: 'awaiting_service',
            };
        }

        case 'awaiting_date_time': {
            const { date, time } = resolveDateTime(message, config.timezone, state.appointment?.date, state.appointment?.startTime);
            
            if (date && time) {
                const hours = await loadBusinessHours(supabase, workspaceId);
                const avail = await checkAvailability({
                    supabase,
                    workspaceId,
                    date,
                    startTime: time,
                    durationMinutes: state.appointment?.serviceDuration || config.slotDurationMinutes,
                    businessHours: hours,
                });

                if (avail.available) {
                    const newState: ConversationStateV2 = {
                        ...state,
                        stage: 'awaiting_customer_details',
                        appointment: {
                            ...state.appointment,
                            workspaceId,
                            date,
                            startTime: time,
                        }
                    };
                    await updateConversationStateV2(supabase, userId, workspaceId, chatId, 'appointments', newState);
                    return {
                        replyText: applyTemplate(APPOINTMENT_TEMPLATES.SLOT_AVAILABLE_NEED_DETAILS, {
                            dateLabel: formatDateLabel(date, timeCtx),
                            timeLabel: formatTime12(time)
                        }),
                        stateAfter: 'awaiting_customer_details',
                        actions: ['slot_resolved'],
                    };
                } else {
                    if (avail.reason === 'closed') {
                        const dayLabel = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
                        return {
                            replyText: applyTemplate(APPOINTMENT_TEMPLATES.CLOSED_DAY, { dayLabel }),
                            stateAfter: 'awaiting_date_time',
                        };
                    }
                    if (avail.reason === 'outside_hours') {
                        const dow = new Date(`${date}T12:00:00`).getDay();
                        const h = getHoursForDay(hours, dow);
                        return {
                            replyText: applyTemplate(APPOINTMENT_TEMPLATES.OUTSIDE_HOURS, {
                                openTime: h ? formatTime12(h.openTime) : '9 AM',
                                closeTime: h ? formatTime12(h.closeTime) : '5 PM'
                            }),
                            stateAfter: 'awaiting_date_time',
                        };
                    }
                    return {
                        replyText: "That slot is already taken. Do you have another time in mind?",
                        stateAfter: 'awaiting_date_time',
                    };
                }
            }
            return {
                replyText: APPOINTMENT_TEMPLATES.ASK_DATE_TIME,
                stateAfter: 'awaiting_date_time',
            };
        }

        case 'awaiting_customer_details': {
            const { name, phone } = extractNameAndPhone(message);
            const customerName = name || state.customer?.name;
            const customerPhone = phone || state.customer?.phone;

            if (customerName && customerPhone) {
                const newState: ConversationStateV2 = {
                    ...state,
                    stage: 'awaiting_booking_confirmation',
                    customer: {
                        name: customerName,
                        phone: customerPhone,
                    }
                };
                await updateConversationStateV2(supabase, userId, workspaceId, chatId, 'appointments', newState);
                return {
                    replyText: `Got it: ${customerName} (${customerPhone}). Should I go ahead and book this for you?`,
                    stateAfter: 'awaiting_booking_confirmation',
                    actions: ['details_resolved'],
                };
            }
            return {
                replyText: APPOINTMENT_TEMPLATES.NEED_NAME_PHONE,
                stateAfter: 'awaiting_customer_details',
            };
        }

        case 'awaiting_booking_confirmation': {
            const isYes = detectYesNo(message) === 'yes';
            if (isYes) {
                // 1. Determine instagram_handle
                let handle = 'Customer';
                try {
                    const { data: lastMsg } = await supabase
                        .from('activity_log')
                        .select('metadata')
                        .eq('user_id', userId)
                        .filter('metadata->>chat_id', 'eq', chatId)
                        .order('timestamp', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    if (lastMsg?.metadata?.username) handle = lastMsg.metadata.username;
                } catch (e) {
                    v2log.warn('V2_APPOINTMENTS_BRAIN', 'Failed to fetch handle for insert', { error: e });
                }

                const startTimeParts = state.appointment?.startTime?.split(':').map(Number) || [0, 0];
                const startTimeMin = startTimeParts[0] * 60 + startTimeParts[1];
                const endTime = minutesToTime(startTimeMin + (state.appointment?.serviceDuration || config.slotDurationMinutes));

                // 2. Insert into DB
                const success = await createAppointmentV2({
                    supabase,
                    userId,
                    workspaceId,
                    chatId,
                    customerName: state.customer?.name!,
                    customerPhone: state.customer?.phone!,
                    serviceName: state.appointment?.serviceName!,
                    date: state.appointment?.date!,
                    startTime: state.appointment?.startTime!,
                    endTime,
                    durationMinutes: state.appointment?.serviceDuration || config.slotDurationMinutes,
                    instagramHandle: handle
                });

                if (success) {
                    await clearConversationStateV2(supabase, userId, workspaceId, chatId, 'appointments');
                    return {
                        replyText: applyTemplate(APPOINTMENT_TEMPLATES.CONFIRMED, {
                            serviceName: state.appointment?.serviceName || 'appointment',
                            dateLabel: formatDateLabel(state.appointment?.date!, timeCtx),
                            timeLabel: formatTime12(state.appointment?.startTime!)
                        }),
                        stateAfter: 'idle',
                        actions: ['appointment_created'],
                        debug: { dbWriteAttempted: true, dbWriteSuccess: true } as any
                    };
                } else {
                    return {
                        replyText: APPOINTMENT_TEMPLATES.BOOKING_ERROR,
                        stateAfter: 'idle',
                        actions: ['appointment_failed'],
                        debug: { dbWriteAttempted: true, dbWriteSuccess: false } as any
                    };
                }
            }
            return {
                replyText: "Should I go ahead and book that for you?",
                stateAfter: 'awaiting_booking_confirmation',
            };
        }
    }

    return null;
}

// ── Intent Processor ─────────────────────────────────────────

async function processAppointmentIntent(
    input: AutomationInput,
    config: WorkspaceConfig,
    state: ConversationStateV2,
    intent: AppointmentIntent,
    timeCtx: any
): Promise<Partial<AutomationResult>> {
    const { supabase, userId, workspaceId, chatId, message } = input;

    switch (intent.intent) {
        case 'greeting':
            return { replyText: APPOINTMENT_TEMPLATES.GREETING, stateAfter: 'idle', debug: { intent: 'greeting' } as any };

        case 'book_appointment': {
            // Check if we can start a flow
            const services = await loadActiveServices(supabase, workspaceId);
            const serviceMatch = intent.serviceName ? findBestServiceMatch(services, intent.serviceName) : null;
            const { date, time } = resolveDateTime(message, config.timezone, intent.date, intent.time);

            const newState: ConversationStateV2 = {
                stage: 'awaiting_service',
                appointment: {
                    workspaceId,
                    serviceId: serviceMatch?.id,
                    serviceName: serviceMatch?.name,
                    servicePrice: serviceMatch?.price,
                    serviceDuration: serviceMatch?.durationMinutes,
                    date: date || undefined,
                    startTime: time || undefined,
                }
            };

            if (!serviceMatch) {
                await updateConversationStateV2(supabase, userId, workspaceId, chatId, 'appointments', newState);
                return { replyText: APPOINTMENT_TEMPLATES.ASK_SERVICE, stateAfter: 'awaiting_service', actions: ['flow_started'], debug: { intent: 'book_appointment' } as any };
            }

            newState.stage = 'awaiting_date_time';
            if (!date || !time) {
                await updateConversationStateV2(supabase, userId, workspaceId, chatId, 'appointments', newState);
                return { replyText: APPOINTMENT_TEMPLATES.ASK_DATE_TIME, stateAfter: 'awaiting_date_time', actions: ['flow_started'], debug: { intent: 'book_appointment' } as any };
            }

            // Both resolved → check availability
            const hours = await loadBusinessHours(supabase, workspaceId);
            const avail = await checkAvailability({
                supabase,
                workspaceId,
                date,
                startTime: time,
                durationMinutes: serviceMatch.durationMinutes,
                businessHours: hours,
            });

            if (avail.available) {
                newState.stage = 'awaiting_customer_details';
                await updateConversationStateV2(supabase, userId, workspaceId, chatId, 'appointments', newState);
                return {
                    replyText: applyTemplate(APPOINTMENT_TEMPLATES.SLOT_AVAILABLE_NEED_DETAILS, {
                        dateLabel: formatDateLabel(date, timeCtx),
                        timeLabel: formatTime12(time)
                    }),
                    stateAfter: 'awaiting_customer_details',
                    actions: ['flow_started', 'slot_resolved'],
                    debug: { intent: 'book_appointment' } as any
                };
            } else {
                await updateConversationStateV2(supabase, userId, workspaceId, chatId, 'appointments', newState);
                return {
                    replyText: "That slot is taken. What other time works for you?",
                    stateAfter: 'awaiting_date_time',
                    actions: ['flow_started'],
                    debug: { intent: 'book_appointment' } as any
                };
            }
        }

        case 'service_question': {
            const services = await loadActiveServices(supabase, workspaceId);
            const serviceList = services.map(s => s.name).join(', ');
            return {
                replyText: applyTemplate(APPOINTMENT_TEMPLATES.SERVICE_LIST, { serviceList }),
                stateAfter: 'idle',
                debug: { intent: 'service_question' } as any
            };
        }

        case 'price_question': {
            const services = await loadActiveServices(supabase, workspaceId);
            const match = findBestServiceMatch(services, intent.serviceName || '');
            if (match) {
                return {
                    replyText: applyTemplate(APPOINTMENT_TEMPLATES.SERVICE_PRICE, { serviceName: match.name, price: `$${match.price}` }),
                    stateAfter: 'idle',
                    debug: { intent: 'price_question' } as any
                };
            }
            return { replyText: "Which service are you asking about?", stateAfter: 'idle', debug: { intent: 'price_question' } as any };
        }

        case 'business_hours': {
            const hours = await loadBusinessHours(supabase, workspaceId);
            const summary = hours
                .filter(h => h.isOpen)
                .map(h => `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][h.dayOfWeek]}: ${formatTime12(h.openTime)} - ${formatTime12(h.closeTime)}`)
                .join(', ');
            return {
                replyText: applyTemplate(APPOINTMENT_TEMPLATES.BUSINESS_HOURS, { hoursSummary: summary }),
                stateAfter: 'idle',
                debug: { intent: 'business_hours' } as any
            };
        }

        case 'location_question':
            return {
                replyText: applyTemplate(APPOINTMENT_TEMPLATES.LOCATION, { location: config.storeLocation || 'our shop' }),
                stateAfter: 'idle',
                debug: { intent: 'location_question' } as any
            };

        case 'human_handoff':
            return { shouldReply: false, stateAfter: 'handoff', actions: ['handoff'], debug: { intent: 'human_handoff' } as any };

        case 'gratitude':
            return { replyText: APPOINTMENT_TEMPLATES.GRATITUDE, stateAfter: 'idle', debug: { intent: 'gratitude' } as any };

        default:
            return { replyText: APPOINTMENT_TEMPLATES.UNCLEAR, stateAfter: 'idle', debug: { intent: 'unclear' } as any };
    }
}

// ── Classifier ───────────────────────────────────────────────

async function classifyAppointmentIntent(
    message: string,
    config: WorkspaceConfig
): Promise<AppointmentIntent> {
    const systemPrompt = `You are an AI assistant for "${config.businessName}", a service-based business.
Classify the user's intent and extract any relevant fields.

Intents:
- greeting: Simple hello/hi
- book_appointment: User wants to schedule or book a service
- business_hours: User asking when the business is open
- service_question: User asking what services are offered
- price_question: User asking about costs/prices
- location_question: User asking where the business is
- human_handoff: User asking for a person/manager
- cancel_booking: User wants to cancel their current booking attempt
- gratitude: User saying thank you
- unclear: None of the above

Extract:
- serviceName: if mentioned (e.g. "haircut")
- date: if mentioned (e.g. "tomorrow", "monday")
- time: if mentioned (e.g. "11am", "4:30")`;

    const userPrompt = `Message: "${message}"`;

    const result = await classifyWithLLM({
        systemPrompt,
        userPrompt,
        schema: AppointmentIntentSchema,
    });

    return result || { intent: 'unclear' };
}

// ── Finalizer ────────────────────────────────────────────────

async function finalizeReply(
    reply: string,
    config: WorkspaceConfig,
    detectedLang: DetectedLanguage,
    customerMsg: string,
    isConfirmed: boolean
): Promise<string> {
    // 1. Translation / Polish
    // Use dashboard setting if fixed, otherwise auto-detect
    const targetLang = config.language === 'Auto-Detect' ? detectedLang : config.language;
    let final = await translateReply({
        reply,
        targetLanguage: targetLang,
        tone: config.tone,
    });

    // 2. Validation
    const validation = validateReply(final, {
        isConfirmed,
        customerMessage: customerMsg,
    });

    if (!validation.isValid) {
        v2log.warn('V2_APPOINTMENTS_BRAIN', `Validation failed: ${validation.reason}. Falling back to original.`, { reply: final });
        // Try to validate original if translation failed validation
        const origValidation = validateReply(reply, { isConfirmed, customerMessage: customerMsg });
        return origValidation.isValid ? reply : "I'm sorry, I can't process that right now.";
    }

    return final;
}
