-- ════════════════════════════════════════════
-- Ghost Agent — Order Leads Table
-- Run this in Supabase SQL Editor
-- ════════════════════════════════════════════

create table if not exists orders (
  id                uuid default gen_random_uuid() primary key,
  user_id           uuid references auth.users(id) on delete cascade not null,
  workspace_id      uuid references bot_settings(id) on delete cascade,
  instagram_handle  text not null,           -- customer IG username or sender ID
  instagram_user_id text,                    -- raw sender ID from Meta
  item_requested    text not null,           -- extracted item from AI
  status            text not null default 'Pending' check (status in ('Pending','Contacted','Fulfilled')),
  raw_message       text,                    -- original customer message for context
  created_at        timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for fast workspace queries
create index if not exists orders_workspace_id_idx on orders(workspace_id);
create index if not exists orders_user_id_idx      on orders(user_id);

-- Row Level Security
alter table orders enable row level security;

create policy "Users can view their own orders"
  on orders for select using (auth.uid() = user_id);

create policy "Users can insert their own orders"
  on orders for insert with check (auth.uid() = user_id);

create policy "Users can update their own orders"
  on orders for update using (auth.uid() = user_id);

create policy "Users can delete their own orders"
  on orders for delete using (auth.uid() = user_id);

-- ⚠️  Service-role bypass needed for the webhook (server-side inserts)
-- The webhook uses supabaseAdmin (service role key) so it bypasses RLS automatically.
