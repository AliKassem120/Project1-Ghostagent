-- ═══════════════════════════════════════════════════════════════
-- 🚀 GHOST AGENT — BUSINESS KNOWLEDGE MULTI-TENANCY
-- ═══════════════════════════════════════════════════════════════

DO $$ 
BEGIN
    -- 1. ADD workspace_id column
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'business_knowledge' AND column_name = 'workspace_id') THEN
        ALTER TABLE business_knowledge ADD COLUMN workspace_id UUID REFERENCES ai_settings(id) ON DELETE CASCADE;
        
        -- Backfill workspace_id for existing records
        UPDATE business_knowledge 
        SET workspace_id = (SELECT id FROM ai_settings WHERE user_id = business_knowledge.user_id LIMIT 1) 
        WHERE workspace_id IS NULL;
    END IF;

    -- 2. Update Unique Constraint
    -- Drop old user_id-only constraint
    ALTER TABLE business_knowledge DROP CONSTRAINT IF EXISTS business_knowledge_user_id_key;
    
    -- Add new composite constraint
    IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE table_name = 'business_knowledge' AND constraint_name = 'business_knowledge_workspace_key') THEN
        ALTER TABLE business_knowledge ADD CONSTRAINT business_knowledge_workspace_key UNIQUE (user_id, workspace_id);
    END IF;

END $$;
