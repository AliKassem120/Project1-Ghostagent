-- Create business_knowledge table for storing CSV product catalog data
CREATE TABLE IF NOT EXISTS business_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT business_knowledge_user_id_key UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE business_knowledge ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access their own knowledge data
CREATE POLICY "Users can view their own knowledge" ON business_knowledge
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own knowledge" ON business_knowledge
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge" ON business_knowledge
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge" ON business_knowledge
    FOR DELETE USING (auth.uid() = user_id);
