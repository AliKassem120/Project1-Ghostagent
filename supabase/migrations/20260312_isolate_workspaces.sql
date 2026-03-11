-- 1. AI Settings (Replaces bot_settings, acts as the definitive Workspace record)
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY, -- This acts as the workspace_id
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Identity
  name TEXT, -- Workspace name
  business_name TEXT,
  business_type TEXT DEFAULT 'ecommerce',
  
  -- AI Configuration
  tone TEXT DEFAULT 'Professional',
  system_instructions TEXT,
  language TEXT DEFAULT 'Auto-Detect',
  use_local_slang BOOLEAN DEFAULT false,
  use_emojis BOOLEAN DEFAULT true,
  is_autopilot_enabled BOOLEAN DEFAULT true,
  
  -- Handoff & Omnichannel
  emergency_whatsapp TEXT,
  handoff_keywords TEXT[] DEFAULT '{}',
  whatsapp_template TEXT,
  whatsapp_business_account_id TEXT,
  whatsapp_phone_number_id TEXT,
  whatsapp_access_token TEXT,
  
  -- Business Rules
  max_discount INTEGER DEFAULT 20,
  min_order_for_discount INTEGER DEFAULT 50,
  store_location TEXT,
  contact_info TEXT,
  shipping_rules TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own ai_settings" ON ai_settings;
CREATE POLICY "Users can view own ai_settings" ON ai_settings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own ai_settings" ON ai_settings;
CREATE POLICY "Users can insert own ai_settings" ON ai_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own ai_settings" ON ai_settings;
CREATE POLICY "Users can update own ai_settings" ON ai_settings FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own ai_settings" ON ai_settings;
CREATE POLICY "Users can delete own ai_settings" ON ai_settings FOR DELETE USING (auth.uid() = user_id);

-- 2. Instagram Integrations (Replaces user_connections, isolated by workspace_id)
CREATE TABLE IF NOT EXISTS instagram_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES ai_settings(id) ON DELETE CASCADE,
  instagram_account_id TEXT NOT NULL,
  account_username TEXT,
  access_token TEXT NOT NULL,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(workspace_id, instagram_account_id) -- Ensures 1:1 or 1:Many but strict isolation
);

ALTER TABLE instagram_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage integrations through their workspace" ON instagram_integrations;
CREATE POLICY "Users can manage integrations through their workspace" ON instagram_integrations
FOR ALL
USING (
  workspace_id IN (
    SELECT id FROM ai_settings WHERE user_id = auth.uid()
  )
);

-- Backfill data (Optional migration of old bot_settings to ai_settings)
INSERT INTO ai_settings (id, user_id, name, business_name, business_type, tone, system_instructions, language, use_local_slang, use_emojis, emergency_whatsapp, handoff_keywords, whatsapp_template, whatsapp_business_account_id, whatsapp_phone_number_id, whatsapp_access_token, max_discount, min_order_for_discount, store_location, contact_info, shipping_rules, created_at, updated_at)
SELECT id, user_id, name, business_name, business_type, tone, system_instructions, language, use_local_slang, use_emojis, emergency_whatsapp, handoff_keywords, whatsapp_template, whatsapp_business_account_id, whatsapp_phone_number_id, whatsapp_access_token, max_discount, min_order_for_discount, store_location, contact_info, shipping_rules, created_at, updated_at
FROM bot_settings
ON CONFLICT DO NOTHING;

-- Backfill data (Optional migration of old user_connections to instagram_integrations, IF workspace_id was populated)
-- We will only migrate if workspace_id was populated in user_connections (many might be null)
-- Because instagram_integrations requires workspace_id to not be null.
INSERT INTO instagram_integrations (workspace_id, instagram_account_id, account_username, access_token, connected_at)
SELECT workspace_id, account_id, account_username, metadata->>'access_token', connected_at
FROM user_connections
WHERE provider = 'INSTAGRAM' AND workspace_id IS NOT NULL AND metadata->>'access_token' IS NOT NULL
ON CONFLICT DO NOTHING;
