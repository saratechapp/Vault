-- Recurring billing via Stripe (rest of world) and Razorpay (India).
--
-- Builds on 0025 (free-trial + profiles.subscription_* columns) and 0026
-- (per-currency admin pricing). Adds the payment layer: the PROVIDER collects
-- every recurring payment and this backend only ever reacts to a verified
-- webhook. Two new tables plus a handful of additive profiles columns.
--
--   1. subscriptions        — one row per provider subscription (history kept
--      via status). The source of truth for a user's paid state; the webhook
--      handler is the ONLY writer. Its current state is mirrored back onto the
--      profiles.subscription_* columns (0025) so every existing read path
--      (db.resolveForUser -> subscriptionService.computeStatus, the admin
--      panel) is untouched.
--
--   2. subscription_events  — every webhook we accept, keyed by the provider's
--      own event id. Insert-on-conflict-do-nothing gives idempotent, replay-
--      safe processing; `processed_at` marks the ones we finished.
--
-- Same conventions as every migration here: idempotent (IF NOT EXISTS), RLS
-- enabled with zero policies (the service-role backend bypasses RLS; the anon
-- key never touches these tables), applied out of band via the Supabase SQL
-- editor / `supabase db push`. The backend degrades gracefully until this is
-- applied — checkout returns a clean 503, webhooks 503, and every current
-- flow behaves exactly as it does today (db helpers detect the missing table
-- and no-op, same as 0027's tolerance).

-- ---------------------------------------------------------------------------
-- 1. subscriptions — provider-linked records, one live per user.
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,                              -- 'stripe' | 'razorpay'
  provider_customer_id text,
  provider_subscription_id text unique,
  plan_id text,                                        -- provider price/plan id
  plan_name text,                                      -- 'Monthly' | 'Yearly'
  billing_cycle text,                                  -- 'monthly' | 'yearly'
  amount numeric,
  currency text,
  -- internal status vocabulary (NOT the provider's raw status):
  --   incomplete | trialing | active | past_due | paused | cancelled | expired
  status text not null default 'incomplete',
  trial_start_at timestamptz,
  trial_end_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_billing_date timestamptz,
  cancel_at_period_end boolean not null default false,
  -- The provider's own raw status string, kept verbatim for support/debugging
  -- (our `status` above is the normalized vocabulary the app reasons about).
  provider_status text,
  latest_invoice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live subscription per user; historical cancelled/expired rows are free
-- to accumulate. A partial unique index rather than a plain unique(user_id).
create unique index if not exists subscriptions_one_live_per_user
  on public.subscriptions(user_id)
  where status in ('incomplete', 'trialing', 'active', 'past_due', 'paused');

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_provider_sub_idx on public.subscriptions(provider_subscription_id);

alter table public.subscriptions enable row level security;

-- ---------------------------------------------------------------------------
-- 2. subscription_events — webhook idempotency + audit log.
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_events (
  id text primary key,                                 -- provider event id
  provider text not null,
  type text,                                           -- provider's raw event type
  canonical_type text,                                 -- our normalized type
  provider_subscription_id text,
  user_id uuid,
  payload jsonb,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists subscription_events_sub_idx
  on public.subscription_events(provider_subscription_id);

alter table public.subscription_events enable row level security;

-- ---------------------------------------------------------------------------
-- 3. profiles: the mirror the payment layer writes so 0025's read paths are
--    unchanged. `subscription_type` / `subscription_started_at` /
--    `subscription_ends_at` / `subscription_billing_period` already exist from
--    0025/0026 and are reused; these are the additive provider-link columns.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists subscription_provider text;
alter table public.profiles add column if not exists subscription_provider_customer_id text;
alter table public.profiles add column if not exists subscription_provider_subscription_id text;
alter table public.profiles add column if not exists subscription_current_period_start timestamptz;
alter table public.profiles add column if not exists subscription_current_period_end timestamptz;
alter table public.profiles add column if not exists subscription_cancel_at_period_end boolean;

-- ---------------------------------------------------------------------------
-- 4. subscription_prices (0026): the pre-created provider plan/price ids per
--    currency + billing cycle, so nothing hardcodes a plan id. Set from the
--    Super Admin panel (Subscriptions -> Pricing) or scripts/seed-provider-
--    plans.js. Null until an admin fills them in -> POST /api/billing/subscribe
--    returns 409 provider_not_configured for that currency.
-- ---------------------------------------------------------------------------
alter table public.subscription_prices add column if not exists stripe_price_monthly text;
alter table public.subscription_prices add column if not exists stripe_price_yearly text;
alter table public.subscription_prices add column if not exists razorpay_plan_monthly text;
alter table public.subscription_prices add column if not exists razorpay_plan_yearly text;
