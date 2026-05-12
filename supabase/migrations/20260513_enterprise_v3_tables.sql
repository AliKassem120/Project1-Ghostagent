-- ═══════════════════════════════════════════════════════════════
-- GhostAgent — Enterprise V3 Tables
-- ═══════════════════════════════════════════════════════════════
-- New tables for Phase 2: handoff queue, suspended users,
-- metrics, experiment results, customer profiles.

-- ── Handoff Queue ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS handoff_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'instagram',
    priority TEXT NOT NULL DEFAULT 'medium',
    reason TEXT,
    conversation_summary TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    recent_messages JSONB,
    current_state TEXT,
    actions_taken JSONB,
    status TEXT NOT NULL DEFAULT 'pending',
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handoff_queue_workspace
    ON handoff_queue(workspace_id, status, created_at DESC);

-- ── Suspended Users ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suspended_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'instagram',
    reason TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    suspended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    suspended_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suspended_users_unique
    ON suspended_users(workspace_id, chat_id, platform) WHERE is_active = true;

-- ── Metrics ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'instagram',
    engine_version TEXT NOT NULL DEFAULT 'v3',
    total_duration_ms INTEGER,
    classification_ms INTEGER,
    llm_generation_ms INTEGER,
    intent TEXT,
    intent_source TEXT,
    intent_confidence REAL,
    state_before TEXT,
    state_after TEXT,
    loop_detected BOOLEAN DEFAULT false,
    loop_count INTEGER DEFAULT 0,
    template_used BOOLEAN DEFAULT false,
    template_key TEXT,
    llm_call_count INTEGER DEFAULT 0,
    actions JSONB,
    handoff_created BOOLEAN DEFAULT false,
    order_created BOOLEAN DEFAULT false,
    appointment_created BOOLEAN DEFAULT false,
    error TEXT,
    rate_limited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_workspace_time
    ON metrics(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_intent
    ON metrics(workspace_id, intent, created_at DESC);

-- ── Customer Profiles (Phase 3 prep) ─────────────────────────
CREATE TABLE IF NOT EXISTS customer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL,
    phone TEXT,
    instagram_chat_id TEXT,
    whatsapp_chat_id TEXT,
    name TEXT,
    email TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    total_orders INTEGER DEFAULT 0,
    total_appointments INTEGER DEFAULT 0,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_profiles_ig
    ON customer_profiles(workspace_id, instagram_chat_id) WHERE instagram_chat_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_profiles_wa
    ON customer_profiles(workspace_id, whatsapp_chat_id) WHERE whatsapp_chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone
    ON customer_profiles(workspace_id, phone) WHERE phone IS NOT NULL;

-- ── Experiment Results (Phase 3 prep) ────────────────────────
CREATE TABLE IF NOT EXISTS experiment_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL,
    experiment_name TEXT NOT NULL,
    variant TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    outcome TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiment_results_lookup
    ON experiment_results(workspace_id, experiment_name, created_at DESC);

-- ── Message Deduplication (Phase 3 Hardening) ────────────────
CREATE TABLE IF NOT EXISTS message_dedup (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Failed Jobs / Dead Letters (Phase 3 Hardening) ───────────
CREATE TABLE IF NOT EXISTS failed_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_payload JSONB NOT NULL,
    error TEXT,
    retry_count INT DEFAULT 0,
    status TEXT DEFAULT 'failed',
    created_at TIMESTAMPTZ DEFAULT now()
);
