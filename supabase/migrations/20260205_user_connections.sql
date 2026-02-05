-- Create user_connections table to store social account connections
CREATE TABLE IF NOT EXISTS user_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'INSTAGRAM', 'WHATSAPP', etc.
    account_id VARCHAR(255) NOT NULL UNIQUE, -- Unipile account_id
    account_username VARCHAR(255), -- Instagram username or similar
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB, -- Store any additional Unipile data
    UNIQUE(user_id, provider) -- One connection per provider per user
);

-- Enable RLS
ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own connections
CREATE POLICY "Users can view own connections"
    ON user_connections
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: System can insert (for webhook)
CREATE POLICY "System can insert connections"
    ON user_connections
    FOR INSERT
    WITH CHECK (true);

-- Index for faster lookups
CREATE INDEX idx_user_connections_user_id ON user_connections(user_id);
CREATE INDEX idx_user_connections_account_id ON user_connections(account_id);
