import { SupabaseClient } from '@supabase/supabase-js';
import type { SessionContext, FsmResult } from '../types';
import type { WorkspaceConfig } from '@/lib/ai/types';
import { detectLanguageScript, detectYesNo, extractNameAndPhone, detectReuseSignals } from '@/lib/ai/language';
import { buildTimeContext, resolveDateFromMessage, resolveTimeFromMessage, formatDateLabel } from '@/lib/ai/time';
import { loadActiveServices, findBestServiceMatch } from '@/lib/ai/appointments/services';
import { createAppointmentTools } from '@/lib/ai/tools';
import { classifyConfirmationIntent } from '@/lib/ai/guardrails/confirmation-classifier';

export async function runAppointmentFSM(
  message: string,
  session: SessionContext,
  config: WorkspaceConfig,
  supabase: SupabaseClient
): Promise<FsmResult> {
  const actions: string[] = [];
  let dbWriteAttempted = false;
  let dbWriteSuccess = false;

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

  // Helper to load known customer details (cached within this FSM call)
  let _cachedCustomer: any = undefined;
  const getKnownDetails = async () => {
    if (_cachedCustomer !== undefined) return _cachedCustomer;
    const known = await tools.lookup_customer.execute();
    _cachedCustomer = known.found ? known : null;
    return _cachedCustomer;
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
  const hasDetails = (d: Record<string, any>) => {
    const name = (d.name || '').toString().trim();
    const phone = (d.phone || '').toString().trim();
    const phoneDigits = phone.replace(/\D/g, '');
    return !!(name && name.length > 0 && phone && phoneDigits.length >= 7);
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
          nextState,
          actions,
          context: {
            actionType: 'order_cancelled',
            payload: { success: true, type: 'appointment' }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      } else {
        actions.push('cancel_appointment_failed');
        return {
          nextState: 'handoff',
          actions: [...actions, 'handoff'],
          context: {
            actionType: 'order_cancelled',
            payload: { success: false, error: 'cancellation_failed', type: 'appointment' }
          },
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
        // FIX: Keep appointment reference for follow-up questions
        const lastAppointmentId = reschedRes.appointmentId;
        session.data = { lastAppointmentId, service: session.data?.service };
        const dateLabel = formatDateLabel(date, timeCtx);
        return {
          nextState,
          actions,
          context: {
            actionType: 'info_gathered',
            payload: {
              rescheduled: true,
              success: true,
              date,
              time: reschedRes.new_time,
              dateLabel
            }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      } else {
        actions.push('reschedule_appointment_failed');
        return {
          nextState,
          actions,
          context: {
            actionType: 'info_gathered',
            payload: {
              rescheduled: true,
              success: false,
              error: reschedRes.error || 'overlap'
            }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      }
    }

    // Partial rescheduling — only date or only time provided
    const partialDate = resolveDateFromMessage(message, timeCtx);
    const partialTime = resolveTimeFromMessage(message);
    if (partialDate || partialTime) {
      // Store whatever we have and ask for the missing piece
      if (partialDate) session.data.rescheduleDate = partialDate;
      if (partialTime) session.data.rescheduleTime = partialTime;
      return {
        nextState,
        actions,
        context: {
          actionType: 'info_gathered',
          payload: {
            rescheduling: true,
            date: partialDate || session.data.rescheduleDate || null,
            time: partialTime || session.data.rescheduleTime || null,
            missingForReschedule: !partialDate && !session.data.rescheduleDate ? 'date' : (!partialTime && !session.data.rescheduleTime ? 'time' : null)
          }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
    }

    // Guard: in post_appointment_modify but no cancel/reschedule intent matched — prevent silent fall-through
    return {
      nextState,
      actions: [...actions, 'modify_intent_unclear'],
      context: {
        actionType: 'info_gathered',
        payload: {
          modifyIntentUnclear: true,
          hint: 'cancel_or_reschedule'
        }
      },
      dbWriteAttempted,
      dbWriteSuccess
    };
  }

  // 2. Handle booking confirmation state
  if (currentState === 'awaiting_booking_confirmation') {
    // Also parse any date/time the user might have mentioned in the message to prevent stale data
    const newDate = resolveDateFromMessage(message, timeCtx);
    const newTime = resolveTimeFromMessage(message);
    if (newDate) session.data.date = newDate;
    if (newTime) session.data.time = newTime;

    // Use LLM-based classifier for robust intent detection in high-stakes confirmation state
    const yesNo = await classifyConfirmationIntent(message, {
      businessType: 'appointments',
      pendingService: session.data.service && session.data.date && session.data.time
        ? `${session.data.service} on ${session.data.date} at ${session.data.time} for ${session.data.name || 'customer'}`
        : undefined,
    });
    if (yesNo === 'yes') {
      let { service, date, time, name, phone } = session.data;

      // FIX: Recover customer details from profile before falling back
      if (!name || !phone) {
          const known = await getKnownDetails();
          if (!name && known?.name) { session.data.name = known.name; name = known.name; }
          if (!phone && known?.phone) { session.data.phone = known.phone; phone = known.phone; }
          
          // Also check customer profile
          if (!name && session.customerProfile?.name) { session.data.name = session.customerProfile.name; name = session.customerProfile.name; }
          if (!phone && session.customerProfile?.phone) { session.data.phone = session.customerProfile.phone; phone = session.customerProfile.phone; }
      }

      if (!service || !date || !time || !name || !phone) {
          const missing = ['name', 'phone'].filter(k => !session.data![k]);
          nextState = 'awaiting_customer_details';
          return {
              nextState,
              actions,
              context: {
                  actionType: 'info_gathered',
                  payload: {
                      service,
                      date,
                      time,
                      name: session.data.name,
                      phone: session.data.phone,
                      missingDetails: missing,
                      recoveryAttempted: true
                  }
              },
              dbWriteAttempted,
              dbWriteSuccess
          };
      }

      dbWriteAttempted = true;
      actions.push('tool_book_appointment');

      // Re-check slot availability to prevent race conditions (especially on legacy non-RPC path)
      const slotRecheck = await tools.check_slot.execute({ date, time, service });
      if (!slotRecheck.available) {
        // FIX: Find next 3 available slots on the same day for suggestions
        let alternatives: Array<{time: string; label: string}> = [];
        try {
            const { loadBusinessHours } = await import('@/lib/ai/appointments/hours');
            const { formatTime12 } = await import('@/lib/ai/time');
            const activeServices = await loadActiveServices(supabase, session.workspaceId);
            
            const hours = await loadBusinessHours(supabase, session.workspaceId);
            const match = activeServices.find((s: any) => s.name === service) || { durationMinutes: 30 };
            const slotDuration = match.durationMinutes || config.slotDurationMinutes || 30;
            
            // Check slots every 30 min from business open to close
            const dayOfWeek = new Date(date + 'T12:00:00').getDay();
            const dayHours = hours.find((h: any) => h.dayOfWeek === dayOfWeek);
            
            if (dayHours?.isOpen) {
                const openMin = parseInt(dayHours.openTime.split(':')[0]) * 60 + parseInt(dayHours.openTime.split(':')[1]);
                const closeMin = parseInt(dayHours.closeTime.split(':')[0]) * 60 + parseInt(dayHours.closeTime.split(':')[1]);
                
                for (let m = openMin; m < closeMin && alternatives.length < 3; m += 30) {
                    if (m === parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1])) continue; // Skip taken slot
                    const candidateTime = `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
                    const check = await tools.check_slot.execute({ date, time: candidateTime, service });
                    if (check.available) {
                        alternatives.push({ time: candidateTime, label: formatTime12(candidateTime) });
                    }
                }
            }
        } catch (e) {
            // Non-critical: alternatives are a nice-to-have
        }

        return {
          nextState: 'awaiting_date_time',
          actions: [...actions, 'slot_taken_at_confirmation'],
          context: {
            actionType: 'info_gathered',
            payload: {
              slotAvailable: false,
              service,
              date,
              time,
              error: slotRecheck.message || slotRecheck.reason || 'Slot is no longer available',
              alternatives
            }
          },
          dbWriteAttempted: false,
          dbWriteSuccess: false
        };
      }

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
        return {
          nextState,
          actions,
          context: {
            actionType: 'appointment_booked',
            payload: {
              success: true,
              service,
              date,
              time: bookRes.time || time,
              name,
              phone
            }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      } else {
        actions.push('book_appointment_failed');
        return {
          nextState: 'handoff',
          actions: [...actions, 'handoff'],
          context: {
            actionType: 'appointment_booked',
            payload: {
              success: false,
              error: 'booking_creation_failed'
            }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      }
    } else if (yesNo === 'no') {
      nextState = 'idle';
      session.data = {};
      return {
        nextState,
        actions,
        context: {
          actionType: 'info_gathered',
          payload: {
            bookingConfirmed: false
          }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
    } else {
      return {
        nextState,
        actions,
        context: {
          actionType: 'info_gathered',
          payload: {
            isReadyToConfirm: true,
            service: session.data.service
          }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
    }
  }

  // 3. Handle customer details state
  if (currentState === 'awaiting_customer_details') {
    const details = await resolveDetails(message);
    session.data = { ...session.data, ...details };

    // Also parse any date/time the user might have mentioned in the details message to keep context updated
    const newDate = resolveDateFromMessage(message, timeCtx);
    const newTime = resolveTimeFromMessage(message);
    if (newDate) session.data.date = newDate;
    if (newTime) session.data.time = newTime;

    if (hasDetails(session.data)) {
      nextState = 'awaiting_booking_confirmation';
      return {
        nextState,
        actions,
        context: {
          actionType: 'info_gathered',
          payload: {
            service: session.data.service,
            date: session.data.date,
            time: session.data.time,
            name: session.data.name,
            phone: session.data.phone,
            isReadyToConfirm: true
          }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
    } else {
      return {
        nextState,
        actions,
        context: {
          actionType: 'info_gathered',
          payload: {
            service: session.data.service,
            date: session.data.date,
            time: session.data.time,
            missingDetails: ['name', 'phone'].filter(k => !session.data![k])
          }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
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
          return {
            nextState,
            actions,
            context: {
              actionType: 'info_gathered',
              payload: {
                slotAvailable: true,
                service: session.data.service,
                date,
                time,
                name: session.data.name,
                phone: session.data.phone,
                isReadyToConfirm: true
              }
            },
            dbWriteAttempted,
            dbWriteSuccess
          };
        } else {
          nextState = 'awaiting_customer_details';
          return {
            nextState,
            actions,
            context: {
              actionType: 'info_gathered',
              payload: {
                slotAvailable: true,
                service: session.data.service,
                date,
                time,
                missingDetails: ['name', 'phone'].filter(k => !session.data![k])
              }
            },
            dbWriteAttempted,
            dbWriteSuccess
          };
        }
      } else {
        return {
          nextState,
          actions,
          context: {
            actionType: 'info_gathered',
            payload: {
              slotAvailable: false,
              service: session.data.service,
              date,
              time,
              error: checkRes.message || 'taken'
            }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      }
    } else {
      return {
        nextState,
        actions,
        context: {
          actionType: 'info_gathered',
          payload: {
            service: session.data.service,
            isAwaitingDateTime: true
          }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
    }
  }

  // 5. Handle service state (or starting flow from idle)
  const services = await loadActiveServices(supabase, session.workspaceId);
  
  // Extract and save date/time from message to prevent losing context
  const date = resolveDateFromMessage(message, timeCtx);
  const time = resolveTimeFromMessage(message);
  if (date) session.data.date = date;
  if (time) session.data.time = time;

  let match = findBestServiceMatch(services, message);

  // Fallback: If no service is matched in the message, but we already have one stored in session, reuse it!
  if (!match && session.data?.service) {
    const existing = services.find(s => s.name === session.data.service);
    if (existing) {
      match = existing;
    }
  }

  if (match) {
    session.data.service = match.name;
    session.data.price = match.price;
    session.data.duration = match.durationMinutes;

    const targetDate = date || session.data.date;
    const targetTime = time || session.data.time;

    if (targetDate && targetTime) {
      session.data.date = targetDate;
      session.data.time = targetTime;
      
      actions.push('tool_check_slot');
      const checkRes = await tools.check_slot.execute({ date: targetDate, time: targetTime, service: match.name });
      if (checkRes.available) {
        const details = await resolveDetails(message);
        session.data = { ...session.data, ...details };

        if (hasDetails(session.data)) {
          nextState = 'awaiting_booking_confirmation';
          return {
            nextState,
            actions,
            context: {
              actionType: 'info_gathered',
              payload: {
                service: match.name,
                slotAvailable: true,
                date: targetDate,
                time: targetTime,
                name: session.data.name,
                phone: session.data.phone,
                isReadyToConfirm: true
              }
            },
            dbWriteAttempted,
            dbWriteSuccess
          };
        } else {
          nextState = 'awaiting_customer_details';
          return {
            nextState,
            actions,
            context: {
              actionType: 'info_gathered',
              payload: {
                service: match.name,
                slotAvailable: true,
                date: targetDate,
                time: targetTime,
                missingDetails: ['name', 'phone'].filter(k => !session.data![k])
              }
            },
            dbWriteAttempted,
            dbWriteSuccess
          };
        }
      } else {
        nextState = 'awaiting_date_time';
        return {
          nextState,
          actions,
          context: {
            actionType: 'info_gathered',
            payload: {
              service: match.name,
              slotAvailable: false,
              date: targetDate,
              time: targetTime,
              error: checkRes.message || 'taken'
            }
          },
          dbWriteAttempted,
          dbWriteSuccess
        };
      }
    } else {
      nextState = 'awaiting_date_time';
      return {
        nextState,
        actions,
        context: {
          actionType: 'info_gathered',
          payload: {
            service: match.name,
            price: match.price,
            isAwaitingDateTime: true
          }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
    }
  } else {
    // No service matched — but check if this is a mid-booking question
    // (e.g. "How long does it take?", "Where are you located?", "How much?")
    // If the customer already has booking context (service selected, date/time given),
    // don't loop awaiting_service — break out to idle so the LLM fallback pipeline
    // can answer contextually using conversation history.
    const isFollowUpQuestion = /\b(how much|price|cost|long|duration|minute|hour|where|location|address|park|cancel|reschedule|change|what|which|can you|do you|is there|are there|open|close|available|عنوان|وين|كم|سعر|وقت|ساعة|دقيقة)\b/i.test(message);
    const hasExistingContext = !!(session.data?.service || session.data?.name || session.data?.date);

    if (isFollowUpQuestion && hasExistingContext && currentState === 'awaiting_service') {
      // Break out of FSM loop — let LLM answer the question with full context
      return {
        nextState: 'idle',
        actions: [...actions, 'mid_booking_question_detected'],
        context: {
          actionType: 'defer_to_llm',
          payload: {
            serviceNotFound: true,
            query: message,
            existingService: session.data.service,
            existingDate: session.data.date,
            existingTime: session.data.time,
            reason: 'Customer asked a follow-up question during booking flow'
          }
        },
        dbWriteAttempted,
        dbWriteSuccess
      };
    }

    // List services
    const targetState = (currentState === 'idle' || currentState === 'awaiting_service')
      ? 'awaiting_service'
      : 'idle';
    return {
      nextState: targetState,
      actions,
      context: {
        actionType: 'info_gathered',
        payload: {
          serviceNotFound: true,
          query: message,
          availableServices: services.map(s => s.name)
        }
      },
      dbWriteAttempted,
      dbWriteSuccess
    };
  }
}
