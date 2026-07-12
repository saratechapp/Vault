-- Bills get the same free-text/quick-tag labels transactions already have
-- (see the `labels` column on public.transactions in 0001_init.sql), so the
-- Add/Edit bill form can offer the identical Tags pill selector.
-- Safe to re-run: idempotent (IF NOT EXISTS).

alter table public.bills add column if not exists labels text[] not null default '{}';
