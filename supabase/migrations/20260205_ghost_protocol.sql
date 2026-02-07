-- 1. Upgrade Bot Settings for Ghost Protocol
ALTER TABLE bot_settings 
ADD COLUMN IF NOT EXISTS urgency_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS handoff_keywords TEXT[] DEFAULT '{}';

-- 2. Create Conversations table for state management (Muting/Interjection)
CREATE TABLE IF NOT EXISTS conversation_states (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'INSTAGRAM'
    external_chat_id TEXT NOT NULL, -- Unipile Chat ID
    external_username TEXT, -- Customer username
    is_muted BOOLEAN DEFAULT false,
    muted_until TIMESTAMPTZ,
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, external_chat_id)
);

-- Enable RLS
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can manage their own conversations" ON conversation_states;
CREATE POLICY "Users can manage their own conversations"
ON conversation_states FOR ALL
USING (auth.uid() = user_id);
