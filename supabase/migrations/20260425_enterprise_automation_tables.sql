-- Optional but recommended enterprise tables for GhostAgent.
-- These tables let you debug every decision without relying on prompt guessing.

create table if not exists public.automation_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    workspace_id uuid null,
    chat_id text null,
    workspace_type text not null check (workspace_type in ('ecommerce', 'appointments')),
    intent text not null,
    confidence numeric null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

alter table public.automation_events add column if not exists workspace_id uuid null;
alter table public.automation_events add column if not exists chat_id text null;

create index if not exists automation_events_user_created_idx
    on public.automation_events (user_id, created_at desc);

create index if not exists automation_events_workspace_created_idx
    on public.automation_events (workspace_id, created_at desc);

create index if not exists automation_events_chat_created_idx
    on public.automation_events (chat_id, created_at desc);

create table if not exists public.conversation_states (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    workspace_id uuid null,
    chat_id text null,
    workspace_type text not null check (workspace_type in ('ecommerce', 'appointments')),
    stage text not null default 'idle',
    data jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

alter table public.conversation_states add column if not exists workspace_id uuid null;
alter table public.conversation_states add column if not exists chat_id text null;

do $$
begin
  if not exists (select constraint_name from information_schema.table_constraints where table_name = 'conversation_states' and constraint_type = 'UNIQUE' and constraint_name = 'conversation_states_unique_constraint') then
    alter table public.conversation_states add constraint conversation_states_unique_constraint unique (user_id, workspace_id, chat_id, workspace_type);
  end if;
end $$;

create index if not exists conversation_states_user_workspace_chat_idx
    on public.conversation_states (user_id, workspace_id, chat_id, workspace_type);
