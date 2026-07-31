-- Personalization/General settings for the mobile app's Settings module
-- Phase 2 (Theme sync, Language, Week Start Day, Time Format, Haptic
-- Feedback). Same additive pattern as 0014_profile_extra_fields.sql — safe to
-- re-run, doesn't touch existing rows. Enum-like values (theme_mode,
-- week_start, time_format) are validated at the route layer in server.js,
-- same convention as every other text "enum" column in this schema (plan,
-- status, period, etc. have no DB-level check constraints either).
alter table public.profiles add column if not exists theme_mode text not null default 'system';
alter table public.profiles add column if not exists language text not null default 'en';
alter table public.profiles add column if not exists week_start text not null default 'system';
alter table public.profiles add column if not exists time_format text not null default 'system';
alter table public.profiles add column if not exists haptic_enabled boolean not null default true;
