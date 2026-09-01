# Security Audit & Hardening — Wallet / Vault

**Scope:** Authorized white-box audit of this repository (backend Express API, consumer React SPA, Super Admin SPA). Testing limited to code review + local/staging reasoning; no production systems touched.
**Date:** 2026-09-01
**Architecture reality check:** This app is **Supabase (Postgres + Supabase Auth) + Express**, web only. Several checklist items in the brief describe a different stack and **do not apply**: MongoDB/NoSQL operator injection (no Mongo), Razorpay/Stripe integration (no payment provider is wired — subscription is config/countdown only, no money changes hands), native Android/iOS builds (no mobile app in this repo; a React Native client is referenced but not present here). Those are marked **N/A** below with the reason.

---

## Summary of findings

| # | Severity | Component | Status |
|---|----------|-----------|--------|
| F1 | High | AI receipt-scan quota — concurrent-request race | **Fixed** — in-process lock; **DB-atomic RPC added pass 2** |
| F2 | High | Admin user-search — PostgREST `.or()` filter injection | **Fixed** |
| F3 | Medium | Consumer SPA — no security headers / CSP (Vercel) | **Fixed** (needs preview smoke-test) |
| F4 | Medium | 2FA OTP written to server logs | **Fixed** |
| F5 | Medium | AI vision endpoint — unmetered cost on failed scans | **Fixed** (per-user rate limit) |
| F6 | Low/Medium | `POST /api/import` — unbounded row processing | **Fixed** (abuse ceiling) |
| F7 | Medium | Vulnerable dependencies (`ip-address`, `body-parser`, `undici`, `react-router`) | **Fixed (backend)** pass 2 — `frontend`/`backend/admin` still open |
| F8 | Low | `db.updateProfile` maps any profile column (no privileged-field guard) | **Open** — defense-in-depth recommendation |
| F9 | Low | Body parser runs before the `/api` rate limiter | **Open** — minor, recommendation |
| F10 | Low | `avatar` field accepts any string URL | **Open** — recommendation |
| F11 | Info | `NODE_ENV=development` disables rate limiting | Already documented & fail-safe |
| F12 | High | 2FA step-up + per-device revoke bypassable by omitting `x-session-id` | **Fixed pass 2** |
| F13 | Medium | Receipt-scan quota fails **open** in production when the counter store is unreachable | **Fixed pass 2** (fail closed in prod only) |
| F14 | Medium | Admin can change own / assign `is_system` role via `PATCH /api/admin/admins/:id` | **Fixed pass 2** |
| F15 | Medium | CORS reflects any origin when `CORS_ORIGIN` unset in production | **Fixed pass 2** (refuses to boot) |

**No Critical issues found.** Authentication, authorization/IDOR, injection (SQL), secret management, and error handling are in good shape (details below).

> **Pass 2 (2026-09-01, mobile-repo audit follow-through).** A separate audit driven from the React Native client repo re-reviewed the backend end-to-end against the same brief. The consumer/mobile findings that repo raised were all already covered above except the four new backend items **F12–F15**, fixed this pass. The mobile client itself needed **no changes** (tokens in `expo-secure-store` Keychain/Keystore; `Authorization` header only; no secrets in the bundle beyond the public Supabase anon key; Google sign-in returns an ID token verified server-side by Supabase; `sharp`-backed content sniffing already server-side).

---

## What is already solid (verified, no change needed)

