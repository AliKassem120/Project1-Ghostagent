-- ═══════════════════════════════════════════════════════════════
-- GhostAgent — Conversation Summaries (Memory System)
-- ═══════════════════════════════════════════════════════════════
-- Stores LLM-generated summaries of past conversation sessions
-- so the agent has persistent memory across session boundaries.

CREATE TABLE IF NOT EXISTS conversation_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES ai_settings(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'instagram',
    summary TEXT NOT NULL,
    message_count INTEGER DEFAULT 0,
    session_started_at TIMESTAMPTZ,
    session_ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup: recent summaries for a specific chat
CREATE INDEX idx_conversation_summaries_lookup
    ON conversation_summaries (workspace_id, chat_id, created_at DESC);

-- Row Level Security
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage conversation summaries through their workspace" ON conversation_summaries;
CREATE POLICY "Users can manage conversation summaries through their workspace" ON conversation_summaries
FOR ALL
USING (
    workspace_id IN (
        SELECT id FROM ai_settings WHERE user_id = auth.uid()
    )
);
