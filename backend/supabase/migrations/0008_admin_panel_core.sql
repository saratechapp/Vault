-- Super Admin Panel: core admin/RBAC/audit tables.
-- Same conventions as 0001_init.sql: idempotent, gen_random_uuid() PKs,
-- indexes on FK/lookup columns, RLS enabled with zero policies (service-role
-- backend bypasses RLS; anon key never touches these tables directly).

-- ---------------------------------------------------------------------------
-- RBAC — admin-ness is a row in `admins`, 1:1 with auth.users, exactly how
-- `profiles` already works for regular users. The catalog of valid
-- (module, action) pairs lives in code (backend/adminPermissions.js), not in
-- the DB — this table only stores which pairs a role has been granted.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_role_permissions (
  role_id uuid not null references public.admin_roles(id) on delete cascade,
  module text not null,
  action text not null,
  primary key (role_id, module, action)
);

create table if not exists public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  department text not null default '',
  phone text not null default '',
  avatar text not null default '',
  role_id uuid not null references public.admin_roles(id),
  status text not null default 'active',
  created_by uuid references public.admins(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists admins_role_id_idx on public.admins(role_id);

-- ---------------------------------------------------------------------------
-- Audit log — every mutating admin action, explicitly recorded (see
-- backend/lib/adminAudit.js). before/after are the full row snapshots for
-- the mutated entity, not a diff, so a single row is self-contained.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.admins(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_admin_idx on public.admin_audit_log(admin_id, created_at desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log(target_type, target_id);

-- ---------------------------------------------------------------------------
-- Impersonation — "Login As User". A row here is the authoritative,
-- independently-enforced expiry (see requireAuth's impersonation check);
-- the Supabase magic-link session it rides on is just the transport.
-- ---------------------------------------------------------------------------
create table if not exists public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admins(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  ended_reason text,
  ip text,
  user_agent text
);
create index if not exists impersonation_sessions_target_idx on public.impersonation_sessions(target_user_id, started_at desc);
create index if not exists impersonation_sessions_admin_idx on public.impersonation_sessions(admin_id);
-- Fast "is there an active impersonation for this session" lookup from requireAuth.
create index if not exists impersonation_sessions_active_idx on public.impersonation_sessions(target_user_id) where ended_at is null;

-- ---------------------------------------------------------------------------
-- Login events — backs Last Login / Login History / Devices (grouped by the
-- parsed `device` string, no separate devices table) and real DAU/MAU charts.
-- None of these are derivable from anything that exists today.
-- ---------------------------------------------------------------------------
create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null default 'login',
  method text,
  ip text,
  user_agent text,
  device text,
  created_at timestamptz not null default now()
);
create index if not exists login_events_user_idx on public.login_events(user_id, created_at desc);
create index if not exists login_events_created_idx on public.login_events(created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: enabled, zero policies — same backstop as every existing table.
-- ---------------------------------------------------------------------------
alter table public.admin_roles enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admins enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.impersonation_sessions enable row level security;
alter table public.login_events enable row level security;

-- ---------------------------------------------------------------------------
-- Seed the built-in system roles (idempotent). Permissions for non-Super
-- roles are intentionally left empty here — assign them via the RBAC editor
-- once the panel is up, rather than baking a permission matrix into SQL that
-- would drift from backend/adminPermissions.js's catalog over time. Super
-- Admin never reads this table for authorization (it always has full
-- access, enforced in code) — its row exists only so it can be assigned to
-- an admin and displayed like any other role.
-- ---------------------------------------------------------------------------
insert into public.admin_roles (name, description, is_system) values
  ('Super Admin', 'Full, unrestricted access to every module.', true),
  ('System Admin', 'Operational administration.', false),
  ('Support Admin', 'User support and feedback triage.', false),
  ('Finance Admin', 'Subscriptions and revenue.', false),
  ('Content Admin', 'Content and announcements.', false),
  ('Marketing Admin', 'Growth and marketing analytics.', false),
  ('Security Admin', 'Security center and audit logs.', false),
  ('Read Only Admin', 'View-only access across permitted modules.', false),
  ('Developer Admin', 'Developer tooling.', false)
on conflict (name) do nothing;
