-- ═══════════════════════════════════════════════════════════════
-- 🗓️ GHOST AGENT — GOOGLE CALENDAR TOKEN MIGRATION
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;

COMMENT ON COLUMN public.users.google_refresh_token IS
  'Refresh token for the user''s connected Google Calendar. Used for offline access to manage events/appointments.';
