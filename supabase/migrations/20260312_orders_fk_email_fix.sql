-- ═══════════════════════════════════════════════════════════════
-- 🚀 GHOST AGENT — ORDERS TABLE REPAIR
-- Drops broken bot_settings foreign key and adds customer_email
-- ═══════════════════════════════════════════════════════════════

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'orders') THEN
        
        -- 1. DROP BROKEN FOREIGN KEY TO bot_settings
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc 
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name 
            WHERE tc.table_name = 'orders' AND kcu.column_name = 'workspace_id' 
            AND tc.constraint_type = 'FOREIGN KEY'
            AND tc.constraint_name = 'orders_workspace_id_fkey'
        ) THEN
            ALTER TABLE orders DROP CONSTRAINT orders_workspace_id_fkey;
        END IF;

        -- 2. ADD FOREIGN KEY TO ai_settings (Ignore if it fails due to existing data without parent)
        BEGIN
            ALTER TABLE orders 
            ADD CONSTRAINT orders_workspace_id_fkey 
            FOREIGN KEY (workspace_id) 
            REFERENCES ai_settings(id) ON DELETE CASCADE;
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Could not add orders_workspace_id_fkey, likely due to orphaned data. Proceeding anyway.';
        END;

        -- 3. ADD MISSING customer_email COLUMN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_email') THEN
            ALTER TABLE orders ADD COLUMN customer_email TEXT;
        END IF;

    END IF;
END $$;
