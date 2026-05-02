-- Align conversation_states schema with Automation V2 state manager.
-- The V2 code reads/writes platform and external_chat_id, and scopes state by platform.

alter table public.conversation_states
add column if not exists platform text not null default 'instagram';

alter table public.conversation_states
add column if not exists external_chat_id text;

alter table public.conversation_states
    drop constraint if exists conversation_states_unique_constraint;

alter table public.conversation_states
    add constraint conversation_states_unique_constraint
    unique (user_id, workspace_id, chat_id, workspace_type, platform);

create index if not exists conversation_states_user_workspace_chat_platform_idx
    on public.conversation_states (user_id, workspace_id, chat_id, workspace_type, platform);