- **IDOR / broken access control.** Every consumer entity write goes through `makeEntityHelpers` in `backend/src/db.js`, which scopes **every** `update`/`delete` as `.eq('id', id).eq('user_id', userId)`. Routes additionally pre-check ownership against the in-memory `req.userData` bundle (`.find(...)` → 404 on a foreign id) and validate account references with `ownsAccount` / `foreignAccountField` (`backend/src/lib/ownership.js`). Cross-user feedback access is blocked by an explicit `item.userId !== req.userId` → 404. `req.userId` always comes from the verified Supabase JWT (`supabase.auth.getUser`), never from the body/query. This is proper defense-in-depth.
- **SQL injection.** All data access is via the Supabase/PostgREST client with column-scoped builder methods (`.eq`, `.ilike(col, val)`, `.range`) — parameterized. The only raw-expression sink was the admin `.or()` string (F2, now fixed). Consumer search/filter/sort (`/api/transactions?q=…&amountMin=…` etc.) is executed **in JavaScript** over the already-user-scoped array, so it cannot reach the DB as a query at all. No `sort`/`order` param is passed to the DB from user input.
- **Passwords.** Never handled or stored by this backend — Supabase Auth owns hashing (bcrypt, server-side). There is no `/api/auth/*` route. No plaintext, no home-rolled hashing on any live path (`backend/src/crypto.js` is legacy/unused).
- **Secret management.** `backend/.env`, `frontend/.env`, and `backend/.data-key` are all git-ignored and **were never committed** (`git log --all -- …` is empty). No API keys, service-role keys, JWT secrets, or DB credentials appear in tracked files or the client bundle. `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are read only server-side (`backend/src/config/env.js`, `supabaseClient.js`). Frontend/admin bundles carry only the public anon key. `render.yaml` uses `sync: false` (no values in the blueprint).
- **Auth token handling.** JWT is sent as `Authorization: Bearer` only — never in a URL, query string, or log line. `securityLog()` records event codes + userId + path, not tokens. Suspension, force-logout (`sessions_invalidated_at` vs JWT `iat`), per-device revocation, and email-OTP 2FA step-up are all **re-checked on every request** in `requireAuth`, not just at login.
- **Admin boundary.** `/api/admin/*` is a separate boundary: valid Supabase JWT **and** an active `admins` row (`requireAdminAuth`), plus per-route `requirePermission(module, action)` and `requireSuperAdmin` for the highest-blast-radius actions (impersonation, pricing writes, global trial settings). Impersonation is time-boxed (15 min, enforced independently of the magic-link TTL), audited, and revocable. Sensitive admin actions have their own 20-req/15-min limiter.
- **Error handling.** `jsonErrorHandler` returns `{error:'internal server error'}` / `{error:'invalid JSON body'}` only — never a stack trace, DB error, or internal path. Scan failures log a reason **code** only, never image bytes or extracted values (`SCAN_ENDPOINT_CONTRACT` privacy rules are respected: images are memory-only, EXIF stripped on re-encode, never persisted).
- **Subscription/payment tampering.** No consumer route can set `plan`, `status`, `subscription_type`, or trial dates — `PATCH /api/me` uses an explicit field allow-list, and there is no payment/plan self-service endpoint. `PATCH /api/subscription/currency` only accepts a 3-letter code that matches an admin-enabled price row. When a real payment provider is added, verify webhook signatures + idempotency server-side (see F-future note).
- **CORS / headers (API).** `helmet()` with a CSP is applied to all API + admin-SPA responses; CORS is an allow-list via `CORS_ORIGIN`. Pass 2 (**F15**) makes an unset `CORS_ORIGIN` in production a hard boot failure rather than a silent allow-all.
- **Upload limits.** `multer` memory storage, 4 files max, 8 MB/file, `.array('images', 4)`; non-image bytes are rejected at decode time by `sharp`/`heic-convert` (actual content sniffing, not just filename). No path is derived from the upload — nothing is written to disk, so path traversal / malicious-file-on-disk does not apply.

---

## Findings & fixes

### F1 — AI receipt-scan quota bypass via concurrent requests — **High** — *Fixed*

- **Affected component:** `POST /api/records/scan` (`backend/src/routes/consumer.routes.js`), `backend/src/services/receiptScanQuota.js`, `backend/src/db.js` (`bumpReceiptScanCounter`).
- **Attack scenario:** A Free user (3 lifetime scans) with 1 scan remaining fires N scan requests in parallel. Each request calls `receiptScanQuota.resolve()` (reads `lifetime_count`), all read the same value, all pass the `remaining <= 0` check, all call the vision model, all then call `record()` → the user gets N successful scans against a cap of 1. The same TOCTOU exists in `bumpReceiptScanCounter` / `incrementAiUsage` (read count → `upsert count+1`).
- **Why it is vulnerable:** Check and consume are separate `await`s with the expensive vision call in between, and the counter update is read-modify-write with no atomic guard or serialization. The brief explicitly requires an atomic check-and-consume.
- **Recommended fix:** Serialize a single user's scan consumption and/or make the counter update an atomic conditional `UPDATE` / RPC.
- **Fix implemented:** Added `backend/src/lib/userMutex.js` (`runExclusive(key, task)` — the same queue pattern already used inline for bill-payment posting) and wrapped the entire `resolve → scan → record` sequence for `/api/records/scan` in `runExclusive('scan:' + userId, …)`. Two concurrent scans from one account now run one-at-a-time, so the second sees the updated counter and is correctly blocked. Response bodies/status codes are byte-identical to before (the critical section returns a `{status, body}` envelope). Keyed per-user, so it never serializes across accounts.
- **Verification:** `userMutex` unit-exercised (two overlapping tasks resolve in submission order); full backend suite green; app builds.
- **Pass 2 — DB-atomic consume added.** `backend/supabase/migrations/0028_receipt_scan_increment_fn.sql` adds `increment_receipt_scan(p_user_id, p_window_key)` — a single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` (atomic; lifetime always +1, window +1 or reset-to-1 on key rollover), `security definer`, `revoke`d from `public`/`anon`/`authenticated`. `db.bumpReceiptScanCounter` now calls the RPC first and **falls back to the exact previous read-modify-write upsert** if the function isn't deployed yet (`42883` / `PGRST202`), so deploy order isn't load-bearing. This removes the multi-instance residual once `0028` is applied (follow-up #2). Suite green (231).

### F2 — PostgREST `.or()` filter injection in admin user search — **High** — *Fixed*

- **Affected component:** `backend/src/adminDb.js` → `listUsers()` (used by `GET /api/admin/users`, `GET /api/admin/subscriptions/users`).
- **Attack scenario:** `search` was interpolated raw into `query.or(\`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%\`)`. A value containing `,` / `(` / `)` breaks out of the intended three-column match and injects arbitrary PostgREST filter expressions (e.g. widening a low-privilege "Support" admin's visible rows, or forcing 500s). Requires an authenticated admin session with `users:view`, so it is a privilege-limited injection, not anonymous — hence High rather than Critical.
- **Why it is vulnerable:** `.or()` takes a raw filter string; user input must be escaped/allow-listed before embedding.
- **Recommended fix:** Strip PostgREST-significant characters from the search term (and cap length) before interpolation.
- **Fix implemented:** Added `sanitizeOrSearchTerm()` — removes `, ( ) " ' \ * % : < >`, collapses whitespace, caps at 100 chars — applied to `search` before the `.or()` call. Normal names/emails/phones (`.`, `@`, `-`, `_`, `+` preserved) are unaffected; a payload like `a),role.eq.admin,(` degrades to the harmless literal `a role.eq.admin`.
- **Verification:** Sanitizer output checked against benign and hostile inputs; backend suite green. Note: `db.js listConversations` uses the **two-argument** `.ilike(column, value)` form, which postgrest-js URL-encodes — that one is not injectable and was left as-is.

### F3 — Consumer SPA has no security headers / CSP — **Medium** — *Fixed (smoke-test before promoting)*

- **Affected component:** `frontend/` deployed on Vercel (`frontend/vercel.json`).
- **Attack scenario:** `helmet()` only protects responses served by the Express backend; the consumer SPA is served by Vercel with **no** `X-Frame-Options`, `Content-Security-Policy`, `Referrer-Policy`, `X-Content-Type-Options`, or HSTS. The app has no client-side frame-busting, so it is clickjackable; there is no CSP backstop for injected script/markup; referrers leak full URLs cross-origin.
- **Why it is vulnerable:** Security headers were configured for the API origin but not the frontend origin.
- **Recommended fix:** Add a `headers` block to `vercel.json`.
- **Fix implemented:** `frontend/vercel.json` now sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo/payment/usb off), `Strict-Transport-Security`, and a `Content-Security-Policy` mirroring the backend helmet policy (`default-src 'self'`; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`; Supabase in `connect-src`/`img-src`; Google Fonts in `font-src`/`style-src`).
- **Verification:** JSON validated. **Action required:** deploy to a Vercel **preview** and confirm the app loads with no CSP console violations before promoting to production — the CSP currently keeps `script-src 'unsafe-inline'` because `index.html` has an inline theme-bootstrap script and it is impossible to nonce a static Vite build without a change. Follow-up to genuinely harden `script-src`: move that inline script to `frontend/public/theme-init.js` and drop `'unsafe-inline'`.

### F4 — 2FA OTP codes written to server logs — **Medium** — *Fixed*

- **Affected component:** `sendTwoFactorEmail()` in `backend/src/routes/consumer.routes.js`.
- **Attack scenario:** `console.log(\`[2fa] verification code for ${email}: ${code}\`)` ran unconditionally. In production this puts a live single-use OTP (and the associated email) into the log sink; anyone with log access can complete a 2FA step-up. The brief explicitly prohibits logging OTPs.
- **Why it is vulnerable:** Placeholder written before a real email provider existed, never gated.
- **Fix implemented:** The `console.log` now runs only when `NODE_ENV !== 'production'`. Comment updated to require a real transactional-email send before 2FA is offered to production users.
- **Verification:** Backend suite green. Note: 2FA is currently non-functional in production anyway (no email send path), so this closes the gap before the feature is completed rather than fixing an exploitable live path.

### F5 — AI vision endpoint: unmetered upstream cost on failed scans — **Medium** — *Fixed*

- **Affected component:** `POST /api/records/scan`.
- **Attack scenario:** A scan that returns "no transaction found" (blurry/garbage image → 422) is **deliberately not counted** against the quota, but it still spends a real Anthropic vision API call. A user within quota — or repeatedly uploading junk — can drive upstream cost, bounded only by the blanket 300-req/15-min `/api` limiter (shared across all endpoints, keyed by IP, so shrinkable by IP rotation).
- **Why it is vulnerable:** No per-user, per-endpoint ceiling on the paid operation independent of the (success-only) quota accounting.
- **Fix implemented:** Added `scanLimiter` — 20 requests / 15 min, **keyed on the authenticated `req.userId`** (`ipKeyGenerator` fallback normalises IPv6), `skip` in explicit dev mode — applied to `/api/records/scan` after `requireAuth`. Generous enough that no genuine receipt-scanning session hits it.
- **Verification:** App builds with no `express-rate-limit` validation warnings; suite green.

### F6 — `POST /api/import` processes unbounded row arrays — **Low/Medium** — *Fixed*

- **Affected component:** `POST /api/import` (Cloud Backup restore).
- **Attack scenario:** The handler loops over `payload.transactions` (and 8 other arrays) doing one sequential `INSERT` per row. A hand-crafted payload maximises row count to tie up a worker. The `express.json({ limit: '5mb' })` body cap is the real bound (~tens of thousands of small rows), so impact is a minutes-long busy worker, not OOM.
- **Fix implemented:** An `IMPORT_ROW_CAPS` guard rejects (`413 import_too_large`) any array above a ceiling set far above any real account (100k transactions / 100k bill-payments / 2k–10k for the rest). Legitimate restores of this app's own export are unaffected.
- **Verification:** Suite green. Consider also lowering the global JSON body limit for non-import routes, or streaming/`insert`-batching the import.

### F7 — Vulnerable dependencies — **Medium** — *Backend fixed (pass 2); `frontend` / `backend/admin` / mobile open*

**Pass 2 update:** `cd backend && npm audit fix` (no `--force`) applied — `npm audit` now reports **0 vulnerabilities**. Only `backend/package-lock.json` changed (transitive `ip-address` and `body-parser` bumps); `package.json` and the 231-test suite are unchanged. `frontend/`, `backend/admin/`, and the React Native repo still need the same treatment.

`npm audit` results at time of writing (pass 1):

| Package | Severity | Where | Note |
|---|---|---|---|
| `undici` 7.0–7.28 | High (5 advisories) | `frontend`, `backend/admin` (transitive, dev/build) | Response desync, cache disclosure, CRLF injection. Not on the backend runtime path. `npm audit fix`. |
| `ip-address` ≤10.3.0 | High | `backend` (transitive) | SSRF/trust-boundary bypass in IP classification. This backend does not make outbound requests to user-supplied hosts, so not currently exploitable here, but patch it. `npm audit fix`. |
| `react-router` 6.0–7.17 | Moderate | `frontend`, `backend/admin` | Open redirect via backslash in `<Link>`/`useNavigate`; SSR hydration constructor injection (SSR not used here). `npm audit fix`. |
| `body-parser` <1.20.6 | Low | `backend` | DoS when an invalid `limit` silently disables size enforcement. The app passes a valid `'5mb'` string, so not triggered, but patch. |
| `brace-expansion` | Low | dev tooling | `npm audit fix`. |

- **Recommended fix:** Run `npm audit fix` in `backend/`, `frontend/`, and `backend/admin/`; re-run the test suites; confirm the app boots and the admin bundle builds. None of these require `--force` / major bumps per the audit output. There is no CI/Dependabot — add one (`npm audit --audit-level=high` in CI, or GitHub Dependabot) so this is not a manual step.
- **Not implemented in this pass** because dependency bumps should be landed with a full `npm install` + regression run by the maintainer, and the exploitability here is low (build-time / non-reachable paths).

### F8 — `db.updateProfile` maps any `PROFILE_FIELDS` key — **Low** — *Open (defense-in-depth)*

`updateProfile(userId, patch)` runs `camelToSnakePatch(patch, PROFILE_FIELDS)`, which will happily map `plan`, `status`, `subscriptionType`, `sessionsInvalidatedAt`, `healthScore`, etc. **Every current caller passes a server-built object** (the `PATCH /api/me` allow-list, `{hasPassword:true}`, `{twoFactorEnabled}`, `{dashboardLayout}`, `{billingCurrency}`, and an internal trial-init in `db.js`), so there is **no live vulnerability**. But it is one careless `updateProfile(req.userId, req.body)` away from privilege escalation. Recommendation: add an explicit consumer-safe wrapper (or an `allowedKeys` parameter) so a future route cannot forward untrusted keys. Not changed now to honour "smallest change / don't break" — internal callers legitimately need `subscriptionType`/`trial*`.

### F9 — Body parser precedes the rate limiter — **Low** — *Open*

In `backend/src/app.js` the chain is `… cors → morgan → express.json({limit:'5mb'}) → /api rate limiter`. An unauthenticated flood of 5 MB JSON bodies is parsed before the limiter can reject it. Low impact (5 MB cap, limiter still fires), but moving `app.use('/api', apiLimiter)` above `express.json` is a safe, cheap improvement. Left out because `app.js` carries an explicit "do not reorder" note; coordinate with the maintainer.

### F10 — `avatar` accepts any string URL — **Low** — *Open*

`PATCH /api/me` stores `body.avatar` (any string ≤2000 chars) and it is later rendered as an `<img src>`. `javascript:`/`data:` in an `<img src>` does not execute in modern browsers and the server never fetches it (no SSRF), so impact is minimal, but validating that it is an `https://<project>.supabase.co/storage/...` URL under the caller's own user-id folder would close it fully.

### F11 — `NODE_ENV=development` disables API rate limiting — **Info**

Working as designed and fail-safe: the `skip` only fires on the exact string `development`, so an unset/misconfigured value keeps the limiter on. `render.yaml` pins `NODE_ENV=production`. No action.

---

## Pass 2 findings & fixes (F12–F15)

### F12 — 2FA step-up and per-device revoke bypassable by omitting the `x-session-id` header — **High** — *Fixed*

- **Affected component:** `backend/src/middleware/requireAuth.js`.
- **Attack scenario:** A user enables email-OTP 2FA (mobile Settings). An attacker holding only a first-factor artefact for that account — a stolen/exfiltrated Supabase refresh or access token — calls the API directly and simply **does not send `x-session-id`**. The old gate was `if (twoFactorEnabled && req.currentSession && !twoFactorVerifiedAt && !exempt)`; with no header, `req.currentSession` is `null`, so the whole condition is false and every protected route is reachable with 2FA effectively off. The same omission defeats "revoke this device" in Settings → Security — a revoked device just stops sending its id and the `revokedAt` check is skipped.
- **Why it is vulnerable:** The bespoke session layer treated a client-supplied header as optional ("graceful degradation for web / old builds"). Optional ⇒ attacker-optional.
- **Recommended fix:** For a `two_factor_enabled` account, require a **verified current session** on every non-exempt route regardless of whether the header was sent; only degrade when the `sessions` table itself is absent (0022 not applied).
- **Fix implemented:** The gate is now `if (twoFactorEnabled && !sessionInfraUnavailable && !exempt && (!req.currentSession || !req.currentSession.twoFactorVerifiedAt)) → 403 two_factor_required`. A new `sessionInfraUnavailable` flag is set **only** in the `isMissingTableError` catch branch, so a missing/unknown `x-session-id` now blocks instead of bypassing, while a genuinely un-migrated environment still degrades rather than hard-failing. A `two_factor_required_no_session` security-log line is emitted when a 2FA account hits a protected route with no session row.
- **Regression analysis:** `two_factor_enabled` is set **only** by `POST /api/2fa/verify` (mobile); it is *not* in `PATCH /api/me`'s allow-list and the web panel's toggle is a non-persisting UI stub (`frontend/src/pages/Settings.jsx` — "Stub — not enforced by the demo backend"). So a 2FA-enabled account is by construction a mobile-app account, and the mobile client always sends `x-session-id` and registers the row via `POST /api/login-events` (exempt). The bootstrap path (`/api/me`, `/api/login-events`, `/api/2fa/*`, `/api/health`) stays exempt, so first-login and mid-2FA flows are unchanged. A new device/reinstall (new session id, not yet verified) is now correctly forced back through the OTP screen — the intended behaviour.
- **Verification:** Backend suite green (231). Boot check OK. Manual trace of the mobile login → login-events → 2fa/verify → protected-route sequence against the new condition; and of the attack (`twoFactorEnabled` + no header → protected route) now returning 403.
- **Residual / note to maintainer:** this is a deliberate behaviour change — any non-mobile client that ever manages to set `two_factor_enabled` will be locked out of non-exempt routes until it implements the session + OTP flow. That is the correct security posture and matches the brief ("must be enforced by the backend; the client is untrusted").

### F13 — Receipt-scan quota fails **open** when the counter store is unreachable — **Medium** — *Fixed (production only)*

- **Affected component:** `backend/src/services/receiptScanQuota.js` (`computeQuota` / `resolve`), `POST /api/records/scan`.
- **Attack scenario:** `db.getReceiptScanCounters` swallows `undefined_table` and returns `{ unavailable: true }`; `computeQuota` then sets `enforced = false` ⇒ `unlimited = true` for **everyone**. If code is ever deployed ahead of migration `0027`, or the table/DB is briefly unreachable, every user — Free included — gets unlimited paid AI vision scans with no cap, silently. The brief requires the scan limit be un-bypassable.
- **Why it is vulnerable:** "Degrade to no cap" was a deliberate availability choice (documented in `0027`'s comment and locked by a unit test), but it is a fail-open on a paid, abuse-sensitive operation.
- **Recommended fix:** Fail **closed** when the counter store can't be consulted — deny the scan rather than granting unlimited — at least in production.
- **Fix implemented:** `computeQuota` now surfaces an explicit `unavailable` boolean (pure function otherwise unchanged, so the existing "degrade to no cap" unit test still passes for dev/test). `resolve()` overrides the quota to `{ unlimited:false, enforced:true, remaining:0 }` **only when `process.env.NODE_ENV === 'production'`**. The route detects `quota.unavailable && !quota.unlimited` and returns a distinct `503 scan_temporarily_unavailable` (not a misleading "you're out of free scans" 403). Local dev without `0027` applied is unaffected.
- **Verification:** Backend suite green (231, +2 new assertions on the `unavailable` flag). `NODE_ENV` unset ⇒ old behaviour (test); `NODE_ENV=production` + `unavailable` ⇒ 503 by trace.

### F14 — Admin privilege escalation / lockout via `PATCH /api/admin/admins/:id` — **Medium** — *Fixed*

- **Affected component:** `backend/src/routes/admin/admins.js`.
- **Attack scenario:** The handler copied `roleId` and `status` straight from the body into the patch. An admin whose custom role includes `admins:edit` (not necessarily Super Admin) could (a) set **their own** `roleId` to the `is_system` "Super Admin" role → full escalation, or set their own `status` → lock themselves/others out; (b) assign the Super Admin role to any account; (c) pass a `roleId` that doesn't exist (only `POST` validated it). `DELETE` already had a `cannot_delete_self` guard; `PATCH` had none.
- **Why it is vulnerable:** The two authorization-bearing fields were treated like `name`/`phone`.
- **Fix implemented:** Before building the patch — reject `roleId`/`status` changes to `req.params.id === req.admin.id` (`cannot_change_own_role_or_status`); validate `status ∈ {active, suspended}`; look up `roleId` and reject if it doesn't exist (`invalid_role`) or if `role.isSystem && !req.admin.isSuperAdmin` (`403 forbidden`). Assigning a non-system custom role by a non-Super-Admin with `admins:edit` is still allowed (legitimate admin management); minting a Super Admin is now Super-Admin-only.
- **Verification:** Backend suite green (231); module loads (boot check). No admin route integration-test harness exists in this repo (would need a Supabase mock) — guard logic reviewed by trace against `adminDb.getRole`'s camelCase `isSystem` shape.

### F15 — CORS reflects any origin when `CORS_ORIGIN` is unset in production — **Medium** — *Fixed*

- **Affected component:** `backend/src/app.js` (`cors(CORS_ORIGINS.length ? { origin: CORS_ORIGINS } : {})`).
- **Attack scenario:** With `CORS_ORIGIN` unset, `cors()` reflects the request `Origin` and allows any site to make credentialed cross-origin calls. Impact is bounded because this API authenticates by `Authorization` header, not cookies (no ambient credentials for a malicious page to ride), but it is a fail-open misconfiguration and the brief calls for a CORS allow-list.
- **Why it is vulnerable:** The empty-config branch was documented as "dev only" but nothing enforced that.
- **Fix implemented:** `createApp()` now throws at startup when `process.env.NODE_ENV === 'production' && CORS_ORIGINS.length === 0` — consistent with `supabaseClient.js` refusing to boot on missing env. `render.yaml` already sets `CORS_ORIGIN` (`sync: false`), so production deploys are unaffected; a deploy that forgot it now fails loudly instead of running wide open. Dev/tests (no `NODE_ENV=production`) keep the permissive default.
- **Verification:** `NODE_ENV=production` + no `CORS_ORIGIN` ⇒ `createApp()` throws the expected message (checked). Dev boot + `/api/health` 200, `/api/me` 401 (checked). Suite green (231).

---

## Checklist coverage

| Brief section | Result |
|---|---|
| 1. Authentication & Authorization | Reviewed. Supabase Auth (bcrypt, server-side). 2FA OTP: 6-digit `crypto.randomInt`, SHA-256 hashed at rest, single-use, 10-min TTL, 5 attempts/code, 10 sends/5-min. **F4** fixed (log); **F12** fixed (step-up no longer bypassable by omitting `x-session-id`). Sessions: suspension / force-logout / per-device revoke all re-checked every request (per-device revoke also hardened by **F12**). OAuth = Supabase provider; native Google sign-in returns an ID token verified server-side by Supabase, backend only verifies the resulting JWT. Impersonation time-boxed + audited + revocable. Admin role assignment hardened (**F14**). IDOR: not possible (see "solid" section). |
| 2. SQL / NoSQL injection | SQL: parameterized throughout; **F2** (raw `.or()`) fixed. NoSQL/Mongo operators: **N/A** (no MongoDB). Sort/filter: done in JS over user-scoped arrays, never reaches the DB. |
| 3. IDOR / Broken access control | Double-scoped (`id` + `user_id`) on every write, plus route-level ownership checks. Verified. |
| 4. API security | Auth + per-route checks, `express.json` 5 MB cap, multer 4×8 MB, helmet + CSP + CORS allow-list on the API, structured errors, dedicated limiters for `/api/2fa/*`, admin sensitive actions, and now `/api/records/scan` (**F5**). **F3** adds headers to the SPA origin. **F9** minor ordering note. |
| 5. API keys & secrets | No secret committed or bundled (git history verified). Anthropic + service-role keys server-only. |
| 6. Bill/receipt scanner | ≤4 images, 8 MB each, real content sniffing (`sharp`/`heic-convert`), memory-only, EXIF stripped, never persisted, no public URLs, no path derived from input, key server-side, upstream image resized to ≤1600 px / re-encoded to JPEG q72 before send. **F1** (quota race) + **F5** (cost) fixed. |
| 7. AI scanner abuse | Server-side, keyed on the Supabase user id (survives reinstall/clear-storage/device switch). Free = 3 lifetime, enforced. **F1** closes the concurrent-consume bypass in-process **and** now via an atomic `increment_receipt_scan()` Postgres RPC (`0028`, with a safe fallback until applied) for multi-instance. **F13** makes the quota fail **closed** in production if the counter store is unreachable. |
| 8. Subscription & payment security | No payment provider integrated — **N/A** for signature/webhook verification today. Confirmed the client **cannot** set plan/status/amount/period (no endpoint; `PATCH /api/me` allow-list; no admin route sets a user's `subscription_type` to `ACTIVE` either). When Razorpay/Stripe is added: verify webhook signatures, make webhook processing idempotent (dedupe on event id), and derive entitlement only from a server-verified payment record. |
| 9. Mobile application security | Reviewed in the RN client repo this pass. Tokens stored in `expo-secure-store` (iOS Keychain / Android Keystore) on native, `localStorage` only on the web target; sent as `Authorization` / `x-session-id` headers, never in a URL or log. No secret in the bundle beyond the public Supabase anon key (RLS-protected, deny-all). Google sign-in via the native SDK returns an ID token verified by Supabase server-side; deep-link session handoff (`createSessionFromUrl`) only accepts Supabase-issued `access_token`/`refresh_token` via `setSession` (server-validated). API base URL falls back to `EXPO_PUBLIC_API_URL` in release builds (no `localhost` baked in). Minor: web target uses `localStorage` for the Supabase session (no Keychain in a browser) and the app-unlock PIN is salted-SHA-256 single-round — both low severity (app-unlock gate, not account auth). |
| 10. Common web vulns | XSS: no `dangerouslySetInnerHTML`/`eval` on any live path (the one `innerHTML` in `backend/admin/src/lib/supabaseClient.js` writes a hardcoded constant). CSRF: token-in-header auth (not cookies) ⇒ not applicable; **F15** additionally forces a CORS allow-list in production. Open redirect: impersonation redirect is server-pinned; `react-router` advisory tracked in **F7**. Path traversal: no filesystem path from user input. Prototype pollution: JSON bodies only, no recursive merge of untrusted objects into shared prototypes. SSRF: backend makes no request to a user-supplied host (Anthropic base URL is fixed; geo comes from headers, not a lookup). Command injection: no `child_process`. |
| 11. Database security | Postgres is Supabase-managed (not publicly exposed; TLS in transit; encrypted at rest; backups). Backend uses the service-role key **server-side only**; RLS is enabled on **every** table (verified across all 28 migrations — service role bypasses by design, anon key never touches them). The one storage bucket with policies (`avatars`, `0015`) is `public: true` with a bucket-wide public-read policy — low severity (profile photos, path needs the user's UUID), tracked as a recommendation. New `increment_receipt_scan()` function (`0028`) is `security definer` with `revoke ... from public, anon, authenticated`. Least-privilege DB user / a non-service-role path for the API is a longer-term hardening item. |
| 12. Sensitive financial data | No passwords/OTP/tokens/keys/document bytes logged (**F4** was the exception, now fixed). Scan failures log a code only. |
| 13. Dependency security | **F7** — `backend` is now clean (`npm audit` → 0 vulnerabilities after a non-`--force` `npm audit fix`; only `package-lock.json` changed). `frontend` / `backend/admin` still need the same + CI audit / Dependabot. Mobile repo: `npm audit` flags ~36 issues but they are almost entirely `expo-dev-client` / `expo-dev-launcher` / `@expo/config` **build-time** tooling not shipped in the release binary — `npm audit fix` recommended, low runtime exposure. |
| 14. Security testing | Covered by review + the backend suite (231 tests, re-run green after every change across both passes). No isolated staging env was provisioned; recommended next step is a Supabase "staging" project + a Render preview + a Vercel/EAS preview to exercise the auth/scan/2FA/OAuth flows end-to-end, especially the **F12** behaviour change. |
| 15. Critical rule (backend-enforced) | Upheld: auth, ownership, scan limits, plan/subscription state, and quota consumption are all backend-decided; the client is treated as untrusted. |

---

## Verification pass (post-fix)

**Pass 1:**
- `backend`: `npm test` → **230 pass / 0 fail** (unchanged from pre-audit baseline).
- `backend/src/lib/userMutex.js`: overlapping tasks on the same key resolve in submission order (serialized).
- `adminDb.sanitizeOrSearchTerm`: benign terms pass through; `,`/`(`/`)`/`*`/`%` are neutralised.
- `frontend/vercel.json`: valid JSON; headers block added. **Still to do by maintainer:** Vercel preview smoke-test for CSP violations.

**Pass 2:**
- `backend`: `npm test` → **231 pass / 0 fail** (+2 assertions on the `receiptScanQuota` `unavailable` flag; no test removed or weakened).
- `backend`: `node server.js` boots; `GET /api/health` → 200, `GET /api/me` (no auth) → 401.
- `backend`: `NODE_ENV=production` + no `CORS_ORIGIN` ⇒ `createApp()` throws the guard error (F15 verified).
- `backend`: `npm audit` → **0 vulnerabilities** (was 1 high `ip-address` + 1 low `body-parser`); `package.json` unchanged, only `package-lock.json`.
- `db.bumpReceiptScanCounter`: RPC path preferred, falls back to the byte-identical read-modify-write upsert on `42883` / `PGRST202` (function not yet created) and still returns `{ unavailable: true }` on `42P01` / `PGRST205` (table missing).
- No change to any business-logic path: response shapes/status codes for `/api/records/scan` (success + all error branches), `/api/import`, `/api/2fa/*`, `/api/admin/users`, `/api/admin/admins/:id` (happy path) are identical to pre-audit; the only new responses are `503 scan_temporarily_unavailable` (F13, prod + store-down only) and the F12/F14 guard 4xx bodies.

## Recommended follow-ups (not done in these passes)

1. `npm audit fix` in `frontend/`, `backend/admin/`, and the mobile repo + add CI `npm audit --audit-level=high` or Dependabot (**F7** — `backend/` done).
2. Apply migration `0028_receipt_scan_increment_fn.sql` in Supabase (staging then prod) so the atomic scan-consume RPC is live; the fallback keeps things working until then (**F1** residual — code done).
3. Move `index.html` inline theme script to an external file, then drop `script-src 'unsafe-inline'` from the CSP (**F3**).
4. Consumer-safe `updateProfile` wrapper with an explicit key allow-list (**F8**).
5. When a payment provider is integrated: signature-verified, idempotent webhooks; entitlement from server-verified records only (**§8**).
6. Wire `securityLog()` to a real sink (it is console-only) before scaling past one instance; add alerting on `invalid_or_expired_token`, `force_logout_token_rejected`, `receipt_scan_failed`, and the new `two_factor_required_no_session` events.
7. Validate `avatar` is a Supabase Storage URL under the caller's folder (**F10**).
8. Reconsider the `avatars` bucket being `public: true` with bucket-wide public read — switch to `public: false` + signed URLs, or scope the read policy to the owner, for a finance app.
9. 2FA hardening: HMAC the OTP with a server secret instead of bare SHA-256, and use `crypto.timingSafeEqual` for the compare (`two_factor_codes`). App-unlock PIN (mobile): move to a slow KDF (`PBKDF2`/`scrypt`) or `SecureStore` `requireAuthentication`.
10. Make `POST /api/import` enforce the plan's per-entity limits (it currently bypasses `assertUnderLimit`), and batch the inserts.

> This audit reduces attack surface and aligns the app with OWASP-baseline practices. It does **not** make the application "unhackable" — security requires ongoing dependency patching, monitoring, and re-review as features (especially payments) land.
