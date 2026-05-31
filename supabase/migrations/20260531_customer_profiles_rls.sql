-- RLS for customer_profiles
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage customer profiles through their workspace" ON customer_profiles;
CREATE POLICY "Users can manage customer profiles through their workspace" ON customer_profiles
FOR ALL
USING (
    workspace_id IN (
        SELECT id::text FROM ai_settings WHERE user_id = auth.uid()
    )
);
