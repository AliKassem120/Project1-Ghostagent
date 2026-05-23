-- ═══════════════════════════════════════════════════════════════
-- Fix customer table constraints
-- ═══════════════════════════════════════════════════════════════
-- 1. customers: drop FK to workspaces (workspace may exist in
--    instagram_integrations but not in workspaces table)
-- 2. customers: ensure UNIQUE constraint exists on (workspace_id, chat_id)
-- 3. customer_profiles: add real UNIQUE constraints (not just partial indexes)
--    so Supabase onConflict works correctly

-- ── 1. Drop the FK on customers.workspace_id ────────────────
--    The workspace_id comes from instagram_integrations which
--    doesn't require a matching row in workspaces.
ALTER TABLE customers
    DROP CONSTRAINT IF EXISTS customers_workspace_id_fkey;

-- ── 2. Ensure unique constraint on customers ────────────────
--    The migration already has UNIQUE(workspace_id, chat_id)
--    but add it idempotently in case migration didn't run
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'customers_workspace_id_chat_id_key'
          AND conrelid = 'customers'::regclass
    ) THEN
        ALTER TABLE customers
            ADD CONSTRAINT customers_workspace_id_chat_id_key
            UNIQUE (workspace_id, chat_id);
    END IF;
END $$;

-- ── 3. Add real UNIQUE constraints on customer_profiles ─────
--    The existing partial unique indexes (WHERE col IS NOT NULL)
--    don't satisfy Supabase's onConflict. Add proper constraints.
ALTER TABLE customer_profiles
    DROP CONSTRAINT IF EXISTS customer_profiles_ws_ig_unique;

ALTER TABLE customer_profiles
    ADD CONSTRAINT customer_profiles_ws_ig_unique
    UNIQUE (workspace_id, instagram_chat_id);

ALTER TABLE customer_profiles
    DROP CONSTRAINT IF EXISTS customer_profiles_ws_wa_unique;

ALTER TABLE customer_profiles
    ADD CONSTRAINT customer_profiles_ws_wa_unique
    UNIQUE (workspace_id, whatsapp_chat_id);
