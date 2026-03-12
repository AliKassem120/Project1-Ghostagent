-- ═══════════════════════════════════════════════════════════════
-- 🚀 GHOST AGENT — MULTI-TENANCY ISOLATION (ROBUST)
-- ═══════════════════════════════════════════════════════════════

-- 1. ADD workspace_id TO EXISTING TABLES
-- This logic adds the column only if the table exists, avoiding "relation does not exist" errors.

DO $$ 
BEGIN
    -- INVENTORY (Core Ecommerce)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inventory') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'workspace_id') THEN
            ALTER TABLE inventory ADD COLUMN workspace_id UUID REFERENCES ai_settings(id) ON DELETE CASCADE;
            UPDATE inventory SET workspace_id = (SELECT id FROM ai_settings WHERE user_id = inventory.user_id LIMIT 1) WHERE workspace_id IS NULL;
            ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
        END IF;
    END IF;

    -- PROPERTIES (Real Estate)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'properties') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'workspace_id') THEN
            ALTER TABLE properties ADD COLUMN workspace_id UUID REFERENCES ai_settings(id) ON DELETE CASCADE;
            UPDATE properties SET workspace_id = (SELECT id FROM ai_settings WHERE user_id = properties.user_id LIMIT 1) WHERE workspace_id IS NULL;
            ALTER PUBLICATION supabase_realtime ADD TABLE properties;
        END IF;
    END IF;

    -- MENU ITEMS (Food & Beverage)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'menu_items') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'workspace_id') THEN
            ALTER TABLE menu_items ADD COLUMN workspace_id UUID REFERENCES ai_settings(id) ON DELETE CASCADE;
            UPDATE menu_items SET workspace_id = (SELECT id FROM ai_settings WHERE user_id = menu_items.user_id LIMIT 1) WHERE workspace_id IS NULL;
            ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
        END IF;
    END IF;

    -- EVENTS (Events & Ticketing)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'events') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'workspace_id') THEN
            ALTER TABLE events ADD COLUMN workspace_id UUID REFERENCES ai_settings(id) ON DELETE CASCADE;
            UPDATE events SET workspace_id = (SELECT id FROM ai_settings WHERE user_id = events.user_id LIMIT 1) WHERE workspace_id IS NULL;
            ALTER PUBLICATION supabase_realtime ADD TABLE events;
        END IF;
    END IF;

    -- ORDERS (Commerce Leads)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'orders') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'workspace_id') THEN
            ALTER TABLE orders ADD COLUMN workspace_id UUID REFERENCES ai_settings(id) ON DELETE CASCADE;
            UPDATE orders SET workspace_id = (SELECT id FROM ai_settings WHERE user_id = orders.user_id LIMIT 1) WHERE workspace_id IS NULL;
        END IF;
    END IF;

    -- SERVICES (Vertical specific)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'services') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'workspace_id') THEN
            ALTER TABLE services ADD COLUMN workspace_id UUID REFERENCES ai_settings(id) ON DELETE CASCADE;
            UPDATE services SET workspace_id = (SELECT id FROM ai_settings WHERE user_id = services.user_id LIMIT 1) WHERE workspace_id IS NULL;
        END IF;
    END IF;

    -- ACTIVITY LOG (Traceability)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'activity_log') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'activity_log' AND column_name = 'workspace_id') THEN
            ALTER TABLE activity_log ADD COLUMN workspace_id UUID REFERENCES ai_settings(id) ON DELETE CASCADE;
            UPDATE activity_log SET workspace_id = (SELECT id FROM ai_settings WHERE user_id = activity_log.user_id LIMIT 1) WHERE workspace_id IS NULL;
        END IF;
    END IF;
    -- CONVERSATIONS (Rolling Memory)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'conversations') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'workspace_id') THEN
            ALTER TABLE conversations ADD COLUMN workspace_id UUID REFERENCES ai_settings(id) ON DELETE CASCADE;
            UPDATE conversations SET workspace_id = (SELECT id FROM ai_settings WHERE user_id = conversations.owner_id LIMIT 1) WHERE workspace_id IS NULL;
            
            -- Update unique constraint to include workspace_id
            ALTER TABLE conversations DROP CONSTRAINT IF EXISTS unique_conversation;
            ALTER TABLE conversations ADD CONSTRAINT unique_conversation UNIQUE (workspace_id, external_chat_id);
        END IF;
    END IF;
END $$;
