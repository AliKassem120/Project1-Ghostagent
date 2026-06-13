-- ============================================================
-- Migration: Clean contaminated test memory data
-- Date: 2026-06-13
-- Reason: Brain restructure — purge cross-session memory
--         pollution accumulated during testing.
--
-- SAFE TO RUN: Only deletes memory/notes/state rows.
--              Does NOT touch orders, appointments, profiles,
--              billing, or any user account data.
-- ============================================================

-- 1. Clear all conversation summaries (these were generated from
--    mixed test runs and are no longer reliable)
DELETE FROM conversation_summaries;

-- 2. Clear all customer notes extracted by the AI
--    (contaminated with Arabizi/Arabic from old test sessions)
DELETE FROM customer_notes WHERE source = 'auto';

-- 3. Reset all active conversation FSM states so every chat
--    starts fresh on next message (session-manager will create
--    new sessionId + sessionStartedAt on first contact)
DELETE FROM conversation_states;

-- Done. The restructured session-manager will now generate
-- fresh sessionId UUIDs and scope all memory writes to the
-- current session boundary going forward.
