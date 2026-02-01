-- Create the bot_settings table
create table if not exists bot_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
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
  
  -- Add a constraint to ensure one settings row per user
  constraint unique_user_settings unique (user_id)
);

-- Turn on Row Level Security
alter table bot_settings enable row level security;

-- Create policies
create policy "Users can view their own settings"
  on bot_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own settings"
  on bot_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own settings"
  on bot_settings for update
  using (auth.uid() = user_id);
