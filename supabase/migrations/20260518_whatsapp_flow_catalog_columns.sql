-- Add WhatsApp Booking Flow ID and Catalog ID columns to ai_settings
-- These store Meta's Flow ID and Commerce Catalog ID per workspace

ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS whatsapp_booking_flow_id TEXT;
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS whatsapp_catalog_id TEXT;
