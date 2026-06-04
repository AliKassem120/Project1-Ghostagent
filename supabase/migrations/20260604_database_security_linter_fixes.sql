-- ═══════════════════════════════════════════════════════════════
-- GhostAgent — Database Security Linter Fixes & Hardening
-- Date: 2026-06-04
-- ═══════════════════════════════════════════════════════════════
-- Fixes security linter warnings:
-- 1. Sets secure search_path on PL/pgSQL functions (preventing search_path hijacking).
-- 2. Restricts SECURITY DEFINER handle_new_user() execute permissions.
-- 3. Scopes permissive system/service RLS policies specifically to service_role.
-- 4. Silences RLS warnings on internal tables by defining explicit service_role policies.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Enforce Secure search_path on Functions ─────────────────

ALTER FUNCTION public.decrement_stock(uuid, integer) SET search_path = public, pg_catalog;
ALTER FUNCTION public.restore_stock(uuid, integer) SET search_path = public, pg_catalog;
ALTER FUNCTION public.claim_dm_buffer(uuid, text, text, uuid, timestamptz, integer) SET search_path = public, pg_catalog;
ALTER FUNCTION public.safe_book_appointment(uuid, uuid, text, text, text, text, text, text, date, text, text, integer) SET search_path = public, pg_catalog;
ALTER FUNCTION public.safe_reschedule_appointment(uuid, uuid, date, text, text) SET search_path = public, pg_catalog;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'handle_new_user' 
          AND pronamespace = 'public'::regnamespace
    ) THEN
        ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_catalog;
    END IF;
END;
$$;


-- ── 2. Revoke handle_new_user Executable Privileges ────────────

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'handle_new_user' 
          AND pronamespace = 'public'::regnamespace
    ) THEN
        REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
    END IF;
END;
$$;


-- ── 3. Restrict Permissive RLS Policies to service_role ────────

-- public.automation_runs
DROP POLICY IF EXISTS "Service role can insert automation runs" ON public.automation_runs;
CREATE POLICY "Service role can insert automation runs"
    ON public.automation_runs FOR INSERT TO service_role
    WITH CHECK (true);

-- public.conversations
DROP POLICY IF EXISTS "Service role has full access to conversations" ON public.conversations;
CREATE POLICY "Service role has full access to conversations"
    ON public.conversations TO service_role FOR ALL
    USING (true)
    WITH CHECK (true);

-- public.messages
DROP POLICY IF EXISTS "Service role has full access to messages" ON public.messages;
CREATE POLICY "Service role has full access to messages"
    ON public.messages TO service_role FOR ALL
    USING (true)
    WITH CHECK (true);

-- public.user_connections
DROP POLICY IF EXISTS "System can insert connections" ON public.user_connections;
CREATE POLICY "System can insert connections"
    ON public.user_connections FOR INSERT TO service_role
    WITH CHECK (true);


-- ── 4. Set service_role Policies on Private Tables ────────────

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'automation_events',
        'bot_control_flags',
        'business_training_data',
        'dm_buffer',
        'experiment_results',
        'failed_jobs',
        'handoff_queue',
        'message_dedup',
        'metrics',
        'order_sessions',
        'suspended_users'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON public.%I', t);
            EXECUTE format('CREATE POLICY "Service role full access" ON public.%I TO service_role FOR ALL USING (true) WITH CHECK (true)', t);
        END IF;
    END LOOP;
END;
$$;


-- ── 5. Reload PostgREST Cache ─────────────────────────────────
NOTIFY pgrst, 'reload schema';
