-- ════════════════════════════════════════════════════════
-- Ghost Agent — Fix order_sessions stage constraint
-- Run this in Supabase SQL Editor if you already ran
-- the old migration (that had collecting_name/phone/address)
-- ════════════════════════════════════════════════════════

-- Drop the old constraint
ALTER TABLE order_sessions
  DROP CONSTRAINT IF EXISTS order_sessions_stage_check;

-- Add updated constraint that accepts the new single-stage value
ALTER TABLE order_sessions
  ADD CONSTRAINT order_sessions_stage_check
  CHECK (stage IN ('collecting_info'));

-- Also reset the default
ALTER TABLE order_sessions
  ALTER COLUMN stage SET DEFAULT 'collecting_info';

-- Clean up any stale sessions from old multi-stage tests
DELETE FROM order_sessions WHERE stage IN ('collecting_name', 'collecting_phone', 'collecting_address');
