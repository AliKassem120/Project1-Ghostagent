-- Add setup tracking columns to ai_settings
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ;
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS setup_dismissed_at TIMESTAMPTZ;
