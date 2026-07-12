-- Feedback / support: a submission channel (consumer app) plus an admin
-- triage inbox. Nothing like this existed before this migration.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  -- Snapshotted at submit time so triage survives later profile edits or
  -- account deletion — the ticket shouldn't lose its identity just because
  -- `user_id` goes null.
  user_email text not null default '',
  user_name text not null default '',
  category text not null default 'other',
  subject text not null,
  message text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  assigned_admin_id uuid references public.admins(id) on delete set null,
  platform text,
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists feedback_user_idx on public.feedback(user_id);
create index if not exists feedback_status_idx on public.feedback(status);
create index if not exists feedback_assigned_idx on public.feedback(assigned_admin_id);
create index if not exists feedback_created_idx on public.feedback(created_at desc);

-- Conversation timeline: user-visible replies and admin-only internal notes
-- share one table (`internal` flag) so the detail view is a single ordered
-- query instead of merging two sources.
create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  sender_type text not null,
  user_sender_id uuid references auth.users(id) on delete set null,
  admin_sender_id uuid references public.admins(id) on delete set null,
  body text not null,
  internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists feedback_messages_feedback_idx on public.feedback_messages(feedback_id, created_at);

alter table public.feedback enable row level security;
alter table public.feedback_messages enable row level security;
