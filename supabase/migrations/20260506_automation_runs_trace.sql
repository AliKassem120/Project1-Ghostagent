-- GhostAgent automation run traces for God Mode debugging.

CREATE TABLE IF NOT EXISTS automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID,
    user_id UUID,
    platform TEXT,
    chat_id TEXT,
    incoming_message TEXT,
    buffered_message TEXT,
    state_before TEXT,
    state_after TEXT,
    intent TEXT,
    actions JSONB DEFAULT '[]'::jsonb,
    db_write_attempted BOOLEAN DEFAULT false,
    db_write_success BOOLEAN DEFAULT false,
    order_id TEXT,
    appointment_id TEXT,
    reply_before_guard TEXT,
    reply_after_guard TEXT,
    blocked_reason TEXT,
    source_path TEXT,
    error TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_workspace_created ON automation_runs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_chat_created ON automation_runs(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_platform ON automation_runs(platform);
