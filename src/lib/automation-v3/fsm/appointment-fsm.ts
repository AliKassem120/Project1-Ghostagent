import { SupabaseClient } from '@supabase/supabase-js';
import type { SessionContext } from '../session-manager';
import type { WorkspaceConfig } from '@/lib/ai/types';
import { detectLanguageScript, detectYesNo, extractNameAndPhone, detectReuseSignals } from '@/lib/ai/language';
import { buildTimeContext, resolveDateFromMessage, resolveTimeFromMessage, formatDateLabel } from '@/lib/ai/time';
import { loadActiveServices, findBestServiceMatch } from '@/lib/ai/appointments/services';
import { createAppointmentTools } from '@/lib/ai/tools';

export interface FsmResult {
  nextState: string;
  actions: string[];
  context: {
    actionType: 'order_cancelled' | 'checkout_success' | 'appointment_booked' | 'info_gathered';
    payload: Record<string, any>;
  };
  dbWriteAttempted: boolean;
  dbWriteSuccess: boolean;
}

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
                service,
                date,
                time,
                missingDetails: ['name', 'phone'].filter(k => !session.data![k])
              }
            },
            dbWriteAttempted,
            dbWriteSuccess
          };
        }
      }

      dbWriteAttempted = true;
      actions.push('tool_book_appointment');

      // Re-check slot availability to prevent race conditions (especially on legacy non-RPC path)
      const slotRecheck = await tools.check_slot.execute({ date, time, service });
      if (!slotRecheck.available) {
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
              error: slotRecheck.message || slotRecheck.reason || 'Slot is no longer available'
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
          return {
            nextState,
            actions,
            context: {
              actionType: 'info_gathered',
              payload: {
                service: match.name,
                slotAvailable: true,
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
                service: match.name,
                slotAvailable: true,
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
        nextState = 'awaiting_date_time';
        return {
          nextState,
          actions,
          context: {
            actionType: 'info_gathered',
            payload: {
              service: match.name,
              slotAvailable: false,
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
    // List services
    return {
      nextState: 'idle',
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
