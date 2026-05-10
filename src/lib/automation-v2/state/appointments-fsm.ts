/**
 * ═══════════════════════════════════════════════════════════════
 * GhostAgent — Appointments State Machine
 * ═══════════════════════════════════════════════════════════════
 * Deterministic FSM for the appointments booking flow.
 * 
 * Flow: idle → awaiting_service → awaiting_date_time →
 *       awaiting_customer_details → awaiting_booking_confirmation →
 *       book_appointment → confirmed (only if DB succeeds) → idle
 *
 * The LLM does NOT decide state transitions. This code does.
 */

import type { AppointmentStateData, FSMResult, PostActionContext } from './types';
import type { WorkspaceConfig } from '../types';
import { loadActiveServices, findBestServiceMatch } from '../appointments/services';
import { loadBusinessHours, getHoursForDay } from '../appointments/hours';
import { checkAvailability } from '../appointments/availability';
import { createAppointmentV2Structured } from '../appointments/create-appointment';
import { detectYesNo, extractNameAndPhone } from '../language';
import { buildTimeContext, resolveDateFromMessage, resolveTimeFromMessage, formatTime12, minutesToTime, formatDateLabel } from '../time';
import { getKnownCustomerDetails } from '../customer-history';
import { upsertCustomer } from '../customer-store';
import { getRecentConversationMessages, extractCustomerDetailsFromRecentMessages } from '../history/recent-messages';
import { llmExtractAppointment } from '../llm-entity-extractor';
import { v2log } from '../logger';
import { SupabaseClient } from '@supabase/supabase-js';

interface FSMContext {
    supabase: SupabaseClient;
    userId: string;
    workspaceId: string;
    chatId: string;
    config: WorkspaceConfig;
    message: string;
    language: string;
    platform: 'instagram' | 'whatsapp';
}

function t(en: string, arabizi: string, lang: string): string {
    const isArabizi = lang === 'arabizi' || lang === 'lebanese franco' || lang === 'arabic' || lang === 'mixed';
    return isArabizi ? arabizi : en;
}

/**
 * Process a message through the appointments state machine.
 * Only called when there is an active (non-idle) state.
 */
