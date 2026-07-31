-- Email-OTP codes for real two-factor authentication (Settings > Security >
-- Two-factor authentication). Reuses the existing, previously-unenforced
-- `profiles.two_factor_enabled` column (0001_init.sql) as the on/off flag —
-- no new profile column needed. Codes are stored hashed (never plaintext),
-- same salted-hash posture the mobile app's own PIN already uses
-- (lib/security/pin.ts), short-lived, and single-use.
create table if not exists public.two_factor_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  purpose text not null, -- 'enable' | 'login' | 'disable'
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists two_factor_codes_user_idx on public.two_factor_codes(user_id, created_at desc);

alter table public.two_factor_codes enable row level security;
