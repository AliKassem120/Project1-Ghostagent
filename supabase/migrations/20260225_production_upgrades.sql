-- ═══════════════════════════════════════════════════════════════
-- 🚀 GHOST AGENT — PRODUCTION UPGRADE MIGRATION
-- Run this in the Supabase SQL Editor (or via CLI migration)
-- Date: 2026-02-25
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════
-- 1. DYNAMIC BUSINESS PROFILES
-- ═══════════════════════════
-- Adds a business_type column to bot_settings so each tenant
-- can be classified as 'ecommerce' or 'service'. This drives
-- dynamic system prompt generation (sell products vs book services).

ALTER TABLE public.bot_settings
ADD COLUMN IF NOT EXISTS business_type text DEFAULT 'ecommerce'
CHECK (business_type IN ('ecommerce', 'service'));

COMMENT ON COLUMN public.bot_settings.business_type IS
  'Tenant business model: ecommerce (physical products) or service (bookings/calendar)';


-- ═══════════════════════════
-- 2. MESSAGES TABLE (Debouncing)
-- ═══════════════════════════
-- A dedicated messages table to support the batching/debounce
-- pattern. Each incoming webhook inserts a row as 'pending'.
-- After the debounce window, all pending messages for a sender
-- are concatenated and marked 'processed'.

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- The Ghost Agent tenant (business owner)
  owner_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,

  -- The external sender (e.g., Instagram user PSID)
  sender_id text NOT NULL,

  -- The raw message text from the sender
  message_text text NOT NULL,

  -- Platform origin
  platform text DEFAULT 'instagram',

  -- Debounce status: 'pending' → waiting for batch window
  --                  'processed' → already included in a batch
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processed')),

  -- Timestamp of when this message arrived
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for fast debounce queries
CREATE INDEX IF NOT EXISTS idx_messages_debounce
  ON public.messages (owner_id, sender_id, status, created_at DESC);

-- RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to messages"
  ON public.messages FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.messages IS
  'Stores individual incoming messages for batching/debounce before AI processing';


-- ═══════════════════════════
-- 3. CONVERSATIONS TABLE (Rolling Memory)
-- ═══════════════════════════
-- Tracks per-sender conversation state including a rolling
-- context_summary that compresses old chat history into
-- bullet points, preventing token overflow.

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- The Ghost Agent tenant (business owner)
  owner_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,

  -- The external chat participant (e.g., Instagram PSID)
  external_chat_id text NOT NULL,

  -- Platform origin
  platform text DEFAULT 'instagram',

  -- Rolling summary of older messages (bullet points)
  context_summary text,

  -- Total message count for this conversation
  message_count integer DEFAULT 0,

  -- Timestamps
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- One conversation per owner + external chat
  CONSTRAINT unique_conversation UNIQUE (owner_id, external_chat_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_conversations_lookup
  ON public.conversations (owner_id, external_chat_id);

-- RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to conversations"
  ON public.conversations FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.conversations IS
  'Tracks per-sender conversation state with rolling context summary for memory management';


-- ═══════════════════════════════════════════════════════════════
-- ✅ MIGRATION COMPLETE
-- After running, verify with:
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'bot_settings';
--   SELECT * FROM public.messages LIMIT 0;
--   SELECT * FROM public.conversations LIMIT 0;
-- ═══════════════════════════════════════════════════════════════
