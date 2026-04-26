-- ═══════════════════════════════════════════════════════════════
-- GHOST AGENT — SERVICES TABLE: Add AI booking fields
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Add missing columns (safe / idempotent)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buffer_before INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buffer_after  INTEGER NOT NULL DEFAULT 0;

-- Index for workspace lookups
CREATE INDEX IF NOT EXISTS services_workspace_active_idx
  ON public.services (workspace_id, is_active);

-- Backfill: mark all existing services as active
UPDATE public.services SET is_active = TRUE WHERE is_active IS NULL;

-- RLS: update policies to include workspace_id scope
DROP POLICY IF EXISTS "Users can view their own services" ON public.services;
CREATE POLICY "Users can view their own services"
ON public.services FOR SELECT
USING (auth.uid() = user_id OR workspace_id::text = auth.uid()::text);

DROP POLICY IF EXISTS "Users can insert their own services" ON public.services;
CREATE POLICY "Users can insert their own services"
ON public.services FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own services" ON public.services;
CREATE POLICY "Users can update their own services"
ON public.services FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own services" ON public.services;
CREATE POLICY "Users can delete their own services"
ON public.services FOR DELETE
USING (auth.uid() = user_id);
