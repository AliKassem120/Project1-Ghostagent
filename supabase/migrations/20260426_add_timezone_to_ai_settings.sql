-- Add timezone column to ai_settings
ALTER TABLE ai_settings
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Beirut';

COMMENT ON COLUMN ai_settings.timezone IS 'The IANA timezone for the workspace (e.g. Asia/Beirut). Defaults to Asia/Beirut.';
