-- ═══════════════════════════════════════════════════════════
-- Master Initialization Script
-- Explicit schema definitions, idempotent operations.
-- ═══════════════════════════════════════════════════════════

-- 1. Create public.workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL,
    name                 text NOT NULL DEFAULT 'My Workspace',
    business_type        text NOT NULL DEFAULT 'ecommerce',
    plan_tier            text DEFAULT 'free_trial',
    instagram_account_id text,
    instagram_username   text,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

-- 2. Create public.dm_buffer
CREATE TABLE IF NOT EXISTS public.dm_buffer (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        uuid NOT NULL,
    sender_id       text NOT NULL,
    workspace_id    uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
    channel         text NOT NULL DEFAULT 'instagram',
    buffered_text   text NOT NULL DEFAULT '',
    reply_at        timestamptz NOT NULL,
    status          text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'processing')),
    lock_expires_at timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    UNIQUE (owner_id, sender_id, channel)
);

-- Fix for existing dm_buffer tables that might miss these columns
ALTER TABLE public.dm_buffer ADD COLUMN IF NOT EXISTS lock_expires_at timestamptz;
ALTER TABLE public.dm_buffer ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- Index for the claim query
DROP INDEX IF EXISTS dm_buffer_claim_idx;
CREATE INDEX dm_buffer_claim_idx
    ON public.dm_buffer (owner_id, sender_id, channel, status, reply_at);

-- 3. Alter public.activity_log
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- 4. The Backfill
UPDATE public.activity_log al
SET workspace_id = (
    SELECT w.id FROM public.workspaces w
    WHERE w.user_id = al.user_id
    ORDER BY w.created_at ASC
    LIMIT 1
)
WHERE al.workspace_id IS NULL;

-- 5. Create atomic claim RPC function
-- Bypasses API schema-cache ambiguity using a precise PL/pgSQL bound statement
CREATE OR REPLACE FUNCTION public.claim_dm_buffer(
    p_owner_id uuid,
    p_sender_id text,
    p_channel text,
    p_scheduled_reply_at timestamptz,
    p_lock_ttl_seconds integer
)
RETURNS TABLE (buffered_text text, workspace_id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
    v_now timestamptz := now();
    v_lock_expires timestamptz := v_now + (p_lock_ttl_seconds || ' seconds')::interval;
BEGIN
    RETURN QUERY
    UPDATE public.dm_buffer
    SET status = 'processing',
        lock_expires_at = v_lock_expires,
        updated_at = v_now
    WHERE owner_id = p_owner_id
      AND sender_id = p_sender_id
      AND channel = p_channel
      AND status = 'waiting'
      AND reply_at = p_scheduled_reply_at
      AND (lock_expires_at IS NULL OR lock_expires_at < v_now)
    RETURNING 
        public.dm_buffer.buffered_text, 
        public.dm_buffer.workspace_id;
END;
$$;

-- 6. Verification
SELECT
    (SELECT COUNT(*) FROM public.workspaces) AS workspaces_count,
    (SELECT COUNT(*) FROM public.dm_buffer) AS dm_buffer_count,
    (SELECT COUNT(*) FROM public.activity_log) AS activity_log_total_count,
    (SELECT COUNT(*) FROM public.activity_log WHERE workspace_id IS NOT NULL) AS activity_log_tagged_count;

