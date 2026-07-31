-- Primary-account flag: exactly one of a user's accounts can be primary at a
-- time (enforced app-side in server.js by unsetting the others whenever one
-- is set; the partial unique index below is the DB-level backstop). Existing
-- rows backfilled so every user who already has at least one account keeps
-- exactly one marked primary (their oldest account) rather than starting
-- with none.
-- Safe to re-run: idempotent (IF NOT EXISTS / guarded backfill).

alter table public.accounts
  add column if not exists is_primary boolean not null default false;

create unique index if not exists accounts_one_primary_per_user_idx
  on public.accounts (user_id)
  where is_primary;

update public.accounts a
set is_primary = true
where a.id = (
  select a2.id from public.accounts a2
  where a2.user_id = a.user_id
  order by a2.created_at asc
  limit 1
)
and not exists (
  select 1 from public.accounts a3
  where a3.user_id = a.user_id and a3.is_primary
);
