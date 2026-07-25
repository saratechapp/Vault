-- Backstop against duplicate auto-post/manual-pay ledger entries for the
-- same bill cycle (see server.js's runAutoPostExclusive comment and the
-- POST /api/bills/:id/run guard — both close the actual race/collision that
-- caused this, this constraint just makes a duplicate impossible to land in
-- the table even if either in-process guard is ever bypassed, e.g. by a
-- second server instance under horizontal scaling).
-- Safe to re-run: idempotent (IF NOT EXISTS).

create unique index if not exists bill_payments_bill_cycle_uidx
  on public.bill_payments (bill_id, due_date_at_payment);
