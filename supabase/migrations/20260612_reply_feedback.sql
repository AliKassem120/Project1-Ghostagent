-- GhostAgent — Reply Feedback Table
-- Enables dashboard users to flag bad AI replies for review/improvement.

CREATE TABLE IF NOT EXISTS reply_feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES ai_settings(id) ON DELETE CASCADE,
  chat_id      TEXT NOT NULL,
  platform     TEXT NOT NULL CHECK (platform IN ('instagram', 'whatsapp')),
  reply_text   TEXT NOT NULL,
  customer_message TEXT,
  reason       TEXT CHECK (reason IN ('wrong_info', 'bad_tone', 'wrong_language', 'hallucination', 'too_robotic', 'other')),
  note         TEXT,
  flagged_by   UUID REFERENCES auth.users(id),
  resolved     BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now(),
  resolved_at  TIMESTAMPTZ
);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_reply_feedback_workspace 
  ON reply_feedback(workspace_id, created_at DESC);

-- Index for unresolved feedback
CREATE INDEX IF NOT EXISTS idx_reply_feedback_unresolved
  ON reply_feedback(workspace_id, created_at DESC) WHERE resolved = false;

-- RLS: workspace owners can view their own feedback
ALTER TABLE reply_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspace feedback"
  ON reply_feedback FOR SELECT
  USING (workspace_id IN (
    SELECT id FROM ai_settings WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own workspace feedback"
  ON reply_feedback FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT id FROM ai_settings WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update own workspace feedback"
  ON reply_feedback FOR UPDATE
  USING (workspace_id IN (
    SELECT id FROM ai_settings WHERE user_id = auth.uid()
  ));
