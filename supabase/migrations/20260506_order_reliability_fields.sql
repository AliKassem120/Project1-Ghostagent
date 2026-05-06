-- GhostAgent order reliability fields for platform-neutral orders.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS variant_label TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS unit_price NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'instagram';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS chat_id TEXT;

UPDATE orders
SET chat_id = instagram_user_id
WHERE chat_id IS NULL
  AND instagram_user_id IS NOT NULL;

UPDATE orders
SET
    variant_label = COALESCE((raw_message::jsonb)->>'item_variant', variant_label),
    quantity = COALESCE(((raw_message::jsonb)->>'quantity')::integer, quantity, 1),
    unit_price = COALESCE(((raw_message::jsonb)->>'unit_price')::numeric, unit_price, 0),
    platform = COALESCE((raw_message::jsonb)->>'platform', platform, 'instagram')
WHERE raw_message IS NOT NULL
  AND raw_message != '';

CREATE INDEX IF NOT EXISTS idx_orders_workspace_chat_id ON orders(workspace_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_orders_workspace_instagram_user_id ON orders(workspace_id, instagram_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_workspace_status ON orders(workspace_id, status);
