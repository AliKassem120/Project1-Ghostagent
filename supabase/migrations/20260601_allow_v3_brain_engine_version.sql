-- ═══════════════════════════════════════════════════════════════
-- GhostAgent — Allow V3 Engine Options
-- Updates check constraints to allow 'v3_brain' and 'v3' engine versions
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Drop the old constraint if it exists
  ALTER TABLE public.ai_settings
    DROP CONSTRAINT IF EXISTS ai_settings_engine_version_check;

  -- Create new constraint supporting v3_brain and v3
  ALTER TABLE public.ai_settings
    ADD CONSTRAINT ai_settings_engine_version_check
    CHECK (automation_engine_version IN ('v1', 'v2', 'v3_brain', 'v3'));

EXCEPTION WHEN others THEN
  RAISE NOTICE 'Failed to update constraint. Skipping.';
END $$;
