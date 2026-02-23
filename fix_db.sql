-- 1. ADD MISSING COLUMNS TO BOT SETTINGS
-- This fixes the error where the bot crashes when looking for these fields,
-- and allows the settings page to actually save these variables!

ALTER TABLE public.bot_settings 
ADD COLUMN IF NOT EXISTS store_location text,
ADD COLUMN IF NOT EXISTS contact_info text,
ADD COLUMN IF NOT EXISTS use_local_slang boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS urgency_mode boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS handoff_keywords jsonb DEFAULT '[]'::jsonb;

-- 2. FIX PUBLIC.USERS FOREIGN KEY ISSUE
-- Sometimes a Google signup bypasses the trigger because of timing or older bugs.
-- This inserts any missing users from auth.users into public.users
-- so that bot_settings can perfectly save without a Foreign Key violation!

INSERT INTO public.users (id, email, created_at)
SELECT id, email, created_at 
FROM auth.users
ON CONFLICT (id) DO NOTHING;
