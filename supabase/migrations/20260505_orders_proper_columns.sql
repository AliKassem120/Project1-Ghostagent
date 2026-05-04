-- ═══════════════════════════════════════════════════════════════
-- Ghost Agent — Orders Schema Enhancement
-- Adds proper columns for variant, quantity, and unit_price
-- so they can be queried/sorted directly instead of parsing JSON.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE orders ADD COLUMN IF NOT EXISTS variant_label TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS unit_price NUMERIC DEFAULT 0;

-- Backfill from raw_message JSON for existing orders
UPDATE orders
SET
    variant_label = COALESCE((raw_message::jsonb)->>'item_variant', variant_label),
    quantity = COALESCE(((raw_message::jsonb)->>'quantity')::integer, quantity, 1),
    unit_price = COALESCE(((raw_message::jsonb)->>'unit_price')::numeric, unit_price, 0)
WHERE raw_message IS NOT NULL
  AND raw_message != ''
  AND variant_label IS NULL;

-- Index for dashboard filtering
CREATE INDEX IF NOT EXISTS idx_orders_variant ON orders(workspace_id, variant_label);
