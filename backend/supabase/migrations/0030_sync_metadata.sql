-- Offline-first mobile sync support. Purely additive — the web app never
-- reads `updated_at`, never sends a client `id` or `baseUpdatedAt`, and never
-- calls /api/changes, so its behaviour is unchanged.
--
-- Two pieces:
--   1. an `updated_at` column (auto-touched by trigger) on every entity the
--      mobile app mirrors locally, so the client can tell "the server row
--      moved under me" from "nothing changed" and resolve write conflicts.
--   2. a `sync_tombstones` table recording deletes, so a device that was
--      offline when a row was deleted (here or on another device) learns
--      about it on its next pull instead of silently keeping the stale row.
--
-- Same conventions as every migration here: idempotent (IF NOT EXISTS /
-- CREATE OR REPLACE), applied out of band via the Supabase SQL editor or
-- `supabase db push`. backend/src/db.js degrades gracefully until this is
-- applied (missing-column / missing-table detection), so deploy order is not
-- load-bearing.

-- ---------------------------------------------------------------------------
-- 1. updated_at on the mirrored entity tables
-- ---------------------------------------------------------------------------
alter table public.transactions add column if not exists updated_at timestamptz not null default now();
alter table public.accounts     add column if not exists updated_at timestamptz not null default now();
alter table public.categories   add column if not exists updated_at timestamptz not null default now();
alter table public.budgets      add column if not exists updated_at timestamptz not null default now();
alter table public.goals        add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_updated_at on public.transactions;
create trigger trg_touch_updated_at before update on public.transactions
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_updated_at on public.accounts;
create trigger trg_touch_updated_at before update on public.accounts
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_updated_at on public.categories;
create trigger trg_touch_updated_at before update on public.categories
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_updated_at on public.budgets;
create trigger trg_touch_updated_at before update on public.budgets
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_updated_at on public.goals;
create trigger trg_touch_updated_at before update on public.goals
  for each row execute function public.touch_updated_at();

create index if not exists transactions_user_updated_idx on public.transactions (user_id, updated_at);
create index if not exists accounts_user_updated_idx     on public.accounts (user_id, updated_at);
create index if not exists categories_user_updated_idx   on public.categories (user_id, updated_at);
create index if not exists budgets_user_updated_idx      on public.budgets (user_id, updated_at);
create index if not exists goals_user_updated_idx        on public.goals (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- 2. sync_tombstones — one row per deleted entity, written app-side in
--    db.js makeEntityHelpers.remove().
-- ---------------------------------------------------------------------------
create table if not exists public.sync_tombstones (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,          -- 'transaction' | 'account' | 'category' | 'budget' | 'goal'
  entity_id uuid not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);
create index if not exists sync_tombstones_user_deleted_idx
  on public.sync_tombstones (user_id, deleted_at);

-- Same "enabled, zero policies" posture as every other table (0001_init.sql):
-- Express uses the service-role key and bypasses RLS; the anon key must never
-- reach this table.
alter table public.sync_tombstones enable row level security;
