-- Ground truth for "does this account have a password" lives here, not in
-- Supabase's client-side identities/AMR signals — those proved unreliable:
-- updateUser({password}) doesn't consistently add an 'email' identity, and
-- the session's auth-method claim only updates on a *fresh* password
-- sign-in, not when a password is merely added mid-session. Both failed to
-- survive a page refresh correctly. This column is the actual source of
-- truth going forward (see backend/server.js POST /api/me/password-set).
-- Safe to re-run: idempotent (IF NOT EXISTS).

alter table public.profiles add column if not exists has_password boolean not null default false;


