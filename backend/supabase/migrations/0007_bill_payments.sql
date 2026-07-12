-- Payment-time log for bills, one row per posted/marked-paid occurrence.
-- Needed because both postBillTransaction() and the manual-pay branch of
-- PATCH /api/bills/:id advance bill.due_date forward (via advanceDate) as
-- part of marking a bill paid — the due date *at the moment of that specific
-- payment* isn't preserved anywhere once the bill rolls to its next cycle,
-- so "was this payment late" can't be reconstructed reliably from bills'
-- current due_date after the fact. This table captures due_date_at_payment
-- before advanceDate runs, so BillAnalysisService's payment-history/
-- late-payment insights are computed from real recorded history rather than
-- an unreliable retroactive guess.
-- No backfill for existing users: history only starts accumulating from the
-- day this ships.
-- Safe to re-run: idempotent (IF NOT EXISTS).

create table if not exists public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bill_id uuid references public.bills(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  due_date_at_payment date not null,
  paid_date date not null,
  was_late boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists bill_payments_user_id_idx on public.bill_payments(user_id);
create index if not exists bill_payments_bill_id_idx on public.bill_payments(bill_id);

alter table public.bill_payments enable row level security;
