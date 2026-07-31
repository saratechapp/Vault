-- Per-device session tracking for the mobile app's Settings > Security >
-- Sessions screen (list active devices, revoke one without logging out
-- everywhere). Deliberately separate from the existing `login_events` table
-- (0008_admin_panel_core.sql, an append-only login-history log for the admin
-- panel's Devices/DAU views) — that table has no stable per-install
-- identifier and nothing is ever revoked from it. `session_id` here is a
-- client-generated UUID, stable per app-install/login, NOT the Supabase JWT
-- (which rotates on refresh) — see requireAuth's session-revocation check in
-- server.js for how this is enforced independent of Supabase's own session
-- lifecycle (supabase-js's admin API has no per-session revoke call, same
-- reason profiles.sessions_invalidated_at exists as a global-cutoff
-- workaround instead of a native one — see 0010_profile_admin_fields.sql).
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  platform text,
  device_label text,
  app_version text,
  ip text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  two_factor_verified_at timestamptz
);
create unique index if not exists sessions_user_session_idx on public.sessions(user_id, session_id);
create index if not exists sessions_user_active_idx on public.sessions(user_id) where revoked_at is null;

alter table public.sessions enable row level security;
