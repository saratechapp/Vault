-- Admin-side read marker for the Feedback bell in the admin topbar — the
-- counterpart to feedback.user_last_read_at (0012_feedback_v2.sql), but for
-- staff. A single shared column (not per-admin) matches the existing
-- convention and this app's current admin-team size; if multiple admins ever
-- need independent read state on the same ticket, that's a follow-up
-- (admin_feedback_reads join table), not something to build speculatively now.
alter table public.feedback add column if not exists admin_last_read_at timestamptz;
