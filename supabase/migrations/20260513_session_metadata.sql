-- ═══════════════════════════════════════════════════════════════
-- GhostAgent — Session Metadata Migration
-- ═══════════════════════════════════════════════════════════════
-- Adds platform column and index for session timeout queries.
-- The session metadata (loopCount, lastBotMessage, stateEnteredAt)
-- is stored in the existing `data` JSONB column — no schema change needed.

-- Add platform column if not exists
ALTER TABLE conversation_states ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'instagram';

-- Index for purge queries and session timeout lookups
CREATE INDEX IF NOT EXISTS idx_conversation_states_workspace_updated 
    ON conversation_states(workspace_id, updated_at);

-- Index for efficient session lookups
CREATE INDEX IF NOT EXISTS idx_conversation_states_chat_lookup
    ON conversation_states(user_id, workspace_id, chat_id, workspace_type);
