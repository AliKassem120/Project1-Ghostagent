-- Add comment auto-reply settings to ai_settings table
ALTER TABLE ai_settings
ADD COLUMN IF NOT EXISTS comment_auto_reply BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS comment_reply_style TEXT DEFAULT 'public', -- 'public' | 'dm' | 'both'
ADD COLUMN IF NOT EXISTS comment_keywords TEXT[] DEFAULT '{}', -- only reply when these words appear; empty = reply to all
ADD COLUMN IF NOT EXISTS comment_max_per_post INT DEFAULT 0; -- 0 = unlimited
