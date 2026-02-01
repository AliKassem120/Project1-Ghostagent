-- 1. USERS TABLE (Public Profile)
-- This table mirrors auth.users to allow public/app-level access to user data
create table if not exists users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on RLS
alter table users enable row level security;

-- Policies
create policy "Users can view their own profile" on users for select using (auth.uid() = id);
create policy "Users can update their own profile" on users for update using (auth.uid() = id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, created_at)
  values (new.id, new.email, new.created_at);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on new auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. BOT SETTINGS TABLE
create table if not exists bot_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null, -- References public.users now
  business_name text,
  tone text default 'Professional',
  system_instructions text,
  whatsapp_template text,
  emergency_whatsapp text,
  language text default 'English',
  max_discount integer default 20,
  min_order_for_discount integer default 50,
  use_emojis boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_user_settings unique (user_id)
);

alter table bot_settings enable row level security;

create policy "Users can view their own settings" on bot_settings for select using (auth.uid() = user_id);
create policy "Users can insert their own settings" on bot_settings for insert with check (auth.uid() = user_id);
create policy "Users can update their own settings" on bot_settings for update using (auth.uid() = user_id);


-- 3. INVENTORY TABLE
create table if not exists inventory (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  item_name text not null,
  stock_level integer default 0,
  price numeric(10, 2) default 0.00,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table inventory enable row level security;

create policy "Users can view their own inventory" on inventory for select using (auth.uid() = user_id);
create policy "Users can insert their own inventory" on inventory for insert with check (auth.uid() = user_id);
create policy "Users can update their own inventory" on inventory for update using (auth.uid() = user_id);
create policy "Users can delete their own inventory" on inventory for delete using (auth.uid() = user_id);


-- 4. ACTIVITY LOG TABLE
create table if not exists activity_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  event_type text not null, -- e.g., 'SALE', 'LOGIN', 'ERROR'
  description text,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table activity_log enable row level security;

create policy "Users can view their own activity" on activity_log for select using (auth.uid() = user_id);
create policy "Users can insert their own activity" on activity_log for insert with check (auth.uid() = user_id);
