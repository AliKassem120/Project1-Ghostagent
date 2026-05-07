-- ═══════════════════════════════════════════════════════════════
-- Fix: Add 'saas_support' to conversation_states workspace_type check
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE conversation_states DROP CONSTRAINT IF EXISTS conversation_states_workspace_type_check;

ALTER TABLE conversation_states ADD CONSTRAINT conversation_states_workspace_type_check
  CHECK (workspace_type IN (
    'appointments', 'ecommerce', 'saas_support'
  ));

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
