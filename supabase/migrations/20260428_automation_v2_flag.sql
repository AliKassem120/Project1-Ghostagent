-- ═══════════════════════════════════════════════════════════════
-- GhostAgent — Automation Engine V2: Feature Flag
-- Adds workspace-level engine version selector
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS automation_engine_version TEXT NOT NULL DEFAULT 'v1';

-- Ensure valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'ai_settings_engine_version_check'
  ) THEN
    ALTER TABLE public.ai_settings
      ADD CONSTRAINT ai_settings_engine_version_check
      CHECK (automation_engine_version IN ('v1', 'v2'));
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Constraint may already exist or column check failed. Skipping.';
END $$;
