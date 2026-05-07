-- ═══════════════════════════════════════════════════════════════
-- GhostAgent — automation_runs audit table
-- ═══════════════════════════════════════════════════════════════
-- Full audit trail for every processed message.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  incoming_message TEXT,
  buffered_message TEXT,
  state_before TEXT,
  state_after TEXT,
  classifier_result JSONB,
  extracted_entities JSONB,
  intent TEXT,
  actions TEXT[] DEFAULT '{}',
  db_write_attempted BOOLEAN DEFAULT false,
  db_write_success BOOLEAN DEFAULT false,
  reply_before_guard TEXT,
  reply_after_guard TEXT,
  blocked_reason TEXT,
  source_path TEXT,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_automation_runs_workspace ON automation_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_chat ON automation_runs(chat_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_created ON automation_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_intent ON automation_runs(intent);
