-- Add metadata column to activity_log for storing webhook details
ALTER TABLE activity_log 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
