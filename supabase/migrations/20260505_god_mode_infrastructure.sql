-- ═══════════════════════════════════════════════════════════════
-- GOD MODE — Phase 1 Infrastructure Migration
-- ═══════════════════════════════════════════════════════════════
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS).
--
-- INSTRUCTIONS:
--   1. Review this file.
--   2. Open Supabase Dashboard → SQL Editor.
--   3. Paste and run this entire file.
--   4. Verify with the queries at the bottom.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. INTERNAL WORKSPACE FIELDS ON ai_settings ────────────

ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false;
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS workspace_role text DEFAULT 'customer';
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'normal';
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS autopilot boolean DEFAULT true;

COMMENT ON COLUMN ai_settings.is_internal IS 'True for God Mode-only workspaces (official support, test, admin)';
COMMENT ON COLUMN ai_settings.workspace_role IS 'customer | official_support | test | admin';
COMMENT ON COLUMN ai_settings.visibility IS 'normal | god_mode_only | hidden';
COMMENT ON COLUMN ai_settings.autopilot IS 'Whether this workspace sends AI replies automatically. Used by dashboard and God Mode.';

-- ─── 2. KNOWLEDGE EXTENSIONS ON business_knowledge ──────────

ALTER TABLE business_knowledge ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE business_knowledge ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'manual';
ALTER TABLE business_knowledge ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE business_knowledge ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE business_knowledge ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public';
ALTER TABLE business_knowledge ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
ALTER TABLE business_knowledge ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

COMMENT ON COLUMN business_knowledge.source_type IS 'manual | website | faq | pricing | docs';
COMMENT ON COLUMN business_knowledge.visibility IS 'public | internal_support | private_admin | secret';

-- ─── 3. BOT CONTROL FLAGS TABLE ─────────────────────────────

CREATE TABLE IF NOT EXISTS bot_control_flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scope text NOT NULL CHECK (scope IN ('global', 'workspace', 'chat')),
    workspace_id uuid,
    chat_id text,
    pause_dms boolean DEFAULT false,
    pause_comments boolean DEFAULT false,
    force_draft boolean DEFAULT false,
    disable_external_sends boolean DEFAULT false,
    reason text,
    created_by text,
    updated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE bot_control_flags IS 'Kill switches for God Mode. Checked before every send.';

-- ─── 4. INDEXES ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_activity_log_ws_ts
    ON activity_log(workspace_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_event_ts
    ON activity_log(event_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_conv_states_ws_chat
    ON conversation_states(workspace_id, chat_id);

CREATE INDEX IF NOT EXISTS idx_bot_control_flags_scope
    ON bot_control_flags(scope, workspace_id, chat_id);

-- ─── 5. VERIFICATION QUERIES ────────────────────────────────
-- Run these after applying to confirm:

-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'ai_settings'
--   AND column_name IN ('is_internal', 'workspace_role', 'visibility', 'autopilot');

-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'business_knowledge'
--   AND column_name IN ('workspace_id', 'source_type', 'visibility', 'title');

-- SELECT * FROM information_schema.tables WHERE table_name = 'bot_control_flags';
