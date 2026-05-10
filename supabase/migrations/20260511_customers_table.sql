-- ═══════════════════════════════════════════════════════════════
-- GhostAgent — customers table
-- Stores customer name/phone/address as soon as it is learned,
-- even mid-conversation, so returning customers are recognized.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS customers (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID       NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    chat_id     TEXT        NOT NULL,
    platform    TEXT        NOT NULL CHECK (platform IN ('instagram', 'whatsapp')),
    name        TEXT,
    phone       TEXT,
    address     TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (workspace_id, chat_id)
);

CREATE INDEX IF NOT EXISTS customers_workspace_chat_idx ON customers (workspace_id, chat_id);

-- RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_owner_manage_customers" ON customers
    USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE user_id = auth.uid()
        )
    );
