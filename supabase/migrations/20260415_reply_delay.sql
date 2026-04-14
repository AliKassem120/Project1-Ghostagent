-- Add reply_delay_seconds column to ai_settings
-- Controls how long the bot waits before sending a reply (in seconds)
-- Default 0 = instant reply
ALTER TABLE ai_settings
ADD COLUMN IF NOT EXISTS reply_delay_seconds INTEGER DEFAULT 0;

COMMENT ON COLUMN ai_settings.reply_delay_seconds IS 'Delay in seconds before the bot replies. 0 = instant. Max 900 (15 min).';
