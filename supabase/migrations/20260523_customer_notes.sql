-- ═══════════════════════════════════════════════════════════════
-- GhostAgent — Customer Notes (Memory System)
-- ═══════════════════════════════════════════════════════════════
-- Stores LLM-extracted personal facts about customers so the
-- agent can recall preferences, issues, and details naturally.

CREATE TABLE IF NOT EXISTS customer_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES ai_settings(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'instagram',
    note_type TEXT NOT NULL DEFAULT 'fact',   -- 'preference' | 'fact' | 'issue' | 'feedback'
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'auto',       -- 'auto' (LLM-extracted) | 'manual' (owner-added)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup: notes for a specific customer
CREATE INDEX IF NOT EXISTS idx_customer_notes_lookup
    ON customer_notes (workspace_id, chat_id, created_at DESC);

-- Row Level Security
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage customer notes through their workspace" ON customer_notes;
CREATE POLICY "Users can manage customer notes through their workspace" ON customer_notes
FOR ALL
USING (
    workspace_id IN (
        SELECT id FROM ai_settings WHERE user_id = auth.uid()
    )
);
