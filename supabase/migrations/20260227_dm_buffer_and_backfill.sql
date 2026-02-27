-- ═══════════════════════════════════════════════════════════
-- Ghost Agent — DM Buffer Table + Analytics Backfill
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. dm_buffer: one row per (owner, sender, channel)
--    Used by the upsert-debounce engine to batch rapid DMs
CREATE TABLE IF NOT EXISTS dm_buffer (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        uuid NOT NULL,
    sender_id       text NOT NULL,
    workspace_id    uuid,
    channel         text NOT NULL DEFAULT 'instagram',
    buffered_text   text NOT NULL DEFAULT '',
    reply_at        timestamptz NOT NULL,
    status          text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'processing')),
    lock_expires_at timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    UNIQUE (owner_id, sender_id, channel)
);

-- Index for the claim query
CREATE INDEX IF NOT EXISTS dm_buffer_claim_idx
    ON dm_buffer (owner_id, sender_id, channel, status, reply_at);

-- 2. Ensure activity_log has workspace_id column
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- 3. Backfill old activity_log rows with the user's first workspace
--    (so existing data appears under the correct workspace)
UPDATE activity_log al
SET workspace_id = (
    SELECT w.id FROM workspaces w
    WHERE w.user_id = al.user_id
    ORDER BY w.created_at ASC
    LIMIT 1
)
WHERE al.workspace_id IS NULL;

-- Confirm counts
SELECT
    (SELECT COUNT(*) FROM dm_buffer) AS dm_buffer_rows,
    (SELECT COUNT(*) FROM activity_log WHERE workspace_id IS NOT NULL) AS activity_rows_tagged,
    (SELECT COUNT(*) FROM activity_log WHERE workspace_id IS NULL) AS activity_rows_untagged;
