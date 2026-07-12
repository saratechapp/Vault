-- Extends the feedback/support system (0009_feedback.sql) with what the
-- consumer-facing side needs: a submission-time star rating, a separate
-- post-resolution satisfaction rating, resolved/closed timestamps for the
-- confirm-fix workflow, and a per-ticket "user last read" marker that the
-- notification engine uses to know when to surface "support replied".
alter table public.feedback add column if not exists rating integer;
alter table public.feedback add column if not exists satisfaction_rating integer;
alter table public.feedback add column if not exists resolved_at timestamptz;
alter table public.feedback add column if not exists closed_at timestamptz;
alter table public.feedback add column if not exists user_last_read_at timestamptz;

-- Popup dismissal state for the automatic "how's it going?" feedback prompt.
-- Lives on profiles (not localStorage-only) so dismissing on one device
-- carries over to another, same as every other user preference here.
alter table public.profiles add column if not exists feedback_prompt_snoozed_until timestamptz;
alter table public.profiles add column if not exists feedback_prompt_disabled boolean not null default false;
