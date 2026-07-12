-- Links a transaction to the savings goal it contributed to, turning a goal
-- contribution into a real two-sided transfer (fromAccountId + toAccountId)
-- that can be filtered/edited/deleted with the goal kept in sync, instead of
-- only being identifiable by vendor-name-equals-goal-name.
-- Safe to re-run: idempotent (IF NOT EXISTS).

alter table public.transactions
  add column if not exists goal_id uuid references public.goals(id) on delete set null;

create index if not exists transactions_goal_id_idx on public.transactions(goal_id);
