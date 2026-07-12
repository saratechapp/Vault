-- Two small additive columns on the existing profiles table, needed for the
-- admin panel — no new infrastructure, just extending an already-proven row.

-- Country: today this only lives in browser localStorage (see
-- frontend/src/lib/preferences.js) and is never sent to the backend, so the
-- admin dashboard's Country Distribution chart has nothing real to read.
-- Nullable, no default — historical users show as "Unknown" rather than a
-- guessed value. Synced going forward via the existing PATCH /api/me route.
alter table public.profiles add column if not exists country text;

-- Status: backs User Management's suspend/activate. Checked on every
-- authenticated request (not just login), since a JWT issued before a
-- suspension doesn't reflect it.
alter table public.profiles add column if not exists status text not null default 'active';

-- Force Logout: Supabase's supabase-js admin API has no stable, documented
-- "invalidate every existing access token for this user id" call (its
-- signOut() takes a specific session's access token, not a user id) — so
-- rather than depend on an unverified SDK method, Force Logout sets this
-- timestamp and requireAuth compares it against each JWT's own `iat`
-- (issued-at) claim, rejecting any token issued before it. Portable,
-- doesn't depend on Supabase Admin API surface area.
alter table public.profiles add column if not exists sessions_invalidated_at timestamptz;
