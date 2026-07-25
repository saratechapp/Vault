-- Small additive columns on profiles for the mobile app's Profile & Settings
-- module (Edit Profile: date of birth, timezone). Same additive pattern as
-- 0010/0012 — both nullable since neither is required at signup.
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists timezone text;
