-- ═══════════════════════════════════════════════════════════════
-- GhostAgent — Fix Conversation States Unique Constraint
-- ═══════════════════════════════════════════════════════════════
-- Drops the old unique constraint on (user_id, workspace_id, chat_id, workspace_type)
-- and recreates it to include the platform column, aligning with
-- the multi-channel support requirements.

ALTER TABLE public.conversation_states 
    DROP CONSTRAINT IF EXISTS conversation_states_unique_constraint;

ALTER TABLE public.conversation_states 
    ADD CONSTRAINT conversation_states_unique_constraint 
    UNIQUE (user_id, workspace_id, chat_id, workspace_type, platform);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
