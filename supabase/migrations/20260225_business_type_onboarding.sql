-- ═══════════════════════════════════════════════════════════════
-- 🚀 GHOST AGENT — ONBOARDING MIGRATION
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Safely rename the enum value 'nightlife_events' to 'events_ticketing'
-- 1. Safely rename the enum value if it exists, otherwise do nothing
DO $$
BEGIN
  ALTER TYPE public.business_category RENAME VALUE 'nightlife_events' TO 'events_ticketing';
EXCEPTION
  WHEN invalid_parameter_value THEN
    -- Label doesn't exist (maybe already renamed or never created), ignore
    NULL;
END $$;

-- 2. Add business_type to the users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS business_type public.business_category;

COMMENT ON COLUMN public.users.business_type IS
  'The niche selected by the user during onboarding: ecommerce, appointments, real_estate, food_and_beverage, events_ticketing, digital_services';
