-- Credit limit per account, needed for the Credit Utilization health-score
-- factor and any utilization insight — there's no way to approximate a
-- credit limit from existing data, so this is a hard requirement rather
-- than a nice-to-have. Nullable: accounts left blank simply don't
-- participate in utilization-based insights, same graceful-degradation
-- convention every other health-score factor already follows.
-- Safe to re-run: idempotent (IF NOT EXISTS).

alter table public.accounts
  add column if not exists credit_limit numeric;
