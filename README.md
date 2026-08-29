# Vault (Wallet) — Personal Finance Manager

A premium, desktop-web personal finance manager: accounts, transactions, budgets,
recurring bills, savings goals, debt payoff planning, reports, notifications and a
fully customizable dashboard — backed by an Express API over Supabase (Postgres +
Supabase Auth). Signup/login/OAuth happen client-side against Supabase Auth; the
backend verifies the resulting JWT and does its own ownership / admin-role checks.

See [`doc/FULL_APP_RECREATION_GUIDE.md`](doc/FULL_APP_RECREATION_GUIDE.md) for the
complete spec this app was built from.

## Project layout

Two deployables:

- **`frontend/`** — the consumer React/Vite SPA (deploys to Vercel or any static host).
- **`backend/`** — the Node/Express API **and** the Super Admin panel:
  - `backend/server.js` + `routes/`, `services/`, `lib/` — the `/api` and `/api/admin` API.
  - `backend/admin/` — the admin React/Vite SPA (MUI). `npm run build` compiles it
    into `backend/admin/dist`, which the server serves under `/superadmin`.

So in production there is one API host (Render) that also serves the admin UI at
`https://<backend-host>/superadmin`, and one static host for the consumer app.

## Quick start

```bash
cd backend && npm install
cd ../frontend && npm install
# backend/admin deps are installed automatically on the first `npm run dev`
```

Terminal 1 — backend **+ Super Admin** (one command, one server):

```bash
cd backend
npm run dev
```

This starts the Express API and a Vite watcher that keeps `backend/admin/dist`
fresh; the API serves the admin UI itself. No separate admin server.

- API — http://localhost:4000/api
- Super Admin — http://localhost:4000/superadmin/ (sign in as the seeded Super Admin)

Terminal 2 — consumer app:

```bash
cd frontend
npm run dev
```

Open http://localhost:5173 and sign up with any name/email/password.

> Optional: to iterate on the admin UI with hot-module reload instead of a
> full rebuild-on-save, also run `cd backend/admin && npm run dev` and open
> http://localhost:5174/superadmin/ — never required.

## Production build

```bash
cd frontend && npm ci && npm run build     # -> frontend/dist  (static host)
cd ../backend && npm ci && npm run build   # -> backend/admin/dist, then `npm start`
```

`backend`'s `npm run build` installs and builds `backend/admin`; `npm start` then
serves the API plus that admin build under `/superadmin`. On Render set the build
command to `npm ci && npm run build` and provide `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` (needed at admin build time) alongside the usual backend
env vars — see `backend/.env.example` and `render.yaml`.

Deploy targets: consumer frontend → Vercel (`frontend/vercel.json` rewrites `/api/*`
to the Render host — required, since `frontend/src/lib/api.js` uses the relative path
`/api`); backend + admin → one Render web service (`render.yaml`). Admins reach the
panel at `https://<render-host>/superadmin/` directly.

## Environment variables

Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env`, then fill in what you need.

- `PORT` (backend) — default `4000`.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (backend) — **required**; the backend
  refuses to boot without them. The service-role key is server-only.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (frontend, and `backend/.env` for the
  admin build) — the public anon key. Required by `npm run build` in `backend/` (it
  compiles the admin SPA); unused by `npm start` / `npm run dev`.
- `CORS_ORIGIN` (backend) — comma-separated allowed browser origins; unset = allow all
  (dev only). `TRUST_PROXY` (backend) — set behind a reverse proxy. `FRONTEND_URL`
  (backend) — consumer origin, used to build the impersonation magic-link redirect.
- `WALLET_DATA_KEY` (backend) — reserved/unused. Data now lives in Supabase Postgres
  (encrypted at rest by Supabase); `backend/src/crypto.js` is kept only for possible
  future field-level encryption.

Supabase migrations (`backend/supabase/migrations/*.sql`) are applied out of band via
the Supabase SQL editor or `supabase db push` — there is no migration runner in the
build or boot path. Apply pending migrations **before** deploying code that needs them.

Google sign-in is a Supabase Auth OAuth provider (configured in the Supabase
dashboard → Authentication → Providers), not an app env var. New Google sign-ins are
matched/created by email — signing in with Google using an email that already has a
password account logs into that same account.

## Super Admin panel

`backend/admin/` is a separate Vite/React (MUI) SPA. `npm run build` in `backend/`
compiles it into `backend/admin/dist`, which the API serves under `/superadmin` from
the same host. The access boundary is enforced server-side in
`backend/src/middleware/adminAuth.js`: a request needs a valid Supabase JWT **and** an
active row in the `admins` table (`requireAdminAuth`), and every `/api/admin/*` route
additionally checks `requirePermission(module, action)`. The "Super Admin" role
(`admin_roles.is_system = true`) bypasses the per-permission checks. Bootstrap the
first admin with `node backend/scripts/seed-super-admin.js --email=you@example.com`.

## Future enhancements

1. CSV/OFX/QIF importers — currently CSV only.
2. Server-side account balance snapshots for accurate long-range balance trends.
3. Real bank sync via a paid aggregator (Plaid / Salt Edge / Sahamati).
4. PDF export (currently CSV only).
5. Push / email notification delivery.
6. Roles & sharing (owner/editor/viewer workspaces) for consumer accounts.
7. Receipt OCR.
8. Split transactions across multiple categories.
9. HTTPS in dev.
10. WebAuthn / biometrics on desktop.
