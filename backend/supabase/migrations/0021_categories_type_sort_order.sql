-- Category type (income/expense/transfer) and explicit sort order, mobile
-- Settings module Phase 2's Category Settings screen.
--
-- `type` is deliberately nullable and NOT backfilled for existing rows —
-- guessing income/expense/transfer from a category's name alone would be
-- wrong often enough (e.g. "Miscellaneous", "Other") to matter; null means
-- "unspecified, valid for any transaction type", not a fourth real value.
-- `sort_order` defaults to 0 for existing rows (falls back to created_at
-- ordering, unaffected until a user actually reorders).
alter table public.categories add column if not exists type text;
alter table public.categories add column if not exists sort_order integer not null default 0;

create index if not exists categories_sort_order_idx on public.categories(user_id, sort_order);
