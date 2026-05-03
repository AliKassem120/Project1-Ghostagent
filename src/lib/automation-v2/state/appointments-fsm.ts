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

import type { AppointmentStateData, FSMResult, ConversationStage, PostActionContext } from './types';
import type { WorkspaceConfig } from '../types';
import { loadActiveServices, findBestServiceMatch } from '../appointments/services';
import { loadBusinessHours, getHoursForDay } from '../appointments/hours';
import { checkAvailability } from '../appointments/availability';
import { createAppointmentV2 } from '../appointments/create-appointment';
import { detectYesNo, extractPhone, extractNameAndPhone } from '../language';
import { buildTimeContext, resolveDateFromMessage, resolveTimeFromMessage, formatTime12, minutesToTime, formatDateLabel } from '../time';
import { getKnownCustomerDetails } from '../customer-history';
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
    const match = findBestServiceMatch(services, ctx.message);

    if (!match) {
        const serviceNames = services.map(s => s.name).join(', ');
        return {
            replyText: ctx.language === 'arabizi'
                ? `Aya service bdk? 3anna: ${serviceNames}`
                : `Which service would you like? We offer: ${serviceNames}`,
            nextStage: 'awaiting_service',
            nextData: state,
            actions: ['asked_service_again'],
            dbWriteAttempted: false,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }

    // Service found — advance to awaiting_date_time
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
            replyText: t('That slot is taken. Do you have another time?', 'Hal maw3ed ma7jouz. Fi wa2t tene?', ctx.language),
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
    const extractedName = name || state.customer.name;
    const extractedPhone = phone || state.customer.phone;

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
        .eq('instagram_user_id', ctx.chatId)
        .eq('appointment_date', appointment.date)
        .eq('start_time', appointment.startTime)
        .in('status', ['Confirmed', 'confirmed', 'Pending'])
        .order('created_at', { ascending: false })
        .limit(1);

    if (recentAppts && recentAppts.length > 0) {
        const lastCreated = new Date(recentAppts[0].created_at).getTime();
        if (Date.now() - lastCreated < 60_000) {
            return {
                replyText: t('Your appointment was already booked! ✅', 'Maw3edak sar ma7jouz! ✅', ctx.language),
                nextStage: 'idle',
                nextData: null,
                actions: ['duplicate_prevented'],
                dbWriteAttempted: false,
                dbWriteSuccess: false,
                shouldReply: true,
            };
        }
    }

    // ── CREATE APPOINTMENT ───────────────────────────────────
    const appointmentId = await createAppointmentV2({
        supabase: ctx.supabase,
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        chatId: ctx.chatId,
        customerName: customer.name,
        customerPhone: customer.phone,
        serviceName: appointment.serviceName,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        durationMinutes: appointment.serviceDuration || 60,
        instagramHandle: customer.instagramHandle || 'Customer',
    });

    if (appointmentId) {
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
            lastAppointmentId: appointmentId,
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
            replyText: t('Something went wrong with the booking. Try again?', 'Fi 8alat bel 7ajez. Jarreb kamen?', ctx.language),
            nextStage: 'idle',
            nextData: null,
            actions: ['appointment_failed'],
            dbWriteAttempted: true,
            dbWriteSuccess: false,
            shouldReply: true,
        };
    }
}
