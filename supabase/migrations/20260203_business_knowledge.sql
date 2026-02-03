-- SAFE MIGRATION: Handles existing policies and adds the required constraint

-- 1. Drop existing policies to avoid "already exists" errors
DROP POLICY IF EXISTS "Users can view their own knowledge" ON business_knowledge;
DROP POLICY IF EXISTS "Users can insert their own knowledge" ON business_knowledge;
DROP POLICY IF EXISTS "Users can update their own knowledge" ON business_knowledge;
DROP POLICY IF EXISTS "Users can delete their own knowledge" ON business_knowledge;

-- 2. Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS business_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ensure the UNIQUE constraint exists (Required for Upsert)
-- We drop it first to ensure we can recreate it cleanly without error if it slightly differs
ALTER TABLE business_knowledge DROP CONSTRAINT IF EXISTS business_knowledge_user_id_key;
ALTER TABLE business_knowledge ADD CONSTRAINT business_knowledge_user_id_key UNIQUE (user_id);

-- 4. Enable RLS
ALTER TABLE business_knowledge ENABLE ROW LEVEL SECURITY;

-- 5. Re-create the policies
CREATE POLICY "Users can view their own knowledge" ON business_knowledge
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own knowledge" ON business_knowledge
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge" ON business_knowledge
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge" ON business_knowledge
    FOR DELETE USING (auth.uid() = user_id);
