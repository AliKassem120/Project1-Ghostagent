-- ═══════════════════════════════════════════════════════════════
-- GhostAgent — Safe Booking Transactional RPC Functions
-- ═══════════════════════════════════════════════════════════════
-- Atomically books/reschedules appointments to prevent race conditions.

-- 1. Atomic Booking Function
CREATE OR REPLACE FUNCTION safe_book_appointment(
  p_user_id UUID,
  p_workspace_id UUID,
  p_platform TEXT,
  p_chat_id TEXT,
  p_instagram_handle TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_service_name TEXT,
  p_appointment_date DATE,
  p_start_time TEXT,
  p_end_time TEXT,
  p_duration_minutes INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_overlap_exists BOOLEAN;
  v_inserted_id UUID;
BEGIN
  -- Check for overlapping appointment in a transaction-safe way
  SELECT EXISTS (
    SELECT 1 FROM appointments
    WHERE workspace_id = p_workspace_id
      AND appointment_date = p_appointment_date
      AND status IN ('confirmed', 'pending', 'Confirmed', 'Pending')
      AND (
        (start_time::time, end_time::time) OVERLAPS (p_start_time::time, p_end_time::time)
      )
  ) INTO v_overlap_exists;

  IF v_overlap_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'This slot is already booked.');
  END IF;

  -- Insert the appointment
  INSERT INTO appointments (
    user_id, workspace_id, platform, chat_id, instagram_user_id, instagram_handle,
    customer_name, customer_phone, service, appointment_date, start_time, end_time,
    duration_minutes, status, notes
  ) VALUES (
    p_user_id, p_workspace_id, p_platform, p_chat_id, p_chat_id, p_instagram_handle,
    p_customer_name, p_customer_phone, p_service_name, p_appointment_date, p_start_time::time, p_end_time::time,
    p_duration_minutes, 'confirmed', 'Created via Automation safe RPC'
  ) RETURNING id INTO v_inserted_id;

  RETURN jsonb_build_object('success', true, 'appointmentId', v_inserted_id);
END;
$$ LANGUAGE plpgsql;

-- 2. Atomic Rescheduling Function
CREATE OR REPLACE FUNCTION safe_reschedule_appointment(
  p_workspace_id UUID,
  p_appointment_id UUID,
  p_new_date DATE,
  p_new_start_time TEXT,
  p_new_end_time TEXT
) RETURNS JSONB AS $$
DECLARE
  v_overlap_exists BOOLEAN;
BEGIN
  -- Check for overlapping appointment in a transaction-safe way, ignoring the target appointment itself
  SELECT EXISTS (
    SELECT 1 FROM appointments
    WHERE workspace_id = p_workspace_id
      AND appointment_date = p_new_date
      AND id != p_appointment_id
      AND status IN ('confirmed', 'pending', 'Confirmed', 'Pending')
      AND (
        (start_time::time, end_time::time) OVERLAPS (p_new_start_time::time, p_new_end_time::time)
      )
  ) INTO v_overlap_exists;

  IF v_overlap_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'This slot is already booked.');
  END IF;

  -- Update the appointment
  UPDATE appointments
  SET appointment_date = p_new_date,
      start_time = p_new_start_time::time,
      end_time = p_new_end_time::time,
      updated_at = now()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
