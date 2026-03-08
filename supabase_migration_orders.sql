-- ════════════════════════════════════════════════════════
-- Ghost Agent — Orders + Checkout Sessions Migration (v2)
-- Run this FULL script in Supabase SQL Editor
-- ════════════════════════════════════════════════════════

-- 1. ORDERS TABLE (with customer info columns)
create table if not exists orders (
  id                uuid default gen_random_uuid() primary key,
  user_id           uuid references auth.users(id) on delete cascade not null,
  workspace_id      uuid references bot_settings(id) on delete cascade,
  instagram_handle  text not null,
  instagram_user_id text,
  item_requested    text not null,
  customer_name     text,
  customer_phone    text,
  customer_address  text,
  status            text not null default 'Pending'
                      check (status in ('Pending','Contacted','Fulfilled')),
  raw_message       text,
  created_at        timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists orders_workspace_id_idx on orders(workspace_id);
create index if not exists orders_user_id_idx      on orders(user_id);

alter table orders enable row level security;

create policy "Users can view their own orders"
  on orders for select using (auth.uid() = user_id);
create policy "Users can insert their own orders"
  on orders for insert with check (auth.uid() = user_id);
create policy "Users can update their own orders"
  on orders for update using (auth.uid() = user_id);
create policy "Users can delete their own orders"
  on orders for delete using (auth.uid() = user_id);


-- 2. ORDER SESSIONS TABLE (tracks multi-turn checkout in progress)
create table if not exists order_sessions (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid not null,
  workspace_id     uuid,
  sender_id        text not null,                -- Instagram sender ID
  stage            text not null default 'collecting_info'
                     check (stage in ('collecting_info')),
  item_requested   text,
  customer_name    text,
  customer_phone   text,
  customer_address text,
  created_at       timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at       timestamp with time zone default timezone('utc'::text, now()) not null,
  -- One active session per sender per owner
  constraint unique_checkout_session unique (sender_id, user_id)
);

create index if not exists order_sessions_sender_idx on order_sessions(sender_id, user_id);

-- Service role (webhook) bypasses RLS automatically via supabaseAdmin.
-- No RLS needed for order_sessions since only the server writes to it.
