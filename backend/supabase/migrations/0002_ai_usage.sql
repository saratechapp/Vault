-- AI request usage counter, one row per user per day. Backs the
-- aiRequestsPerDay limit in backend/plans.js — Free's limit is currently
-- Infinity so this never blocks anything yet, but the counter is live from
-- day one so turning on a real cap later is a config-only change.
-- Safe to re-run: idempotent (IF NOT EXISTS).

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
