-- ═══════════════════════════════════════════════════════════════
-- 🚀 GHOST AGENT — BUSINESS CATEGORY ENUM MIGRATION
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Create the new ENUM type
CREATE TYPE public.business_category AS ENUM (
    'ecommerce',
    'appointments',
    'real_estate',
    'food_and_beverage',
    'nightlife_events',
    'digital_services'
);

-- 2. Drop the old check constraint and change the type of the existing column,
-- or add it if it doesn't exist.
-- Assuming the previous migration might have added it as a text check:
DO $$ 
BEGIN
  -- If it already exists with a check constraint, we should probably just
  -- drop the old column and create a new one to be clean, but let's try 
  -- altering it safely. Since it's a new field, dropping and recreating is easier.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_settings' AND column_name = 'business_type') THEN
    ALTER TABLE public.bot_settings DROP COLUMN business_type;
  END IF;
END $$;

ALTER TABLE public.bot_settings
ADD COLUMN business_type public.business_category DEFAULT 'ecommerce'::public.business_category;

COMMENT ON COLUMN public.bot_settings.business_type IS
  'Tenant business model: ecommerce, appointments, real_estate, food_and_beverage, nightlife_events, digital_services';
