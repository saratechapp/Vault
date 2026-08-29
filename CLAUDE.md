# Wallet App — Production Standards

This app is being published publicly as a **paid product**. All work in this repo must follow these standards unless the user explicitly asks for an exception.

## Non-negotiable: don't break existing behavior
Every change (feature, optimization, refactor, bug fix, UI tweak) must preserve existing business logic, calculations, user flows, API contracts, and UI behavior exactly, unless the user explicitly asked to change that specific thing. Regression-check the affected area before calling work done (see the `verify` skill).

## Security (OWASP Top 10 + industry baseline)
- Encrypt sensitive data at rest and in transit (TLS/HTTPS). Data lives in Supabase Postgres (encrypted at rest by Supabase); `backend/src/crypto.js` (AES-256-GCM) is retained only for possible future field-level encryption — use it if you add a new persisted secret.
- Auth is Supabase Auth (passwords, sessions, JWT, OAuth). The backend only verifies the Supabase JWT (`supabase.auth.getUser` in `backend/src/middleware/requireAuth.js`) and then applies its own ownership checks (`ownsAccount` pattern) so users only ever touch their own data. Admin access is a second boundary: `requireAdminAuth` + `requirePermission` in `backend/src/middleware/adminAuth.js`.
- Validate and sanitize all input server-side (never trust client-side validation alone).
- Rate limit and authenticate every API endpoint; never expose secrets/keys/tokens to the client bundle.
- Guard against XSS, CSRF, injection, SSRF, IDOR, clickjacking, session hijacking, brute force, API abuse.
- Use secure HTTP headers and CSP; keep dependencies patched and periodically check for known CVEs.
- Log and monitor suspicious activity (auth failures, unusual access patterns).

## Performance & scalability
- Minimize API calls, DB reads, and re-renders. Use pagination, lazy loading, code splitting, and caching where it doesn't complicate the code beyond what's justified.
- Design for concurrent users and growing data volume — flag when a change works fine at demo scale but won't hold up under real concurrent load or a much larger dataset.

## Code quality
- Reuse existing components/hooks/services/utils instead of duplicating logic.
- Keep the current modular structure — `frontend/src`, and `backend/server.js` (thin entrypoint) + `backend/src/{app,config,lib,middleware,routes,services}` with data access in `backend/src/db.js` / `backend/src/adminDb.js`. Don't introduce parallel patterns for the same problem.
- No speculative abstractions or unused scaffolding — see the general "don't over-engineer" guidance already in force for this assistant.

## Stack notes (so security/scale recommendations stay grounded in reality)
- Frontend: React 18 + Vite + Tailwind + react-router + recharts, plain JavaScript (JSX), no TypeScript.
- Backend: Node/Express, CommonJS. **Data + auth are Supabase** (Postgres + Supabase Auth) — NOT the old JSON-file/scrypt setup. `backend/src/supabaseClient.js` builds a service-role client (bypasses RLS, server-only) and throws on boot without `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. All consumer data access is in `backend/src/db.js`, every query scoped `.eq('user_id', userId)`; cross-user admin access is in `backend/src/adminDb.js`. `backend/sampledata.json` / `backend/src/crypto.js` are legacy remnants used only by `backend/scripts/migrate-user-to-supabase.js`. Migrations in `backend/supabase/migrations/*.sql` are applied out of band (Supabase SQL editor / `supabase db push`) — no runner in build or boot.
- Signup/login/logout/OAuth happen client-side against Supabase Auth (`frontend/src/lib/api.js`, `frontend/src/context/AuthContext.jsx`); there is **no `/api/auth/*` route** on this backend. The Supabase session JWT sits in `localStorage` (`storageKey` differs per app: consumer vs `wallet-admin-auth`) — an accepted tradeoff mitigated by helmet's headers and the absence of any `dangerouslySetInnerHTML`/`eval`. Google sign-in is a Supabase OAuth provider (dashboard-configured), not an env var.
- Super Admin panel: `backend/admin/` is a separate Vite/MUI SPA, built into `backend/admin/dist` by `npm run build` and served at `/superadmin`. Boundary = `requireAdminAuth` (valid Supabase JWT **and** an active `admins` row) + per-route `requirePermission(module, action)` in `backend/src/middleware/adminAuth.js`; the `is_system` "Super Admin" role bypasses the permission checks. RBAC lives in the `admins` / `admin_roles` / `admin_role_permissions` / `admin_audit_log` tables; the valid `(module, action)` catalog is `backend/src/adminPermissions.js`.
- Security hardening in place: `helmet()` with a CSP carve-out for the admin SPA (Supabase `connect-src`, `unsafe-inline` styles for MUI/Emotion), CORS allowlist via `CORS_ORIGIN` (comma-separated; unset = allow-all, dev only), rate limiting (`express-rate-limit`: 300 req/15min blanket on `/api`, skipped only when `NODE_ENV==='development'`; 10 req/5min on `/api/2fa/*`; 20 req/15min on the admin impersonate / reset-password / force-logout actions), `TRUST_PROXY` env var, a global JSON/error handler that never leaks stack traces, and `securityLog()` on auth failures / invalid tokens (console-based — wire to a real log sink before scaling past one instance).
- Before production deploy: set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` for the admin build, set `CORS_ORIGIN` to the real frontend origin(s), set `TRUST_PROXY` if behind a proxy, apply pending Supabase migrations, and terminate TLS at the proxy (the app doesn't enforce HTTPS). See `render.yaml` and `frontend/vercel.json`.
- Biggest remaining scale caveat: the JSON-file store is gone, but `requireAuth` still loads the user's **entire** data bundle (`db.getUserBundle`) on every authenticated request — fine at current scale, flag it for a much larger per-user dataset. Dependency scanning is manual (`npm audit`) — no CI/Dependabot yet.

When a request conflicts with reality, say so explicitly and propose the smallest change that meaningfully closes the gap, rather than quietly pretending the requirement is already met.