export async function processAppointmentState(
    ctx: FSMContext,
    state: AppointmentStateData
): Promise<FSMResult> {
    const { supabase, workspaceId, message, language } = ctx;
    const timeCtx = buildTimeContext(ctx.config.timezone);

    // ── Handle cancellation/rejection at any stage ─────────────
    const yesNo = detectYesNo(message);
    const msgLower = message.toLowerCase().trim();
    const isCancelWord = /\b(cancel|stop|la2|la|mish|bas|khalas|خلص|لا|الغ)\b/i.test(msgLower);

    if (isCancelWord && state.stage !== 'awaiting_booking_confirmation') {
        return {
            replyText: t('No problem. Let me know if you need anything.', 'Wala yhemak. Khaberne eza bdk shi.', language),
            nextStage: 'idle',
            nextData: null,
            actions: ['cancelled_flow'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    switch (state.stage) {
        case 'awaiting_service':
            return await handleAwaitingService(ctx, state, timeCtx);

        case 'awaiting_date_time':
            return await handleAwaitingDateTime(ctx, state, timeCtx);

        case 'awaiting_customer_details':
            return await handleAwaitingCustomerDetails(ctx, state);

        case 'awaiting_booking_confirmation':
            return await handleBookingConfirmation(ctx, state, yesNo);

        default:
            // Unknown stage — reset to idle
            return {
                replyText: t('How can I help you?', 'Kif fiyi se3dak?', language),
                nextStage: 'idle',
                nextData: null,
                actions: ['unknown_stage_reset'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
    }
}

// ── Stage Handlers ───────────────────────────────────────────

async function handleAwaitingService(
    ctx: FSMContext,
    state: AppointmentStateData,
    timeCtx: any
): Promise<FSMResult> {
    const services = await loadActiveServices(ctx.supabase, ctx.workspaceId);
    let match = findBestServiceMatch(services, ctx.message);

    if (!match) {
        // ── LLM Fallback: extract service entity when deterministic matching fails ──
        if (services.length > 0) {
            const serviceNames = services.map(s => s.name);
            const llmResult = await llmExtractAppointment(ctx.message, serviceNames);

            if (llmResult && llmResult.confidence >= 0.5 && llmResult.service_candidate) {
                // Verify LLM candidate against DB (source of truth)
                const llmMatch = findBestServiceMatch(services, llmResult.service_candidate);
                if (llmMatch) {
                    v2log.info('APPT_FSM', 'LLM fallback matched service', {
                        candidate: llmResult.service_candidate,
                        matched: llmMatch.name,
                        confidence: llmResult.confidence,
                    });

                    // Service matched via LLM — check if LLM also extracted date/time
                    const dateFromLlm = llmResult.date_text ? resolveDateFromMessage(llmResult.date_text, timeCtx) : null;
                    const timeFromLlm = llmResult.time_text ? resolveTimeFromMessage(llmResult.time_text) : null;

                    // Merge LLM date/time with any deterministic extraction
                    const finalDate = resolveDateFromMessage(ctx.message, timeCtx) || dateFromLlm;
                    const finalTime = resolveTimeFromMessage(ctx.message) || timeFromLlm;

                    // Reconstruct: reuse the matched service and extracted date/time
                    // by setting match and letting the code below handle it
                    match = llmMatch;

                    if (finalDate && finalTime) {
                        // All three resolved — fast-forward to availability check
                        // (handled by the match + date + time block below)
                        // Override ctx.message temporarily for date/time resolution
                    }
                }
            }
        }

        if (!match) {
            const serviceNameList = services.map(s => s.name).join(', ');
            return {
                replyText: ctx.language === 'arabizi'
                    ? `Aya service bdk? 3anna: ${serviceNameList}`
                    : `Which service would you like? We offer: ${serviceNameList}`,
                nextStage: 'awaiting_service',
                nextData: state,
                actions: ['asked_service_again'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }
    }

    // Service found — check if date+time are also in the same message
    const date = resolveDateFromMessage(ctx.message, timeCtx);
    const time = resolveTimeFromMessage(ctx.message);

    if (date && time) {
        // All three (service + date + time) in one message!
        // Jump straight to availability check via handleAwaitingDateTime logic
        const duration = match.durationMinutes;
        const [h, m] = time.split(':').map(Number);
        const endMin = h * 60 + m + duration;
        const endTime = minutesToTime(endMin);

        const businessHours = await loadBusinessHours(ctx.supabase, ctx.workspaceId);
        const avail = await checkAvailability({
            supabase: ctx.supabase,
            workspaceId: ctx.workspaceId,
            date,
            startTime: time,
            durationMinutes: duration,
            businessHours,
        });

        if (!avail.available) {
            // Slot not available — ask for new time
            const dateLabel = formatDateLabel(date, timeCtx);
            const timeLabel = formatTime12(time);
            return {
                replyText: t(
                    `${dateLabel} at ${timeLabel} is not available. Another time?`,
                    `${dateLabel} se3a ${timeLabel} ma fi majel. Wa2t tene?`,
                    ctx.language
                ),
                nextStage: 'awaiting_date_time',
                nextData: {
                    ...state,
                    stage: 'awaiting_date_time',
                    appointment: {
                        ...state.appointment,
                        serviceId: match.id,
                        serviceName: match.name,
                        servicePrice: match.price,
                        serviceDuration: match.durationMinutes,
                        date,
                    },
                    missingFields: ['time'],
                },
                actions: ['service_resolved', 'slot_unavailable'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }

        // Slot available — check customer details
        const known = await getKnownCustomerDetails(ctx.supabase, ctx.workspaceId, ctx.chatId);
        if (known?.name && known?.phone) {
            // All info available — go to confirmation
            const dateLabel = formatDateLabel(date, timeCtx);
            const timeLabel = formatTime12(time);
            return {
                replyText: t(
                    `${match.name} on ${dateLabel} at ${timeLabel}. Confirm?`,
                    `${match.name} ${dateLabel} se3a ${timeLabel}. T2akked?`,
                    ctx.language
                ),
                nextStage: 'awaiting_booking_confirmation',
                nextData: {
                    ...state,
                    stage: 'awaiting_booking_confirmation',
                    appointment: {
                        ...state.appointment,
                        serviceId: match.id,
                        serviceName: match.name,
                        servicePrice: match.price,
                        serviceDuration: match.durationMinutes,
                        date,
                        startTime: time,
                        endTime,
                    },
                    customer: { ...state.customer, name: known.name, phone: known.phone },
                    missingFields: [],
                },
                actions: ['service_resolved', 'slot_available', 'memory_used', 'asked_confirmation'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }

        // Need customer details
        const dateLabel = formatDateLabel(date, timeCtx);
        const timeLabel = formatTime12(time);
        return {
            replyText: t(
                `${dateLabel} at ${timeLabel} is available. Send your name and phone number.`,
                `${dateLabel} se3a ${timeLabel} fi majel. B3atle ismak w ra2mak.`,
                ctx.language
            ),
            nextStage: 'awaiting_customer_details',
            nextData: {
                ...state,
                stage: 'awaiting_customer_details',
                appointment: {
                    ...state.appointment,
                    serviceId: match.id,
                    serviceName: match.name,
                    servicePrice: match.price,
                    serviceDuration: match.durationMinutes,
                    date,
                    startTime: time,
                    endTime,
                },
                missingFields: ['customerName', 'customerPhone'],
            },
            actions: ['service_resolved', 'slot_available', 'asked_customer_details'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    // Only service found, need date+time
    const updatedState: AppointmentStateData = {
        ...state,
        stage: 'awaiting_date_time',
        appointment: {
            ...state.appointment,
            serviceId: match.id,
            serviceName: match.name,
            servicePrice: match.price,
            serviceDuration: match.durationMinutes,
        },
        missingFields: ['date', 'time'],
    };

    return {
        replyText: ctx.language === 'arabizi'
            ? `${match.name} — $${match.price}. Aya yom w se3a badek?`
            : `${match.name} — $${match.price}. What day and time work for you?`,
        nextStage: 'awaiting_date_time',
        nextData: updatedState,
        actions: ['service_resolved'],
        dbWriteAttempted: false,
        dbWriteSuccess: false,
        shouldReply: true,
    };
}

async function handleAwaitingDateTime(
    ctx: FSMContext,
    state: AppointmentStateData,
    timeCtx: any
): Promise<FSMResult> {
    const date = resolveDateFromMessage(ctx.message, timeCtx);
    const time = resolveTimeFromMessage(ctx.message);

    // Merge with existing state
    const resolvedDate = date || state.appointment.date;
    const resolvedTime = time || state.appointment.startTime;

    if (!resolvedDate) {
        return {
            replyText: t('What day would you like?', 'Aya yom badek?', ctx.language),
            nextStage: 'awaiting_date_time',
            nextData: state,
            actions: ['asked_date'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    if (!resolvedTime) {
        return {
            replyText: t(`What time on ${formatDateLabel(resolvedDate, timeCtx)}?`, `Aya se3a ${formatDateLabel(resolvedDate, timeCtx)}?`, ctx.language),
            nextStage: 'awaiting_date_time',
            nextData: {
                ...state,
                appointment: { ...state.appointment, date: resolvedDate },
            },
            actions: ['asked_time'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    // Both date and time resolved — check availability
    const hours = await loadBusinessHours(ctx.supabase, ctx.workspaceId);
    const duration = state.appointment.serviceDuration || ctx.config.slotDurationMinutes;
    const avail = await checkAvailability({
        supabase: ctx.supabase,
        workspaceId: ctx.workspaceId,
        date: resolvedDate,
        startTime: resolvedTime,
        durationMinutes: duration,
        businessHours: hours,
    });

    if (!avail.available) {
        if (avail.reason === 'closed') {
            const dayLabel = new Date(`${resolvedDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
            return {
                replyText: t(`We're closed on ${dayLabel}. Pick another day?`, `Msakrin yom el ${dayLabel}. Fi yom tene?`, ctx.language),
                nextStage: 'awaiting_date_time',
                nextData: state,
                actions: ['closed_day'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }
        if (avail.reason === 'outside_hours') {
            const dow = new Date(`${resolvedDate}T12:00:00`).getDay();
            const h = getHoursForDay(hours, dow);
            const openClose = h ? `${formatTime12(h.openTime)} – ${formatTime12(h.closeTime)}` : '9 AM – 5 PM';
            return {
                replyText: t(`That's outside our hours (${openClose}). Another time?`, `Hal wa2et barra dawemna (${openClose}). Badek gheiro?`, ctx.language),
                nextStage: 'awaiting_date_time',
                nextData: state,
                actions: ['outside_hours'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }
        return {
            replyText: t('That slot is taken. Do you have another time?', 'Hal wa2et msh fadi. Fi wa2t tene?', ctx.language),
            nextStage: 'awaiting_date_time',
            nextData: state,
            actions: ['slot_taken'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    // Slot available — check if we already have customer details
    const endTime = minutesToTime(
        parseInt(resolvedTime.split(':')[0]) * 60 + parseInt(resolvedTime.split(':')[1] || '0') + duration
    );

    // Try to load known customer details
    const known = await getKnownCustomerDetails(ctx.supabase, ctx.workspaceId, ctx.chatId);
    const customerName = known?.name || state.customer.name;
    const customerPhone = known?.phone || state.customer.phone;

    if (customerName && customerPhone) {
        // All fields present — go straight to confirmation
        const updatedState: AppointmentStateData = {
            ...state,
            stage: 'awaiting_booking_confirmation',
            appointment: {
                ...state.appointment,
                date: resolvedDate,
                startTime: resolvedTime,
                endTime,
            },
            customer: { ...state.customer, name: customerName, phone: customerPhone },
            missingFields: [],
        };
        const dateLabel = formatDateLabel(resolvedDate, timeCtx);
        const timeLabel = formatTime12(resolvedTime);
        return {
            replyText: t(
                `${state.appointment.serviceName} on ${dateLabel} at ${timeLabel}. Confirm?`,
                `${state.appointment.serviceName} ${dateLabel} se3a ${timeLabel}. T2akked?`,
                ctx.language
            ),
            nextStage: 'awaiting_booking_confirmation',
            nextData: updatedState,
            actions: ['slot_available', 'memory_used', 'asked_confirmation'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    // Need customer details
    const updatedState: AppointmentStateData = {
        ...state,
        stage: 'awaiting_customer_details',
        appointment: {
            ...state.appointment,
            date: resolvedDate,
            startTime: resolvedTime,
            endTime,
        },
        missingFields: [
            ...(!customerName ? ['customerName'] : []),
            ...(!customerPhone ? ['customerPhone'] : []),
        ],
    };

    const dateLabel = formatDateLabel(resolvedDate, timeCtx);
    const timeLabel = formatTime12(resolvedTime);
    return {
        replyText: t(
            `${dateLabel} at ${timeLabel} is available. Send your name and phone number.`,
            `${dateLabel} se3a ${timeLabel} fi majel. B3atle ismak w ra2mak.`,
            ctx.language
        ),
        nextStage: 'awaiting_customer_details',
        nextData: updatedState,
        actions: ['slot_available', 'asked_customer_details'],
        dbWriteAttempted: false,
        dbWriteSuccess: false,
        shouldReply: true,
    };
}

async function handleAwaitingCustomerDetails(
    ctx: FSMContext,
    state: AppointmentStateData
): Promise<FSMResult> {
    // Try to extract name and phone from the message
    const { name, phone } = extractNameAndPhone(ctx.message);
    let extractedName = name || state.customer.name;
    let extractedPhone = phone || state.customer.phone;

    // ── "Already sent it" recovery ──────────────────────────
    const alreadySentPattern = /\b(already\s*sent|sent\s*(it|above)|check\s*above|I\s*sent\s*it|b3atton|b3attak|b3ata|same\s*info|use\s*my\s*info)\b/i;
    if (alreadySentPattern.test(ctx.message) && !name && !phone) {
        let currentStateCustomer = { ...state.customer };

        if (!currentStateCustomer.name || !currentStateCustomer.phone) {
            const recentMsgs = await getRecentConversationMessages(ctx.supabase, ctx.workspaceId, ctx.chatId);
            const extracted = await extractCustomerDetailsFromRecentMessages(recentMsgs);
            if (extracted.customerName) currentStateCustomer.name = extracted.customerName;
            if (extracted.customerPhone) currentStateCustomer.phone = extracted.customerPhone;
            state.customer = currentStateCustomer;
        }

        if (state.customer.name || state.customer.phone) {
            const missing = [];
            if (!state.customer.name) missing.push(ctx.language === 'arabizi' ? 'ismak' : 'name');
            if (!state.customer.phone) missing.push(ctx.language === 'arabizi' ? 'ra2mak' : 'phone number');

            if (missing.length > 0) {
                return {
                    replyText: t(`I have some of your info. I still need your ${missing.join(' and ')}.`, `3ande ba3do. Bado ${missing.join(' w ')}.`, ctx.language),
                    nextStage: 'awaiting_customer_details',
                    nextData: state,
                    actions: ['already_sent_partial_recovery'],
                    dbWriteAttempted: false,
                    dbWriteSuccess: false,
                    shouldReply: true,
                };
            }
            extractedName = state.customer.name || extractedName;
            extractedPhone = state.customer.phone || extractedPhone;
        } else {
            return {
                replyText: t('I couldn\'t find your info above. I need your name and phone number to book.', 'Ma l2iton abel. B3atle ismak w ra2mak la 2akked el 7ajez.', ctx.language),
                nextStage: 'awaiting_customer_details',
                nextData: state,
                actions: ['already_sent_no_data'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }
    }

    // If user just says "yes"/"ok" without providing info, repeat the ask
    const yesNo = detectYesNo(ctx.message);
    if (yesNo === 'yes' && !name && !phone) {
        return {
            replyText: t('I need your name and phone number to book.', 'B3atle ismak w ra2mak la 2akked el 7ajez.', ctx.language),
            nextStage: 'awaiting_customer_details',
            nextData: state,
            actions: ['repeated_ask_details'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    if (!extractedName || !extractedPhone) {
        const missing = [];
        if (!extractedName) missing.push(ctx.language === 'arabizi' ? 'ismak' : 'name');
        if (!extractedPhone) missing.push(ctx.language === 'arabizi' ? 'ra2mak' : 'phone number');

        // Save whatever we learned so far
        await upsertCustomer(ctx.supabase, ctx.workspaceId, ctx.chatId, ctx.platform, {
            name: extractedName || undefined,
            phone: extractedPhone || undefined,
        });

        return {
            replyText: t(`I still need your ${missing.join(' and ')}.`, `Bado ${missing.join(' w ')}.`, ctx.language),
            nextStage: 'awaiting_customer_details',
            nextData: {
                ...state,
                customer: { ...state.customer, name: extractedName, phone: extractedPhone },
            },
            actions: ['partial_details'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    // All details collected — ask for confirmation
    const timeCtx = buildTimeContext(ctx.config.timezone);
    const dateLabel = state.appointment.date ? formatDateLabel(state.appointment.date, timeCtx) : '';
    const timeLabel = state.appointment.startTime ? formatTime12(state.appointment.startTime) : '';

    const updatedState: AppointmentStateData = {
        ...state,
        stage: 'awaiting_booking_confirmation',
        customer: { ...state.customer, name: extractedName, phone: extractedPhone },
        missingFields: [],
    };

    // Save complete customer details immediately
    await upsertCustomer(ctx.supabase, ctx.workspaceId, ctx.chatId, ctx.platform, {
        name: extractedName,
        phone: extractedPhone,
    });

    return {
        replyText: t(
            `${state.appointment.serviceName} on ${dateLabel} at ${timeLabel}. Confirm?`,
            `${state.appointment.serviceName} ${dateLabel} se3a ${timeLabel}. T2akked?`,
            ctx.language
        ),
        nextStage: 'awaiting_booking_confirmation',
        nextData: updatedState,
        actions: ['details_collected', 'asked_confirmation'],
        dbWriteAttempted: false,
        dbWriteSuccess: false,
        shouldReply: true,
    };
}

async function handleBookingConfirmation(
    ctx: FSMContext,
    state: AppointmentStateData,
    yesNo: 'yes' | 'no' | null
): Promise<FSMResult> {
    if (yesNo === 'no' || /\b(cancel|la2|la|mish|no)\b/i.test(ctx.message.toLowerCase())) {
        return {
            replyText: t('No problem. Let me know if you need anything.', 'Wala yhemak. Khaberne eza bdk shi.', ctx.language),
            nextStage: 'idle',
            nextData: null,
            actions: ['booking_rejected'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    if (yesNo !== 'yes') {
        // Not a clear yes or no — ask again
        return {
            replyText: t('Would you like to confirm the booking?', 'Badek t2akked el 7ajez?', ctx.language),
            nextStage: 'awaiting_booking_confirmation',
            nextData: state,
            actions: ['asked_confirmation_again'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    // YES — pre-checks before booking
    const { appointment, customer } = state;
    if (!appointment.serviceName || !appointment.date || !appointment.startTime || !appointment.endTime || !customer.name || !customer.phone) {
        v2log.error('APPT_FSM', 'Missing fields at confirmation stage', { state });
        return {
            replyText: t('Something went wrong. Let\'s start over.', 'Fi 8alat. Yalla mn el awal.', ctx.language),
            nextStage: 'idle',
            nextData: null,
            actions: ['missing_fields_at_confirm'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    // ── DUPLICATE PROTECTION ─────────────────────────────────
    const { data: recentAppts } = await ctx.supabase
        .from('appointments')
        .select('id, created_at')
        .eq('workspace_id', ctx.workspaceId)
        .or(`chat_id.eq.${ctx.chatId},instagram_user_id.eq.${ctx.chatId}`)
        .eq('appointment_date', appointment.date)
        .eq('start_time', appointment.startTime)
        .in('status', ['confirmed', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1);

    if (recentAppts && recentAppts.length > 0) {
        const lastCreated = new Date(recentAppts[0].created_at).getTime();
        if (Date.now() - lastCreated < 60_000) {
            return {
                replyText: t('I already have this appointment.', 'Hal maw3ed mawjoud already.', ctx.language),
                nextStage: 'idle',
                nextData: null,
                actions: ['duplicate_prevented'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }
    }

    // ── RE-CHECK AVAILABILITY (prevent double-booking) ────────
    const businessHours = await loadBusinessHours(ctx.supabase, ctx.workspaceId);
    const recheck = await checkAvailability({
        supabase: ctx.supabase,
        workspaceId: ctx.workspaceId,
        date: appointment.date,
        startTime: appointment.startTime,
        durationMinutes: appointment.serviceDuration || 60,
        businessHours,
    });

    if (!recheck.available) {
        v2log.warn('APPT_FSM', 'Slot became unavailable before booking', { date: appointment.date, time: appointment.startTime });
        return {
            replyText: t(
                'Sorry, that slot just got taken. Pick another time?',
                'Sorry, hal wa2et sar msh fadi. Wa2t tene?',
                ctx.language
            ),
            nextStage: 'awaiting_date_time',
            nextData: {
                ...state,
                stage: 'awaiting_date_time',
                appointment: { ...appointment, startTime: undefined, endTime: undefined },
                missingFields: ['time'],
            },
            actions: ['slot_taken_at_confirm'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    // ── CREATE APPOINTMENT ───────────────────────────────────
    const appointmentResult = await createAppointmentV2Structured({
        supabase: ctx.supabase,
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        chatId: ctx.chatId,
        platform: ctx.platform,
        customerName: customer.name,
        customerPhone: customer.phone,
        serviceName: appointment.serviceName,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        durationMinutes: appointment.serviceDuration || 60,
        instagramHandle: customer.instagramHandle || 'Customer',
    });

    if (appointmentResult.success && appointmentResult.appointmentId) {
        const timeCtx = buildTimeContext(ctx.config.timezone);
        const dateLabel = formatDateLabel(appointment.date, timeCtx);
        const timeLabel = formatTime12(appointment.startTime);

        // Build post-action context
        const now = new Date();
        const editableUntil = new Date(
            new Date(`${appointment.date}T${appointment.startTime}`).getTime() - 2 * 60 * 60 * 1000
        ).toISOString();
        const postContext: PostActionContext = {
            type: 'appointment',
            lastAppointmentId: appointmentResult.appointmentId,
            serviceName: appointment.serviceName,
            date: appointment.date,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            customer: {
                name: customer.name!,
                phone: customer.phone!,
            },
            createdAt: now.toISOString(),
            editableUntil,
        };

        return {
            replyText: t(
                `Done! ${appointment.serviceName} confirmed for ${dateLabel} at ${timeLabel}. ✅`,
                `Tmm! ${appointment.serviceName} t2akkad ${dateLabel} se3a ${timeLabel}. ✅`,
                ctx.language
            ),
            nextStage: 'idle',
            nextData: null,
            actions: ['appointment_created'],
            dbWriteAttempted: true,
            dbWriteSuccess: true,
            shouldReply: true,
            postContext,
        };
    } else {
        return {
            replyText: t('Something went wrong. Please try again.', 'Fi 8alat. Jarreb kamen.', ctx.language),
            nextStage: 'idle',
            nextData: null,
            actions: ['appointment_failed'],
            dbWriteAttempted: true,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }
}
