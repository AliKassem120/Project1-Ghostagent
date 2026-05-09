-- ============================================================
-- Team Access: workspace_members table
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS workspace_members (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES ai_settings(id) ON DELETE CASCADE,
    owner_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invite_email text NOT NULL,
    user_id     uuid REFERENCES users(id) ON DELETE SET NULL, -- populated when invite accepted
    role        text NOT NULL DEFAULT 'staff' CHECK (role IN ('manager', 'staff')),
    status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
    invited_at  timestamptz NOT NULL DEFAULT now(),
    accepted_at timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_email ON workspace_members(invite_email);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- RLS
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Workspace owner can read/write all members for their workspaces
CREATE POLICY "owner_full_access" ON workspace_members
    FOR ALL
    USING (owner_id = auth.uid());

-- Invited user can see/accept their own invite
CREATE POLICY "invitee_can_see_own_invite" ON workspace_members
    FOR SELECT
    USING (invite_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "invitee_can_accept_own_invite" ON workspace_members
    FOR UPDATE
    USING (invite_email = (SELECT email FROM auth.users WHERE id = auth.uid()));
