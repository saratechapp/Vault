-- Wallet app: initial Supabase schema (Database + Auth migration).
-- Run once against your Supabase project (SQL editor, or `supabase db push`).
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / CREATE OR REPLACE).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users) — mirrors backend/server.js's createUser()
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  avatar text not null default '',
  currency text not null default 'INR',
  currency_symbol text not null default '₹',
  member_since date not null default current_date,
  plan text not null default 'Free',
  health_score int not null default 0,
  health_grade text not null default '—',
  two_factor_enabled boolean not null default false,
  biometric_enabled boolean not null default false,
  dashboard_layout jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- entity tables — one row per item, all scoped by user_id
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  parent_id uuid references public.categories(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists categories_parent_id_idx on public.categories(parent_id);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text,
  opening_balance numeric not null default 0,
  color text,
  icon text,
  currency text,
  institution text,
  created_at timestamptz not null default now()
);
create index if not exists accounts_user_id_idx on public.accounts(user_id);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  vendor text,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric not null,
  type text not null,
  payment_method text,
  note text,
  labels text[] not null default '{}',
  payer text,
  payment_status text,
  currency text,
  account_id uuid references public.accounts(id) on delete set null,
  from_account_id uuid references public.accounts(id) on delete set null,
  to_account_id uuid references public.accounts(id) on delete set null,
  source_bill_id uuid,
  source_debt_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_id_idx on public.transactions(user_id);
create index if not exists transactions_user_date_idx on public.transactions(user_id, date desc);
create index if not exists transactions_category_id_idx on public.transactions(category_id);
create index if not exists transactions_account_id_idx on public.transactions(account_id);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  "limit" numeric not null,
  period text not null default 'monthly',
  alert_at int not null default 80,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);
create index if not exists budgets_user_id_idx on public.budgets(user_id);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  amount numeric not null,
  due_date date not null,
  frequency text not null default 'monthly',
  status text not null default 'pending',
  category text,
  category_id uuid references public.categories(id) on delete set null,
  vendor text,
  payment_method text,
  note text,
  auto_post boolean not null default false,
  autopay boolean not null default false,
  active boolean not null default true,
  last_run timestamptz,
  account_id uuid references public.accounts(id) on delete set null,
  from_account_id uuid references public.accounts(id) on delete set null,
  to_account_id uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists bills_user_id_idx on public.bills(user_id);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  target numeric not null,
  saved numeric not null default 0,
  deadline date,
  priority text,
  color text,
  monthly_contribution numeric,
  note text,
  account_id uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists goals_user_id_idx on public.goals(user_id);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  creditor text,
  balance numeric not null default 0,
  apr numeric,
  min_payment numeric,
  due_date date,
  created_at timestamptz not null default now()
);
create index if not exists debts_user_id_idx on public.debts(user_id);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text,
  amount numeric,
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  payment_method text,
  vendor text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists templates_user_id_idx on public.templates(user_id);

-- Sparse read/dismissed overlay for generated notifications (content itself
-- is computed live per-request, unchanged from today's computeGeneratedRows).
create table if not exists public.notification_overlay (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  read boolean not null default false,
  dismissed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------
-- RLS: enabled on every table, zero policies.
-- Express (service-role key) bypasses RLS entirely; the frontend's anon key
-- is only ever used for Supabase Auth calls, never direct table access — so
-- "enabled, no policies" makes these tables unreachable via the anon key,
-- a free defense-in-depth backstop with no policy-authoring risk.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.bills enable row level security;
alter table public.goals enable row level security;
alter table public.debts enable row level security;
alter table public.templates enable row level security;
alter table public.notification_overlay enable row level security;

-- ---------------------------------------------------------------------------
-- New-user seeding: on auth.users insert, create a profiles row (mirroring
-- createUser() defaults) and the default category list (mirroring
-- createSeedUserData().categories / createEmptyUserData() — new users start
-- with default categories and nothing else).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_avatar text;
  v_food_id uuid;
begin
  v_name := coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  v_avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    'https://api.dicebear.com/7.x/initials/svg?seed=' || v_name || '&backgroundColor=6366f1'
  );

  insert into public.profiles (id, name, avatar)
  values (new.id, v_name, v_avatar)
  on conflict (id) do nothing;

  insert into public.categories (id, user_id, name, icon, color, parent_id) values
    (gen_random_uuid(), new.id, 'Salary', 'Banknote', '#22c55e', null),
    (gen_random_uuid(), new.id, 'Freelance', 'Laptop', '#16a34a', null),
    (gen_random_uuid(), new.id, 'Transport', 'Car', '#3b82f6', null),
    (gen_random_uuid(), new.id, 'Shopping', 'ShoppingBag', '#ec4899', null),
    (gen_random_uuid(), new.id, 'Entertainment', 'Film', '#a855f7', null),
    (gen_random_uuid(), new.id, 'Bills & Utilities', 'Receipt', '#ef4444', null),
    (gen_random_uuid(), new.id, 'Health & Fitness', 'HeartPulse', '#14b8a6', null),
    (gen_random_uuid(), new.id, 'Rent', 'Home', '#eab308', null),
    (gen_random_uuid(), new.id, 'Travel', 'Plane', '#06b6d4', null),
    (gen_random_uuid(), new.id, 'Education', 'GraduationCap', '#6366f1', null),
    (gen_random_uuid(), new.id, 'Subscriptions', 'Repeat', '#f59e0b', null),
    (gen_random_uuid(), new.id, 'Insurance', 'ShieldCheck', '#64748b', null),
    (gen_random_uuid(), new.id, 'Transfer', 'ArrowLeftRight', '#64748b', null);

  insert into public.categories (id, user_id, name, icon, color, parent_id)
  values (gen_random_uuid(), new.id, 'Food & Dining', 'UtensilsCrossed', '#f97316', null)
  returning id into v_food_id;

  insert into public.categories (id, user_id, name, icon, color, parent_id) values
    (gen_random_uuid(), new.id, 'Coffee & Cafes', 'Coffee', '#f97316', v_food_id),
    (gen_random_uuid(), new.id, 'Groceries', 'ShoppingCart', '#f97316', v_food_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
