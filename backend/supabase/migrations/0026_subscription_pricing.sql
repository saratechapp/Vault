-- Admin-configured, per-currency subscription pricing (on top of 0025).
--
-- ₹50/month and ₹500/year are only the INITIAL launch prices — they live in
-- `subscription_prices` as data the Super Admin edits from the panel, never
-- as constants in code. Prices are FIXED per market: there is no live-FX
-- conversion of the INR price into other currencies (an exchange rate is
-- only a reference the admin may consult when first setting a price).
--
-- Same conventions as every migration here: idempotent, RLS enabled with
-- zero policies (service-role backend bypasses RLS; anon key never touches
-- these tables), applied out of band via the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1. Per-currency price table. One row per supported currency; `enabled`
--    gates whether it is offered on the Subscription page's currency
--    selector. Seed INR only — other markets' prices are a commercial
--    decision the Super Admin makes, not a guess baked into a migration.
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_prices (
  currency       text primary key,
  monthly_price  numeric not null default 0,
  yearly_price   numeric not null default 0,
  enabled        boolean not null default true,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id) on delete set null,
  constraint subscription_prices_monthly_nonneg check (monthly_price >= 0),
  constraint subscription_prices_yearly_nonneg  check (yearly_price  >= 0)
);

insert into public.subscription_prices (currency, monthly_price, yearly_price, enabled)
values ('INR', 50, 500, true)
on conflict (currency) do nothing;

alter table public.subscription_prices enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Global settings gains two fields:
--    - enforcement_enabled: is a paid subscription actually required after a
--      trial ends. Stored + surfaced now; it does NOT lock anyone out this
--      phase (no payment layer yet) — it only firms up the Subscription
--      page's copy. Separate from trial_enabled on purpose.
--    - default_currency: the currency used when detection yields nothing or
--      an unsupported currency. INR at launch.
-- ---------------------------------------------------------------------------
alter table public.subscription_settings
  add column if not exists enforcement_enabled boolean not null default false;
alter table public.subscription_settings
  add column if not exists default_currency text not null default 'INR';

-- ---------------------------------------------------------------------------
-- 3. profiles: the user's chosen billing/subscription currency (distinct
--    from `currency`, which drives app-wide money formatting and must not
--    move when someone just previews prices in another currency), plus the
--    price-at-purchase record a future payment flow will write so an
--    existing subscription keeps the price it was bought at.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists billing_currency text;
alter table public.profiles add column if not exists subscription_currency text;
alter table public.profiles add column if not exists subscription_price_at_purchase numeric;
alter table public.profiles add column if not exists subscription_billing_period text;
