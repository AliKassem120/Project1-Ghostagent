-- GhostAgent automation reliability patch.
-- Idempotent schema support for transactional safety, channel parity, and God Mode traces.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS variant_label text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS platform text DEFAULT 'instagram';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS chat_id text;

UPDATE public.orders
SET chat_id = instagram_user_id
WHERE chat_id IS NULL
  AND instagram_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_workspace_chat_idx
    ON public.orders (workspace_id, chat_id);

CREATE INDEX IF NOT EXISTS orders_workspace_instagram_user_idx
    ON public.orders (workspace_id, instagram_user_id);

CREATE INDEX IF NOT EXISTS orders_workspace_status_idx
    ON public.orders (workspace_id, status);

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS platform text DEFAULT 'instagram';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS chat_id text;

UPDATE public.appointments
SET chat_id = instagram_user_id
WHERE chat_id IS NULL
  AND instagram_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS appointments_workspace_chat_idx
    ON public.appointments (workspace_id, chat_id);

CREATE INDEX IF NOT EXISTS appointments_workspace_instagram_user_idx
    ON public.appointments (workspace_id, instagram_user_id);

CREATE INDEX IF NOT EXISTS appointments_workspace_status_idx
    ON public.appointments (workspace_id, status);

CREATE TABLE IF NOT EXISTS public.automation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid,
    user_id uuid,
    platform text,
    chat_id text,
    incoming_message text,
    buffered_message text,
    state_before text,
    state_after text,
    intent text,
    actions jsonb DEFAULT '[]'::jsonb,
    db_write_attempted boolean DEFAULT false,
    db_write_success boolean DEFAULT false,
    order_id text,
    appointment_id text,
    reply_before_guard text,
    reply_after_guard text,
    blocked_reason text,
    source_path text,
    error text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_runs_workspace_created_idx
    ON public.automation_runs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS automation_runs_chat_created_idx
    ON public.automation_runs (chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS automation_runs_platform_idx
    ON public.automation_runs (platform);

ALTER TABLE public.dm_buffer ADD COLUMN IF NOT EXISTS workspace_id uuid;

ALTER TABLE public.dm_buffer
    DROP CONSTRAINT IF EXISTS dm_buffer_owner_id_sender_id_channel_key;

CREATE UNIQUE INDEX IF NOT EXISTS dm_buffer_owner_workspace_sender_channel_key
    ON public.dm_buffer (
        owner_id,
        COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid),
        sender_id,
        channel
    );

CREATE INDEX IF NOT EXISTS dm_buffer_workspace_claim_idx
    ON public.dm_buffer (owner_id, workspace_id, sender_id, channel, status, reply_at);

DROP FUNCTION IF EXISTS public.claim_dm_buffer(uuid, text, text, timestamptz, integer);

CREATE OR REPLACE FUNCTION public.claim_dm_buffer(
    p_owner_id uuid,
    p_sender_id text,
    p_channel text,
    p_workspace_id uuid DEFAULT NULL,
    p_scheduled_reply_at timestamptz DEFAULT NULL,
    p_lock_ttl_seconds integer DEFAULT 60
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
      AND (
          (p_workspace_id IS NULL AND public.dm_buffer.workspace_id IS NULL)
          OR public.dm_buffer.workspace_id = p_workspace_id
      )
      AND status = 'waiting'
      AND reply_at = p_scheduled_reply_at
      AND (lock_expires_at IS NULL OR lock_expires_at < v_now)
    RETURNING
        public.dm_buffer.buffered_text,
        public.dm_buffer.workspace_id;
END;
$$;
