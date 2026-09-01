-- Atomic "consume one receipt scan" for POST /api/records/scan.
--
-- Before this, backend/src/db.js bumpReceiptScanCounter() did a SELECT then a
-- separate UPSERT. Two scans landing at once from the same user could both
-- read the same starting count and both write count+1 — the lifetime cap
-- (3 free scans, ever) could be exceeded by firing N requests in parallel.
-- The route already serializes a single user's scans in-process, but that
-- guard is per-instance; this makes the increment atomic in the database so
-- it also holds under horizontal scaling.
--
-- Same conventions as every migration here: idempotent (CREATE OR REPLACE),
-- applied out of band via the Supabase SQL editor / `supabase db push`.
-- db.js falls back to the old read-modify-write path until this is applied
-- (it detects "function does not exist" and degrades), so deploy order is
-- not load-bearing.

create or replace function public.increment_receipt_scan(
  p_user_id uuid,
  p_window_key text
)
returns table (lifetime_count int, window_key text, window_count int)
language sql
security definer
set search_path = public
as $$
  insert into public.receipt_scan_totals as t
    (user_id, lifetime_count, window_key, window_count, first_scan_at, updated_at)
  values
    (p_user_id, 1, p_window_key, 1, now(), now())
  on conflict (user_id) do update set
    lifetime_count = t.lifetime_count + 1,
    window_count = case
      when t.window_key is not distinct from excluded.window_key
      then t.window_count + 1
      else 1
    end,
    window_key = excluded.window_key,
    first_scan_at = coalesce(t.first_scan_at, excluded.first_scan_at),
    updated_at = now()
  returning t.lifetime_count, t.window_key, t.window_count;
$$;

-- Only the service-role backend ever calls this; make sure the anon/auth
-- roles cannot (RLS on the table itself is already deny-all, but a
-- security-definer function bypasses RLS, so lock the grant down too).
revoke all on function public.increment_receipt_scan(uuid, text) from public, anon, authenticated;
