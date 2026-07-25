-- Ask AI: persisted chat conversations + messages, shared by web and mobile
-- (same backend, same Supabase project, so a row created from either client
-- is immediately visible to the other — this is the entire "sync" story).
-- Safe to re-run: idempotent (IF NOT EXISTS).

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index if not exists ai_conversations_user_id_idx on public.ai_conversations(user_id);
create index if not exists ai_conversations_user_last_message_idx
  on public.ai_conversations(user_id, last_message_at desc);

-- user_id is denormalized here (derivable via conversation_id) so db.js can
-- double-scope every query by .eq('user_id', userId) directly, matching the
-- makeEntityHelpers() convention used by every other user-owned table.
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_conversation_id_idx on public.ai_messages(conversation_id);
create index if not exists ai_messages_conversation_created_idx
  on public.ai_messages(conversation_id, created_at);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
