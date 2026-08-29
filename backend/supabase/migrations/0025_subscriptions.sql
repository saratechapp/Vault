-- Admin-controlled free-trial / subscription system.
--
-- Two parts, same conventions as every migration here (idempotent, RLS
-- enabled with zero policies — the service-role backend bypasses RLS, the
-- anon key never touches these tables; applied out of band via the Supabase
-- SQL editor / `supabase db push`):
--
--   1. subscription_settings — ONE global row the Super Admin edits: is the
--      trial system on, how long is a trial, and (crucially) WHEN was it
--      switched on. `enforcement_started_at` is the grandfather cutoff:
--      accounts created before it keep free access forever; accounts created
--      after it get an automatic trial. Nothing computes trial state from a
--      hardcoded calendar date — it all keys off this row.
--
--   2. profiles.subscription_* — additive nullable columns for each user's
--      subscription record, exactly the "extend the proven 1:1 profiles row"
--      pattern used by 0010/0011/0014/0019/0020. `subscription_type` is the
--      stored intent (FREE_ACCESS | FREE_TRIAL | ACTIVE | CANCELLED);
--      EXPIRED is DERIVED from the dates at read time (backend
--      subscriptionService.computeStatus), never written here.
--
-- No trigger changes: handle_new_user() is left alone. A new user's initial
-- subscription record is created lazily and self-healingly on their first
-- authenticated request (backend db.resolveForUser), the same shape as the
-- existing has_password backfill.

-- ---------------------------------------------------------------------------
-- 1. Global settings — a single enforced row.
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_settings (
  id boolean primary key default true,
  trial_enabled boolean not null default false,
  trial_duration_months int not null default 1,
  enforcement_started_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint subscription_settings_single_row check (id),
  constraint subscription_settings_duration_range check (trial_duration_months between 1 and 12)
);

insert into public.subscription_settings (id) values (true) on conflict (id) do nothing;

alter table public.subscription_settings enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Per-user subscription record — additive columns on profiles.
--    All nullable, no default, so every historical row is untouched and
--    reads back as "not resolved yet" until the backend fills it in.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists subscription_type text;
alter table public.profiles add column if not exists trial_started_at timestamptz;
alter table public.profiles add column if not exists trial_ends_at timestamptz;
alter table public.profiles add column if not exists subscription_started_at timestamptz;
alter table public.profiles add column if not exists subscription_ends_at timestamptz;
alter table public.profiles add column if not exists subscription_updated_at timestamptz;

-- Backs the admin Subscriptions > Users list (filter/sort by trial expiry).
create index if not exists profiles_trial_ends_at_idx on public.profiles(trial_ends_at);
