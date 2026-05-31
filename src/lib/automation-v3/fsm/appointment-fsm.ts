import { SupabaseClient } from '@supabase/supabase-js';
import type { SessionContext } from '../session-manager';
import type { WorkspaceConfig } from '@/lib/ai/types';
import { getTemplate } from '../templates';
import { detectLanguageScript, detectYesNo, extractNameAndPhone, detectReuseSignals } from '@/lib/ai/language';
import { buildTimeContext, resolveDateFromMessage, resolveTimeFromMessage, formatDateLabel } from '@/lib/ai/time';
import { loadActiveServices, findBestServiceMatch } from '@/lib/ai/appointments/services';
import { createAppointmentTools } from '@/lib/ai/tools';

export interface FSMResult {
  replyText: string;
  nextState: string;
  actions: string[];
  dbWriteAttempted: boolean;
  dbWriteSuccess: boolean;
}

export async function runAppointmentFSM(
  message: string,
  session: SessionContext,
  config: WorkspaceConfig,
  supabase: SupabaseClient
): Promise<FSMResult> {
  const actions: string[] = [];
  let dbWriteAttempted = false;
  let dbWriteSuccess = false;

  const langScript = detectLanguageScript(message);
  const timeCtx = buildTimeContext(config.timezone);

  if (!session.data) {
    session.data = {};
  }

  const currentState = session.state;
  let nextState = currentState;

  // Resolve tools context
  const toolCtx = {
    supabase,
    userId: session.userId,
    workspaceId: session.workspaceId,
    chatId: session.chatId,
    config,
    platform: session.platform,
  };
  const tools = createAppointmentTools(toolCtx);

  // Helper to load known customer details
  const getKnownDetails = async () => {
    const known = await tools.lookup_customer.execute({});
    return known.found ? known : null;
  };

  // Helper to resolve customer name/phone
  const resolveDetails = async (msg: string) => {
    const reuse = detectReuseSignals(msg);
    const known = await getKnownDetails();
    const extracted = extractNameAndPhone(msg);

    const name = extracted.name || 
                 (reuse.reuseName && known?.name ? known.name : null) || 
                 session.data?.name || 
                 session.customerProfile?.name || 
                 null;

    const phone = extracted.phone || 
                  (reuse.reusePhone && known?.phone ? known.phone : null) || 
                  session.data?.phone || 
                  session.customerProfile?.phone || 
                  null;

    return { name, phone };
  };

  // Helper to check if name/phone are both present
  const hasDetails = (d: { name: any; phone: any }) => {
    return !!(d.name && d.phone);
  };

  // 1. Handle post-appointment modifications
  if (currentState === 'post_appointment_modify') {
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes('cancel') || lowerMsg.includes('el8e') || lowerMsg.includes('la8e') || lowerMsg.includes('mesh badda')) {
      dbWriteAttempted = true;
      actions.push('tool_cancel_appointment');
      const cancelRes = await tools.cancel_appointment.execute();
      if (cancelRes.success) {
        dbWriteSuccess = true;
        actions.push('cancel_appointment_success');
        nextState = 'idle';
        return {
          replyText: langScript === 'franco' || langScript === 'mixed'
            ? 'Tmm, l maw3ed tghalgha. ✅'
            : 'Your appointment has been successfully cancelled. ✅',
          nextState,
          actions,
          dbWriteAttempted,
          dbWriteSuccess
        };
      } else {
        actions.push('cancel_appointment_failed');
        return {
          replyText: langScript === 'franco' || langScript === 'mixed'
            ? 'Ma 2darna nelghe l maw3ed. L team ra7 ykellmak halla2.'
            : 'We could not cancel your appointment automatically. A team member will assist you shortly.',
          nextState: 'handoff',
          actions: [...actions, 'handoff'],
          dbWriteAttempted,
          dbWriteSuccess
        };
      }
    }

    // Try rescheduling
    const date = resolveDateFromMessage(message, timeCtx);
    const time = resolveTimeFromMessage(message);
    if (date && time) {
      dbWriteAttempted = true;
      actions.push('tool_reschedule_appointment');
      const reschedRes = await tools.reschedule_appointment.execute({ date, time });
      if (reschedRes.success) {
        dbWriteSuccess = true;
        actions.push('reschedule_appointment_success');
        nextState = 'idle';
        const dateLabel = formatDateLabel(date, timeCtx);
        const reply = langScript === 'franco' || langScript === 'mixed'
          ? `Maw3adak tghayyar la ${dateLabel} se3a ${reschedRes.new_time}. ✅`
          : `Your appointment has been rescheduled to ${dateLabel} at ${reschedRes.new_time}. ✅`;
        return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
      } else {
        actions.push('reschedule_appointment_failed');
        return {
          replyText: langScript === 'franco' || langScript === 'mixed'
            ? `Hal wa2et mesh fadi (${reschedRes.error || 'overlap'}). N2e nhar aw se3a tanye.`
            : `That slot is unavailable (${reschedRes.error || 'overlap'}). Please choose a different date or time.`,
          nextState,
          actions,
          dbWriteAttempted,
          dbWriteSuccess
        };
      }
    }
  }

  // 2. Handle booking confirmation state
  if (currentState === 'awaiting_booking_confirmation') {
    const yesNo = detectYesNo(message);
    if (yesNo === 'yes') {
      const { service, date, time, name, phone } = session.data;
      if (!service || !date || !time || !name || !phone) {
        // Recover and prompt
        const details = await resolveDetails(message);
        session.data = { ...session.data, ...details };
        if (hasDetails(session.data)) {
          nextState = 'awaiting_booking_confirmation';
          const reply = langScript === 'franco' || langScript === 'mixed'
            ? `Ready ta ne7joz l ${service} nhar l ${formatDateLabel(date, timeCtx)} se3a ${time}? (Eh / La)`
            : `Ready to book your ${service} on ${formatDateLabel(date, timeCtx)} at ${time}? (Yes / No)`;
          return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
        } else {
          nextState = 'awaiting_customer_details';
          const reply = langScript === 'franco' || langScript === 'mixed'
            ? `B3atle ismak w ra2mak ta e7joz l ${service}.`
            : `Please provide your name and phone number to book the ${service}.`;
          return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
        }
      }

      dbWriteAttempted = true;
      actions.push('tool_book_appointment');
      const bookRes = await tools.book_appointment.execute({
        name,
        phone,
        service,
        date,
        time,
      });

      if (bookRes.success) {
        dbWriteSuccess = true;
        actions.push('book_appointment_success');
        nextState = 'idle';
        session.data = {};
        const reply = getTemplate('booking_confirmed', langScript, { date: formatDateLabel(date, timeCtx), time: bookRes.time }) || 
                      `Appointment booked successfully! ✅ See you ${formatDateLabel(date, timeCtx)} at ${bookRes.time}`;
        return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
      } else {
        actions.push('book_appointment_failed');
        return {
          replyText: langScript === 'franco' || langScript === 'mixed'
            ? 'Moshkle bl 7ajes. L team ra7 ykellmak halla2.'
            : 'There was an issue completing your booking. A team member will assist you shortly.',
          nextState: 'handoff',
          actions: [...actions, 'handoff'],
          dbWriteAttempted,
          dbWriteSuccess
        };
      }
    } else if (yesNo === 'no') {
      nextState = 'idle';
      session.data = {};
      return {
        replyText: langScript === 'franco' || langScript === 'mixed'
          ? 'Tmm, lghayna l 7ajes. Nshalla marra tanye! 👍'
          : 'Understood, the booking has been cancelled. Let us know if you need anything else! 👍',
        nextState,
        actions,
        dbWriteAttempted,
        dbWriteSuccess
      };
    } else {
      const reply = langScript === 'franco' || langScript === 'mixed'
        ? `Ready ta ne7joz l ${session.data.service}? Say Eh or La.`
        : `Ready to book your ${session.data.service}? Say Yes or No.`;
      return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
    }
  }

  // 3. Handle customer details state
  if (currentState === 'awaiting_customer_details') {
    const details = await resolveDetails(message);
    session.data = { ...session.data, ...details };

    if (hasDetails(session.data)) {
      nextState = 'awaiting_booking_confirmation';
      const reply = langScript === 'franco' || langScript === 'mixed'
        ? `Ready ta ne7joz l ${session.data.service} nhar l ${formatDateLabel(session.data.date, timeCtx)} se3a ${session.data.time}? (Eh / La)`
        : `Ready to book your ${session.data.service} on ${formatDateLabel(session.data.date, timeCtx)} at ${session.data.time}? (Yes / No)`;
      return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
    } else {
      const missing: string[] = [];
      if (!session.data.name) missing.push(langScript === 'franco' || langScript === 'mixed' ? 'ismak (name)' : 'name');
      if (!session.data.phone) missing.push(langScript === 'franco' || langScript === 'mixed' ? 'ra2mak (phone)' : 'phone');
      
      const reply = langScript === 'franco' || langScript === 'mixed'
        ? `B3atle kman: ${missing.join(', ')}.`
        : `Please provide your: ${missing.join(', ')}.`;
      return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
    }
  }

  // 4. Handle date/time state
  if (currentState === 'awaiting_date_time') {
    const date = resolveDateFromMessage(message, timeCtx) || session.data.date;
    const time = resolveTimeFromMessage(message) || session.data.time;

    if (date && time) {
      session.data.date = date;
      session.data.time = time;
      
      actions.push('tool_check_slot');
      const checkRes = await tools.check_slot.execute({
        date,
        time,
        service: session.data.service,
      });

      if (checkRes.available) {
        const details = await resolveDetails(message);
        session.data = { ...session.data, ...details };

        if (hasDetails(session.data)) {
          nextState = 'awaiting_booking_confirmation';
          const reply = langScript === 'franco' || langScript === 'mixed'
            ? `Ready ta ne7joz l ${session.data.service} nhar l ${formatDateLabel(date, timeCtx)} se3a ${time}? (Eh / La)`
            : `Ready to book your ${session.data.service} on ${formatDateLabel(date, timeCtx)} at ${time}? (Yes / No)`;
          return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
        } else {
          nextState = 'awaiting_customer_details';
          const reply = langScript === 'franco' || langScript === 'mixed'
            ? `L slot fadi! ✅ B3atle ismak w ra2mak ta e7jiz.`
            : `That slot is available! ✅ Please provide your name and phone number to finalize booking.`;
          return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
        }
      } else {
        const reply = langScript === 'franco' || langScript === 'mixed'
          ? `L slot mesh fadi (${checkRes.message || 'taken'}). N2e se3a aw nhar tanye.`
          : `That slot is unavailable (${checkRes.message || 'taken'}). Please choose a different date or time.`;
        return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
      }
    } else {
      const reply = langScript === 'franco' || langScript === 'mixed'
        ? `N2e nhar w se3a ta ne7joz l ${session.data.service}.`
        : `Which date and time would you like for your ${session.data.service}?`;
      return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
    }
  }

  // 5. Handle service state (or starting flow from idle)
  const services = await loadActiveServices(supabase, session.workspaceId);
  const match = findBestServiceMatch(services, message);

  if (match) {
    session.data.service = match.name;
    session.data.price = match.price;
    session.data.duration = match.durationMinutes;

    const date = resolveDateFromMessage(message, timeCtx);
    const time = resolveTimeFromMessage(message);

    if (date && time) {
      session.data.date = date;
      session.data.time = time;
      
      actions.push('tool_check_slot');
      const checkRes = await tools.check_slot.execute({ date, time, service: match.name });
      if (checkRes.available) {
        const details = await resolveDetails(message);
        session.data = { ...session.data, ...details };

        if (hasDetails(session.data)) {
          nextState = 'awaiting_booking_confirmation';
          const reply = langScript === 'franco' || langScript === 'mixed'
            ? `Ready ta ne7joz l ${match.name} nhar l ${formatDateLabel(date, timeCtx)} se3a ${time}? (Eh / La)`
            : `Ready to book your ${match.name} on ${formatDateLabel(date, timeCtx)} at ${time}? (Yes / No)`;
          return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
        } else {
          nextState = 'awaiting_customer_details';
          const reply = langScript === 'franco' || langScript === 'mixed'
            ? `L slot fadi! ✅ B3atle ismak w ra2mak ta e7jiz.`
            : `That slot is available! ✅ Please provide your name and phone number to finalize booking.`;
          return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
        }
      } else {
        nextState = 'awaiting_date_time';
        const reply = langScript === 'franco' || langScript === 'mixed'
          ? `L slot mesh fadi (${checkRes.message || 'taken'}). N2e se3a aw nhar tanye.`
          : `That slot is unavailable (${checkRes.message || 'taken'}). Please choose a different date or time.`;
        return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
      }
    } else {
      nextState = 'awaiting_date_time';
      const reply = langScript === 'franco' || langScript === 'mixed'
        ? `Tmm, l ${match.name} b $${match.price}. Ayya nhar w se3a baddak?`
        : `Great, the ${match.name} is $${match.price}. Which date and time would you like?`;
      return { replyText: reply, nextState, actions, dbWriteAttempted, dbWriteSuccess };
    }
  } else {
    // List services
    const serviceList = services.map(s => s.name).join(', ');
    const reply = langScript === 'franco' || langScript === 'mixed'
      ? `Ma l2ina hal service. 3anna: ${serviceList}. Ayya baddak?`
      : `We couldn't find that service. We offer: ${serviceList}. Which one would you like?`;
    return { replyText: reply, nextState: 'idle', actions, dbWriteAttempted, dbWriteSuccess };
  }
}
