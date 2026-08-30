-- Bill / receipt / payment-screenshot scanner usage — one row per user,
-- tracking BOTH a lifetime total and a rolling window total.
--
-- Why one row (not one-per-day like ai_usage): the Free tier's cap is a
-- LIFETIME limit (3 scans, ever — see services/receiptScanPolicy.js), so the
-- number that matters is a running total that never resets and can't be
-- bypassed by reinstalling the app, clearing local storage, logging out/in,
-- or switching devices — it's keyed on the Supabase auth user id, which is
-- stable across all of those. Paid tiers use `window_*` for a per-month (or
-- per-year) allowance; `window_key` is 'YYYY-MM' or 'YYYY' and the counter
-- resets simply by the key changing.
--
-- Same conventions as every migration here: idempotent (IF NOT EXISTS), RLS
-- enabled with zero policies (the service-role backend bypasses RLS; the
-- anon key never touches this table), applied out of band via the Supabase
-- SQL editor / `supabase db push`. The backend degrades to "no cap" until
-- this is applied (db.getReceiptScanCounters swallows undefined_table).

create table if not exists public.receipt_scan_totals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lifetime_count int not null default 0,
  window_key text,
  window_count int not null default 0,
  first_scan_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.receipt_scan_totals enable row level security;
