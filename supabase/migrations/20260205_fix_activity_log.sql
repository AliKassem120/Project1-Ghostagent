-- Add metadata column to activity_log for storing webhook details
ALTER TABLE activity_log 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Allow users to delete their own logs (for Clear Feed button)
CREATE POLICY "Users can delete their own activity logs"
ON activity_log FOR DELETE
USING (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
