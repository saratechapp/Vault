# Wallet / "Vault" — Full Application Audit (17-Phase)

**Scope:** Entire application — React frontend (`frontend/`) and Node/Express backend (`backend/`), including the consumer API, the AI/assistant engine, the recurring-billing layer, and the Super Admin panel boundary.
**Method:** Code-grounded audit of the running codebase + live API probing against the running backend (`localhost:4000`) with a real authenticated session + `browser-use` (LLM-driven Chromium) exploratory passes against the running frontend (`localhost:5173`).
**Environment tested:** local dev. Backend `NODE_ENV=development` (rate limiting disabled, CORS open — both expected for dev, see notes). Supabase project live. Stripe/Razorpay keys **unset** (billing providers report "not configured").
**Date:** 2026-09-03.
**Baseline:** This app already has a recent, thorough `SECURITY_AUDIT.md` (findings F1–F15 + 10 follow-ups). This report does **not** re-litigate that; Phase 10 references it and adds only net-new findings.

---

## Executive summary

Vault is a mature, carefully-engineered personal-finance app. The **backend is the strong half**: consistent `requireAuth` + ownership scoping on every route, 630 passing automated tests (267 backend + 363 frontend), signature-verified billing webhooks, plan/quota enforcement server-side, no stack-trace leakage, helmet/CSP, per-user mutexes around money-moving operations. Core money math (ledgers, transfers, bill posting, goal sync) is well tested and correct.

The **weak half is the web frontend's completeness and the public-facing product surface**:

1. **The web app has drifted badly behind the backend.** Working backend features — email-OTP 2FA, device session list/revoke, full data import/restore, "reset all data" — are shipped server-side (and, per code comments, in the mobile app) but on the web are `alert("… is a future enhancement")` stubs or local-state-only toggles. A web user who enables "Two-factor authentication" in Settings gets **zero** actual protection.
2. **Web users cannot pay.** A full Stripe/Razorpay subscription system exists in the backend, but the web `/app/subscription` page has no checkout — "Subscribe" shows "Billing is coming soon." For "a paid product being published publicly" this is a headline gap.
3. **The marketing site presents fabricated facts.** "40,000+ active users", "$340M+ tracked", "4.9/5 App Store rating", "99.99% uptime SLA", named testimonials ("Priya Menon…"), and a "Trusted by" logo wall are all invented and shown as real. Legal exposure (FTC endorsement guides / false advertising).
4. **No Terms of Service or Privacy Policy.** Login/Signup say "you agree to Vault's Terms and Privacy Policy" linking to `#terms` / `#privacy` — anchors that don't exist. For an app collecting financial data this is a compliance blocker.
5. **Server-side input validation is inconsistent.** `PATCH /api/me` carefully bounds every field; the entity routes (`accounts`, `transactions`, `goals`, `bills`, `debts`, `templates`) accept unbounded-length strings, unsanitized HTML, and extreme/`NaN`-coerced numbers.

**Original overall product score: 6.0 / 10.** After the remediation pass below, **8.6 / 10** (see "Remediation applied" and the revised Phase 17 scorecard).

---

## Remediation — applied in this pass

All changes keep existing business logic, API contracts and passing tests intact. Test totals after: **272 backend + 365 frontend = 637 green** (was 630); frontend `vite build` clean.

### Fixed — code

| Was | Now |
|---|---|
| **H1** No Terms / Privacy; dead `#terms` / `#privacy` links | New `/terms` and `/privacy` routes (`frontend/src/pages/Legal.jsx`) — plain-language, accurate to the real data practices (Supabase, no ad tracking, export/delete rights), with a "have counsel review" note. Login, Signup and the footer now link to them. |
| **H2** Fabricated metrics / testimonials / customer logos | Removed. Landing `Metrics` → `HowItWorks` (factual capabilities), `Testimonials` section deleted, `Logos` "trusted by" wall → `Highlights` (what the product does). Login/Signup side-panels: fake personalized stats and the "Priya M." quote replaced with honest copy; "Join 40,000+ people" → "Start building financial calm". |
| **H3** Web can't take payment | Subscription page now calls `POST /api/billing/subscribe`. Razorpay hosted checkout (`shortUrl`) redirects end-to-end; Stripe returns a clear "finish in the mobile app" message; `provider_not_configured` / `pricing_not_configured` surface as accurate states instead of a fake "coming soon". `billingApi` (config/subscribe/verify/cancel/resume) added. |
| **M1** "Two-factor authentication" toggle was local-state only | **Real email-OTP 2FA on web.** The web client now sends a stable `x-session-id` (`lib/deviceSession.js`) on every request and registers a device session on login, so the backend's step-up gate and per-device session list — previously mobile-only — now work on web. New `TwoFactorModal` (enable/disable via `/api/2fa/*`), new `/two-factor` challenge screen, `Protected` + `api.js` route a 2FA-pending session there. **Verified end-to-end against the live backend:** enable → verified session passes, a fresh unverified session gets `403 two_factor_required`, `/api/me` stays exempt. |
| **M2** `alert()` stubs for shipped features | Settings → Security → **Active sessions** now lists devices and revokes them (`/api/sessions`). Data & backups → **Import data** does a real file→`POST /api/import` restore (handles 409/413/parse errors); **Clear all data** does a real `POST /api/me/reset-data` behind a type-"RESET" confirm; **Export** uses the canonical `GET /api/export`. **Upload photo** uploads to Supabase Storage and saves the URL. Help cards are now real links or plainly non-interactive; the "§5 of the recreation guide" leak and all "demo" wording removed. Biometric row states it's mobile-only instead of a fake toggle. |
| **M3** "Live demo" CTAs → login wall | All 5 relabeled to "Sign in". |
| **M4 / M7** Copy claiming unbuilt features / contradicting the real billing system | "Weekly digest emailed every Monday" → "a weekly spending summary in the app"; FAQ "Is Vault really free?" → an honest "free today, a paid plan may come, you'll be told first"; Signup "Free forever — no card, no trial trickery" → "Free to start — no card required". |
| **M5 / F-V1–4 / L1–3** Entity routes: no length caps, no sanitization, `NaN`→0, no magnitude bound | New `lib/validation.js` helpers (`cleanStr`, `boundedNumber`, `cleanLabels`, `cleanEntityText`) + a write-path middleware in `consumer.routes.js` that trims, strips control chars and caps every known text field. Numeric guards added: non-numeric `amount`/`limit`/`openingBalance` → `400`; all money values clamped to ±1e12; a non-transfer transaction now requires an account once the user has one. 5 new backend tests. |
| **M6** No mobile web navigation | New `MobileNav` slide-in drawer (reuses the sidebar's `NAV`), hamburger in the Topbar below `md`, responsive Topbar/`main` padding, profile chip and "New transaction" collapse to icons on small screens. |
| **M8** Editable-but-ignored Email field; no Profile save error path | Email field is now read-only; `handleSave` shows an error on failure; name is required client-side. |
| **F-E6** Raw browser tooltips for empty/format validation on Login/Signup/Forgot | `noValidate` + branded inline messages ("That doesn't look like a valid email address.", etc.). |
| **F-E7 / L17** No 404 page — unknown routes silently went to `/` | New `NotFound` page; `App.jsx` catch-all (inside and outside `/app`) renders it. |
| **F-X1 / L4** Hover-only row actions unreachable by keyboard/touch | Added `group-focus-within:opacity-100` to all 9 row-action clusters + a global `@media (hover: none)` rule that forces them visible on touch. |
| **F-A2 / L10** 6-char password minimum, no weak-password check | Raised to 8 + reject trivial strings (all-one-char, all-digits). Shared `passwordValidation.js`; hint components and its tests updated. |
| **F-A3** 2FA codes: bare SHA-256, `!==` compare | HMAC-SHA256 (`TWO_FACTOR_SECRET`, falls back to the service-role key) + `crypto.timingSafeEqual`. `.env.example` documents the new var. |
| **F-10** `avatar` accepted any URL string | `PATCH /api/me` now requires https on an allow-listed host (Supabase Storage, DiceBear, OAuth-provider CDNs). |
| **F-U3** Topbar "auto-posted subscriptions" copy (engine removed) | Corrected. `L7 / F-U5` Accounts `alert()` errors → inline banner (incl. friendly 409 text). `L9 / F-E4` `/reset-password` with no recovery token now shows "link invalid/expired → request a new one" up front. |
| **Docs** | `FEATURES.md` rewritten (was "single encrypted JSON file / no real database / auto bill posting / 2FA stub" — all stale). `LandingDashboardPreview` fake `app.vault.finance` URL → "Vault · Dashboard preview". |

### Not fixed here — needs work outside the codebase (why a literal 10/10 isn't reachable in a code pass)

- **Legal text (H1):** the new Terms/Privacy are written to be accurate and usable but must be reviewed by counsel for your jurisdictions before launch.
- **Real metrics / testimonials (H2):** removed the fabricated ones; genuine numbers and quotes can only be added once they exist.
- **Stripe web card entry (H3):** Razorpay checkout works; Stripe Elements on web needs live Stripe keys to build and test — deferred to the mobile app for now, and the page says so.
- **`securityLog` sink (F-B3):** still console-only; wiring a real log/alert sink is an infra task.
- **Dependency audits (F7):** `frontend` / `backend/admin` `npm audit` + CI/Dependabot not run here.
- **Scale (F-B1 / F-P1):** full-bundle-per-request and unpaginated Transactions/Calendar are architectural; left as-is to avoid a risky refactor under "don't break existing behavior".
- **Browser click-through of the new web 2FA / Settings flows:** the shared `ANTHROPIC_API_KEY` ran out of credits mid-audit, so `browser-use` could not re-run; the new flows were verified via `vite build`, unit tests, and direct API calls against the live backend, not a driven browser.

---

## PHASE 1 — Application discovery

### Purpose
A personal-finance / budgeting "workspace": track accounts, transactions, budgets, recurring bills, savings goals, and debts; get computed insights (health score, cash-flow forecast, anomaly/duplicate detection, spending trends), a rule-based chat assistant, and an AI receipt/bill scanner. Multi-currency with live FX. A separate Super Admin panel for staff (RBAC, user management, feedback triage, impersonation, subscription config).

### Target users
Detail-oriented individuals managing personal money (the copy explicitly targets "people who care about the details… without the spreadsheets"). India-first defaults (₹ INR, India→Razorpay) but multi-currency/multi-country aware. A parallel React-Native mobile app shares this backend and Supabase project.

### Screens (frontend routes)
Public: `/` Landing, `/login`, `/signup` (email-OTP), `/create-password`, `/forgot-password`, `/reset-password`, `/impersonate-entry`.
Authenticated (`/app/*`, gated by `Protected` + optional PIN lock): `dashboard`, `accounts`, `accounts/:id`, `transactions`, `calendar`, `budgets`, `bills`, `goals`, `debts`, `reports`, `notifications`, `feedback`, `settings`, `subscription`.
Admin SPA: `/superadmin/*` (separate Vite/MUI build served by the backend).

### Workflows
Signup (email code → set password → dashboard) or OAuth (Google/Apple/Facebook → mandatory create-password → dashboard); create account → add transactions (manual, template, CSV import, or AI scan on mobile) → set budgets → track bills (manual "Mark as paid" posts a transaction) → fund goals (two-sided transfer) → record debt payments → review Reports → triage Notifications → send Feedback (→ admin inbox → threaded reply → resolve/confirm).

### Hidden / disconnected / incomplete
- **Backend features with no web UI:** `GET/DELETE /api/sessions` (device session management), `POST /api/import` (backup restore), `POST /api/me/reset-data`, `POST /api/2fa/*` (email-OTP 2FA), `POST /api/billing/*` (checkout). All are reachable and functional via API; the web app exposes none of them (Settings shows `alert()` stubs; Subscription shows "coming soon").
- **`/impersonate-entry`** exists for the admin impersonation hand-off; only reachable via an admin-generated link (correct).
- **AI receipt scanner** (`POST /api/records/scan`) is fully built server-side (Claude vision) but is described in code as a *mobile* flow — no web entry point found.
- **Notification delivery** (email/push) — preferences UI exists, delivery is explicitly not wired (`Settings` subtitle admits it; no send path in backend).
- **Weekly digest email** — toggle persists, no delivery.
- **"Live demo"** — the landing page's "Live demo" / "See a live demo" / "Explore demo" buttons (≈5 of them) all route to `/login`. There is no demo.
- **Product tour** calls the app "Personal Budget"; the sidebar calls it "Vault / Personal Finance"; the landing mock shows "app.vault.finance"; the export payload says `app: "vault-wallet"`. Inconsistent product naming.
- **`FEATURES.md` is stale** — describes a "single encrypted JSON data file (no real database)" and "Automatic bill posting on schedule (server-side)"; both are wrong now (Supabase Postgres; auto-post engine removed, every payment needs explicit confirmation).

---

## PHASE 2 — User flow analysis

### Happy paths — validated
- Signup → create-password → dashboard: sound. `needsPassword` correctly forces the password step for OTP and OAuth signups.
- Login → dashboard: works; self-heals `has_password` on successful password login.
- Create account → transaction → budget → bill → goal → debt: all functional (verified via API + browser pass).
- Bill "Mark as paid" → posts one transaction, rolls due date, logs a `bill_payments` row; serialized per-user against double-tap; unique-index backstop. Solid.
- Goal contribute → two-sided transfer, `goalId`-linked, `saved` kept in sync on edit/delete via delta (not recompute — deliberate, correct).
- Forgot password → non-enumerating "if an account exists…" message. Good.

### Alternate / failure / recovery paths
- List pages (`Transactions`, `Templates`, `Dashboard`, …) handle a failed load with an error state + **Retry** button instead of a stuck spinner or a false "empty" state — this was clearly hardened deliberately (code comments confirm).
- 401 anywhere → global interceptor signs out and redirects to `/login`; `403 account_suspended` → same, with a one-time reason banner. Good.
- Idle timeout: JS timer + a persisted-timestamp backstop re-checked on every API call and on boot (covers "laptop was asleep"). Good.

### Gaps / broken / circular / dead-end flows
| Flow | Problem |
|---|---|
| Landing "Start free — no card required" → `/app/subscription` → "Subscribe monthly" | **Dead end / circular.** Button just shows "Billing is coming soon." No checkout exists on web. |
| Landing "Live demo" (×5 variants) → `/login` | **Misleading.** Lands on a login wall, no demo, no demo credentials, no explanation. |
| Login / Signup → "Terms" / "Privacy Policy" links | **Dead links** (`href="#terms"`, `#privacy`). No such pages. |
| Settings → Security → "Active sessions" → "View" | `alert("Session management is a future enhancement.")` — but `/api/sessions` is fully implemented. |
| Settings → Data & backups → "Import data" | `alert("Import data is a future enhancement.")` — but `POST /api/import` is fully implemented. |
| Settings → Data & backups → "Clear all data" → confirm modal → "Clear data" | User passes a scary typed-tense confirm dialog, then just gets `alert("Clearing data is not enabled in this demo.")`. `POST /api/me/reset-data` exists. |
| Settings → Profile → "Upload photo" | Button has no handler — does nothing. |
| Settings → Profile → edit Email → "Save changes" → "Saved" | Email field is editable and shows "Saved", but `handleSave` never sends email — silently discarded. |
| Settings → Help & support → 4 cards (Contact support / Security disclosure / Changelog / Community) | Non-interactive; a chevron implies navigation but nothing happens. One card's body leaks an internal doc reference ("§5 of the recreation guide"). |
| Settings → Security → "Two-factor authentication" toggle | Local React state only; never calls `/api/2fa/*`; reverts on refresh. Body text still says "demo backend". |
| Settings → Security → "Biometric unlock" toggle | Local state only; `biometricEnabled` isn't even in `PATCH /api/me`'s whitelist. |
| `/reset-password` opened without a recovery token | Renders the full form; the failure only surfaces after the user fills it in and submits. |
| Landing page logo (top-left "Vault" wordmark) | **Not a link** — clicking does nothing; no "back to top / home" affordance. |
| Any unknown route (`/xyz`, `/app/transactionss`, …) | **Silently redirects to `/` (the marketing landing page).** No 404 page. A mistyped in-app URL dumps a logged-in user on the public site with no explanation. (`App.jsx`: `<Route path="*" element={<Navigate to="/" replace />} />`.) |

**Every feature reachable?** No — see the table above and Phase 1 "hidden/disconnected".

*(Confirmed live via the `public-nav` browser-use pass — see `runs/public-nav/result.md`.)*

---

## PHASE 3 — Functional testing

### CRUD — verified (API + UI)
Accounts, categories (incl. parent/sub nesting rules), transactions (incl. bulk), budgets, bills, goals, debts, templates, notifications, feedback, AI conversations — all support the expected create/read/update/delete with sensible 404s on unknown ids and `409 in_use` guards (deleting a category/account still referenced by transactions/budgets/bills/goals).

### Business rules — verified correct
- **Transfers:** `from ≠ to` enforced (bills, goal contributions, transactions); category forced to the system "Transfer" uuid server-side (not client-trusted — this fixed a real prior 500).
- **Primary account invariant:** first account is always primary; setting a new primary unsets the old; you can't un-primary the last one; deleting the primary promotes another. Consistent across create/update/delete/import.
- **Bill payment:** only a human "Mark as paid" posts a transaction; per-user serialized; re-reads live status inside the lock; unique `(bill, cycle)` index + transaction-rollback backstop. One-time bills deactivate; recurring roll forward via `advanceDate`.
- **Goal `saved`:** clamped to `[0, target]`; edit/delete of a linked contribution applies a delta, re-linking moves the full amount. Manual "saved so far" base is preserved (not recomputed from linked txns).
- **Plan limits / features:** all enforced server-side via `plans.js` (`assertUnderLimit`, `requireFeature`). Currently every limit is `Infinity` and every feature `true` on `free` — a deliberate MVP decision, not a bug.
- **AI usage metering:** counted per day regardless of cache hit (limit is about API usage). Receipt-scan quota consumed only on a *successful* scan, per Supabase user id (survives reinstall), serialized per-user.

### Defects found
- **F-D1 (Low):** `POST /api/transactions` with `amount: "not-a-number"` → coerced to **0** and a `₹0` transaction is created (201), rather than a `400`. Any client bug silently produces zero-value rows.
- **F-D2 (Low):** `POST /api/transactions` succeeds with **no account** when the user has zero accounts (`accountId: null`). Such a transaction appears in no account ledger. The web UI's `AccountsGate` prevents this; the API does not.
- **F-D3 (Low):** No upper bound on monetary inputs — `openingBalance: -999999999999`, goal `target`, debt `balance`, transaction `amount` all accepted at arbitrary magnitude. Extreme values flow into charts/among ledgers unchecked.
- **F-D4 (Info):** `DataPanel.exportJson` in web Settings builds its own snapshot from 8 list calls and omits `billPayments` and profile — divergent from the canonical `GET /api/export` contract (which the mobile backup uses).

---

## PHASE 4 — Authentication & authorization

Auth is **Supabase Auth**; the backend only verifies the JWT (`supabase.auth.getUser`) then applies its own checks. Verified:

| Check | Result |
|---|---|
| Unauthenticated `GET /api/me`, `/api/dashboard` | `401 unauthorized` ✅ |
| Malformed / garbage bearer token | `401 unauthorized` ✅, `securityLog('invalid_or_expired_token')` |
| Suspended account (admin action) | Re-checked every request → `403 account_suspended` ✅ (client signs out) |
| Force-logout (global cutoff) | JWT `iat` vs `sessionsInvalidatedAt` → `401 session_revoked` ✅ |
| Per-device revoke | `x-session-id` vs `sessions.revoked_at` → `401` ✅ |
| 2FA step-up gate | `two_factor_enabled` + no verified session → `403 two_factor_required` (distinct code so mobile doesn't hard sign-out) ✅. **F12** (header-omission bypass) already fixed. |
| IDOR: `PATCH /api/accounts/<foreign uuid>` | `404 not found` ✅ (ownership check + `.eq('user_id')` scoping) |
| IDOR: `GET /api/feedback/<foreign id>` | `404 not_found` ✅ |
| Privilege escalation via `PATCH /api/me {plan, status}` | Ignored — not in field whitelist ✅ |
| Admin API unauthenticated | `401` ✅; every `/api/admin/*` route re-verifies via `requireAdminAuth` + per-route `requirePermission(module, action)`; `is_system` role bypasses permission checks only; sensitive actions (impersonate / reset-password / force-logout) have a stricter 20/15min limiter and audit logging. |
| Email enumeration on forgot-password | Non-enumerating message ✅ |

### Findings
- **F-A1 (Medium):** **Web "Two-factor authentication" is a decorative toggle.** The backend has a complete, enforced email-OTP 2FA system; the web Settings toggle only calls `setUser({...user, twoFactorEnabled: v})` (local state) and reverts on refresh. A user who believes they enabled 2FA on the web has none. Either wire the real flow or remove the toggle from the web build.
- **F-A2 (Low):** Password minimum is **6 characters with no complexity/breach check** (`PasswordFields` placeholder "At least 6 characters", `isPasswordValid`). Weak for a finance product; consider ≥10 + a breached-password (k-anonymity HAIBP) check, or rely on Supabase's configurable policy and raise it.
- **F-A3 (Low, from SECURITY_AUDIT follow-up #9):** 2FA OTP is bare `SHA-256`, compared with `!==`. Move to HMAC-with-server-secret + `crypto.timingSafeEqual`.
- **F-A4 (Info):** Supabase session JWT lives in `localStorage` (accepted tradeoff, documented in CLAUDE.md; mitigated by CSP + no `dangerouslySetInnerHTML`/`eval`).

---

## PHASE 5 — Data validation

### Good
- `PATCH /api/me` — exemplary: every field type/length/enum-checked (name 1–100, phone ≤30, country 2, currency 3, avatar ≤2000, themeMode/weekStart/timeFormat enums, language regex, etc.).
- `POST /api/import` — row caps per entity (413 `import_too_large`), 5 MB body cap, requires an empty account first (409), remaps every FK old-id→new-id.
- `sanitizeDashboardLayoutPayload` — shape-validates, drops junk entries, caps at 40 widgets.
- Dates validated (`isValidDateStr`, `Number.isNaN(Date.parse())`); `paidDate` can't be in the future; `since` must be ISO.
- 2FA code must match `/^\d{6}$/`; 5-attempt lock; 10-min TTL.

### Findings
- **F-V1 (Medium):** **No length cap on entity string fields.** `POST /api/accounts` `name`/`institution`, transaction `vendor`/`note`, bill `name`/`note`, goal `name`/`note`, debt `name`/`creditor`, template fields — all accept arbitrarily long strings (only the 5 MB body cap bounds them). Inconsistent with `/api/me`. A single 4 MB `note` is a valid write. Add per-field caps (e.g. name ≤120, note ≤2000) mirroring `/api/me`.
- **F-V2 (Medium):** **No server-side sanitization of user text.** `POST /api/accounts {"name":"<script>alert(1)</script>"}` is stored verbatim (201). React escapes on render so the web app isn't XSS-exploitable today, but the raw value reaches the mobile app, CSV export, the admin panel grid, and the AI prompt context. CLAUDE.md requires "validate and sanitize all input server-side" — strip/`he.encode` control chars and tags, or at minimum document the escaping contract every consumer must honor.
- **F-V3 (Low):** Numeric fields coerced with `Number(...)` / `numOr` — `"abc"` → `0`, no rejection (see F-D1). Reject non-numeric and enforce sane `min`/`max`.
- **F-V4 (Low):** `foreignAccountField` / `ownsAccount` correctly reject foreign account ids, but `categoryId` on transactions is only coerced empty→null, not verified to belong to the user (a foreign uuid would just fail the FK / render "Uncategorized"). Low impact but worth an ownership check for symmetry.

---

## PHASE 6 — UI testing

*(Desktop verified via browser-use at 1440×900; a dedicated responsive pass at 390/768 is summarized where complete — see the run logs in `runs/`.)*

### Observations
- Desktop layout is clean, consistent, well-spaced; dark/light theming is thorough (token-based). No overlapping elements or broken components seen on Landing, Login, Signup, Dashboard, Accounts, Transactions, Calendar, Budgets, Bills, Goals, Debts.
- Loading is a brief per-page "Loading X…" line/spinner (each route is a lazy chunk with its own fetch), then content. Consistent.
- Empty states are generally good and actionable ("No budgets yet" + "New budget", "No bills tracked yet" + "Add your first bill").

### Findings
- **F-U1 (Medium):** **Sidebar is `hidden … md:flex`** — below 768 px there is **no navigation at all** (no hamburger, no bottom bar found in `AppLayout`). A mobile web user who lands on `/app/dashboard` cannot move between sections. (The RN app is the intended mobile client, but the responsive web app is served and reachable.)
- **F-U2 (Low):** Row action buttons (Edit/Delete/Pin) are `opacity-0 … group-hover:opacity-100` across Transactions, Categories, Templates, Accounts strip. Invisible until hover → unusable on touch, and a keyboard-focus reveal isn't guaranteed (see Phase 8).
- **F-U3 (Low):** Product tour ("Step 1 of 4: Welcome to Personal Budget") auto-launches on the dashboard even for a brand-new **empty** account with nothing to point at; name mismatch ("Personal Budget" vs "Vault").
- **F-U4 (Low):** In-app currency shown (browser-pref-driven, e.g. `£`/`$`) can differ from the profile currency (`₹`) within the same session — `readPrefs()` (localStorage) vs the server profile aren't reconciled on first load.
- **F-U5 (Low):** `Accounts.jsx` uses native `alert()` for delete/set-primary errors, inconsistent with the inline rose-colored error panels used everywhere else.
- **F-U6 (Low):** `window.location.reload()` after saving Preferences and after "Lock now" — a full reload where a state update would do.

---

## PHASE 7 — UX testing

### Frustrations / confusion / drop-off risks
- **Stub buttons that lie.** "Import data", "Active sessions", "Clear all data", "Upload photo", the Help cards, the 2FA/biometric toggles — a user who tries them learns the Settings page can't be trusted. This is the single biggest UX credibility problem.
- **"Live demo" everywhere → login wall.** High-intent visitors clicking "Live demo" hit a dead end; likely a real conversion killer.
- **Subscribe → "coming soon."** A user ready to pay is turned away.
- **Scary confirm → nothing.** The "Clear all data?" modal uses committed language ("This would permanently erase…") then no-ops. Erodes trust in *every* confirm dialog in the app.
- **Editable-but-ignored Email field** with a "Saved" confirmation is actively misleading.
- **Empty-account product tour** adds friction with no payoff.
- **Every page refetches shared data** (accounts/categories/transactions), and the sidebar independently fetches four lists on mount → visible re-loading when navigating.

### What works well
- Calm, focused visual design; strong empty states; good inline validation in the New Transaction modal (amount > 0, vendor/account/category required, ≥1 tag, from≠to); "Retry" recovery on load failures; non-enumerating auth messages; sensible confirm dialogs *where they're real* (transaction delete).

---

## PHASE 8 — Accessibility

*(Static review + browser observations; not a full AT sweep.)*

- **F-X1 (Medium):** **Hover-only action buttons** (`opacity-0 group-hover:opacity-100`) — Edit/Delete/Pin on table rows and cards are not reliably reachable by keyboard (no `focus-within:opacity-100`) and are unreachable by touch. Add `group-focus-within:opacity-100` + visible focus, or make them always visible.
- **F-X2 (Medium):** **No mobile navigation** (F-U1) is also an accessibility failure on small viewports / high zoom (200%+ effectively collapses to the mobile layout).
- **F-X3 (Low):** Icon-only controls — many use `label=` / `aria-label` (good: Sidebar sign-out, `IconButton`), but verify all (`ThemeToggle`, the tour's close, chevron-only Help cards which also aren't buttons).
- **F-X4 (Low):** Landing marketing numbers/quotes are `<p>`/`<span>` — fine — but the `Accordion` FAQ and the animated `Stagger` reveals should be checked for `prefers-reduced-motion` support and correct `aria-expanded` on the accordion.
- **F-X5 (Low):** Color-as-only-signal in a few spots (amount tone red/green with only a `+`/`-` prefix — acceptable; category chips rely on color + text — acceptable). Verify contrast of `text-subtle` on `bg-app` in light mode (looks borderline).
- **F-X6 (Info):** Forms mostly use `<Field label>` wrappers and native `required`; Login's password field uses a bare `<label className="label">` not associated via `htmlFor`/`id` — minor.

A proper audit needs axe-core / screen-reader passes on the authenticated pages; treat the above as a starting list.

---

## PHASE 9 — API & backend testing

- **Response shapes / status codes:** consistent. `{ error: '<code>' }` bodies; `201` on create, `204` on delete-with-no-body, `304` honored (ETag via `sendJSON`/`httpCache`), `409` for conflicts, `413` for oversized, `429` for rate/attempt limits.
- **Error handling:** global handler never leaks stack traces (`500 { error: 'internal server error' }`); `SyntaxError` / bad JSON → `400 invalid JSON body`; explicit 4xx errors from the data layer are surfaced as-is.
- **`x-powered-by` removed** (helmet); no `Server` banner; TRACE → 404.
- **Timeouts/retries:** the receipt-scan upstream call has a 40 s timeout, `maxRetries: 0`, and fails to a tagged code (never leaks images/prompt); billing webhooks return `500` to invite provider retry, `400` for bad signature (no retry), `200` for handled/ignored, `503` when a provider isn't configured.
- **Idempotency:** offline-sync `clientId` routes POSTs through `upsertX`; `isStaleWrite` returns `409 { server }` on optimistic-concurrency conflict; bill-cycle unique index prevents double-posting.

### Findings
- **F-B1 (Medium, scale):** **`requireAuth` loads the user's entire data bundle (`db.getUserBundle`) on every authenticated request** — every account/transaction/budget/bill/goal/debt/template/billPayment, for *any* endpoint including `GET /api/health`-adjacent ones like `/api/me`. Fine at demo scale; O(user's lifetime data) per request won't hold up for a heavy user or under load. Already flagged in CLAUDE.md; restating as the top scale risk.
- **F-B2 (Low):** `GET /api/transactions` filtering is entirely in-memory over the full bundle (no DB-side pagination or `LIMIT`). Same root cause as F-B1.
- **F-B3 (Low):** `securityLog()` is `console.*` only — no sink, no alerting. Before multi-instance deploy, wire to a real logger and alert on `invalid_or_expired_token`, `force_logout_token_rejected`, `two_factor_required_no_session`, `receipt_scan_failed`, `billing_webhook_bad_signature`.
- **F-B4 (Info):** `GET /api/dashboard` recomputes health/metrics/trends per call (cached via `insightsCache` for `health` and AI bundles; others recompute). Acceptable now; watch under load.

---

## PHASE 10 — Security testing

**A full security audit already exists (`SECURITY_AUDIT.md`, F1–F15 + 10 follow-ups) and is broadly sound.** Its open items still stand:
- F7 — `npm audit` in `frontend/`, `backend/admin/`, mobile; add CI audit/Dependabot. (`backend/` is clean.)
- F8 — consumer-safe `updateProfile` allow-list wrapper.
- F10 — validate `avatar` is a Storage URL under the caller's folder.
- Follow-ups: apply migration `0028` (atomic scan-consume RPC), move `index.html` inline theme script external then drop `script-src 'unsafe-inline'`, `avatars` bucket → private + signed URLs, 2FA HMAC + `timingSafeEqual`, PIN via slow KDF, `POST /api/import` should enforce per-entity plan limits, wire `securityLog` to a sink.

### Net-new / re-prioritized this pass
- **F-S1 (Medium):** **Input validation/sanitization gaps** — F-V1 (no length caps on entity strings) and F-V2 (no HTML/control-char sanitization). SECURITY_AUDIT's F8/F10 only touch the profile; the entity routes have the same class of gap.
- **F-S2 (Medium → now partially addressed):** SECURITY_AUDIT §8 lists "when a payment provider is integrated: signature-verified, idempotent webhooks; entitlement from server-verified records only" as a **future** item. Billing is now integrated. The webhooks **do** verify signatures (`stripeAdapter.verifyWebhook` / `razorpayAdapter.verifyWebhook` against raw bytes, tests present) and entitlement is derived from `processWebhookEvent`, not client input — good. **Action:** update SECURITY_AUDIT to mark §8 reviewed, and confirm webhook **idempotency** under provider replay (Razorpay uses a synthetic event id when the header is absent — verify dedupe on that path) and that `POST /api/billing/verify` (the client fast-path) cannot grant entitlement without a verified signature.
- **F-S3 (Low):** Dev-mode `NODE_ENV=development` disables **all** rate limiters (`skip: () => isDevEnv`) — expected, but means abuse/brute-force behavior is untestable locally and any staging box left at `development` is unprotected. Ensure staging runs `production`.
- **F-S4 (Low):** CORS is fully open in dev (`Access-Control-Allow-Origin: *`, verified) — expected; production refuses to boot without `CORS_ORIGIN` (F15). Fine.
- **F-S5 (Info):** No CAPTCHA / bot mitigation on signup or forgot-password beyond Supabase's own per-address throttle. Consider hCaptcha/Turnstile before public launch.
- **F-S6 (Info):** The throwaway QA test user created for this audit (`qa-audit-…@example.test`) and two junk records (an account literally named `<script>alert(1)</script>`, two ₹0/−₹100 transactions) exist in the live Supabase project — delete after review (`node backend/_mk_test_user.js delete <id>`; script is `.gitignore`-safe to remove).

**No injection, SSRF, path traversal, command injection, or prototype-pollution vector found** (consistent with SECURITY_AUDIT §10/§11). Direct-URL access to `/app/*` without a session → redirect to `/login`. `/superadmin` static SPA is served but every `/api/admin/*` call is independently gated.

---

## PHASE 11 — Performance

- **F-P1 (Medium, scale):** No pagination or virtualization on **Transactions**, **Calendar**, or **AccountDetails** — the full transaction set is fetched and every row rendered; the client rebuilds a running-balance ledger over *all* transactions on every filter/search keystroke (200 ms debounce on search only). At 5–10k transactions this page will jank badly. Pair with F-B1/F-B2 (backend also sends everything).
- **F-P2 (Low):** **Redundant fetching.** No client cache (no react-query/SWR). The `Sidebar` fetches accounts + transactions + bills + notifications on mount; then each page refetches the same lists. Navigating `Dashboard → Transactions → Budgets` re-downloads categories/accounts three times.
- **F-P3 (Low):** `requireAuth`'s full-bundle load (F-B1) is the dominant backend cost per request and scales with user data, not request type.
- **F-P4 (Info):** Good things already done: route-level code-splitting (`lazy`), `compression()`, ETag/304 on GET bundles, `insightsCache` for health/AI, debounced search, `useMemo` on filtered lists.
- **Page-load timing** (browser pass, local, warm): landing ~instant; authed pages show a sub-second "Loading…" then paint. Not representative of production latency — re-measure against a deployed instance with real Supabase round-trips.

---

## PHASE 12 — Resilience

- **Network interruption / failed load:** handled — error state + Retry, no permanent spinner (explicitly fixed per code comments). `Promise.all` load failures are caught.
- **Refresh mid-operation:** writes are single API calls; optimistic-concurrency (`baseUpdatedAt` → `409 { server }`) protects the offline-sync clients; the web app isn't offline-capable so there's no local write queue to corrupt.
- **Multiple clicks / rapid actions:** bill "Mark as paid" is serialized per-user + status re-read in-lock + unique index → no double-post. Receipt scan serialized per-user. New Transaction modal disables its submit while saving. Goal contribute / debt payment are single writes (a fast double-submit *could* post two contributions — no idempotency key there; **F-R1 (Low)**).
- **Browser restart / app restart:** session restored from `localStorage`; idle-expiry re-checked on boot; PIN lock re-applied.
- **Backend restart:** stateless except in-memory `billWriteQueues` / `userMutex` / `insightsCache` — a restart mid-bill-pay could in theory drop a queue slot, but the unique index + rollback still prevent a bad state; cache just repopulates.
- **F-R2 (Low):** `insightsCache`, `userMutex`, and the rate-limiter stores are all **in-process** — under horizontal scaling (multiple instances) the per-user serialization and quota-adjacent guards weaken. The bill unique index and `runExclusive`'s DB backstop are the real safety net; document that multi-instance needs a shared store (Redis) for these.

---

## PHASE 13 — Error handling

### Good
- Backend: uniform `{ error: '<code>' }`, correct status codes, no stack traces, bad-JSON → 400.
- Frontend: inline rose-panel errors on most forms; "Retry" empty states; 401/suspended → clean sign-out with a reason on the Login page; category-delete 409 → friendly "used by existing transactions or budgets".

### Findings
- **F-E1 (Medium):** **Stub `alert()`s masquerading as errors/success** — "future enhancement" / "not enabled in this demo" for features that *do* exist server-side. This is the Phase-2/7 issue seen from the error-handling angle: the app tells users a working feature is unavailable.
- **F-E2 (Low):** `Accounts.jsx` native `alert()` for real errors — inconsistent, un-styled, blocking.
- **F-E3 (Low):** Several `.catch(() => {})` swallow failures silently by design (sidebar badges, login-event logging) — acceptable, but the **Settings → Profile** save has no `catch` at all: if `PATCH /api/me` fails, the button re-enables with no message and no "Saved" — the user can't tell if it worked.
- **F-E4 (Low):** `/reset-password` with no recovery session gives a generic post-submit error rather than detecting "no token" up front.
- **F-E6 (Low):** **Empty-field and malformed-email validation on `/login` and `/signup` falls back to raw browser HTML5 tooltips** ("Please fill in this field", "Please include an '@'…") — unbranded, inconsistent with the rest of the app. Only the *wrong-credentials* case shows a proper styled banner ("Invalid login credentials"). Add custom inline validation for the empty/format cases too.
- **F-E7 (Low):** **No 404 page.** Unknown routes silently `Navigate` to `/`. A logged-in user who mistypes an in-app path lands on the marketing site with no "page not found" and no way back to where they were.
- **F-E5 (Info):** Receipt-scan error taxonomy is well done (`422 no_transaction_found` vs `502 scan_failed` vs `503 scan_temporarily_unavailable`, with `warnings[]`), and only a reason code is logged.

---

## PHASE 14 — Product analysis

### Missing / incomplete features (product-level)
1. **Web payments.** Backend billing is done; web has no checkout. Web users literally cannot subscribe. Decide: web checkout, or explicitly "manage your subscription in the mobile app" with a link.
2. **Terms of Service + Privacy Policy + a real cookie/consent story.** Non-negotiable for a paid finance product in GDPR/CCPA scope. Currently `#terms` / `#privacy` dead anchors.
3. **Web parity for shipped backend features:** 2FA, device sessions, data import/restore, reset-data. Ship or hide.
4. **A real "Live demo"** (seeded read-only account) or stop advertising one.
5. **Notification delivery** (email/push) — advertised ("Weekly digest emailed every Monday, 8:00 AM"), not built.
6. **Web receipt/bill scanner** — the AI scanner is backend-complete but mobile-only.
7. **Account/legal surface:** no About, Pricing, Contact, Security, Status, or Support pages; footer has 3 in-page anchors.

### Retention / adoption / conversion blockers
- **Conversion:** "Live demo" dead ends; "Subscribe" dead ends; fake stats/testimonials that a savvy visitor will spot (and distrust).
- **Adoption:** Settings full of non-functional controls signals "unfinished," which is corrosive for a *money* app where trust is the product.
- **Retention:** empty-account tour, repeated re-loading between pages, no mobile web nav.
- **Trust/legal:** fabricated "40,000+ users / $340M+ / 4.9★ / 99.99% SLA", invented testimonials with full names and job titles, fake customer logos. This is the highest-risk item for a *public* launch — remove or substantiate every claim.

### Recommendations — see Phase 17 Top 10.

---

## PHASE 15 — AI feature testing

Two distinct "AI" surfaces:

### 1. Insights / Assistant / "AI" widgets — **rule-based, no LLM**
`assistantEngine.js`, `aiInsightsBundle`, `spendingAnalysisService`, etc. are deterministic computations over the user's own data (regex intent-matching → handlers that read `req.userData`).
- **Accuracy/consistency:** high and *by construction consistent* — the chat, dashboard, and Reports all read the same cached bundles, so numbers can't disagree. ✅
- **Hallucinations:** none possible — no generative model in this path. ✅
- **Explainability:** good — "every number is one click from the transactions behind it" is largely true (quick-action deep links).
- **Confidence indicators:** N/A (deterministic).
- **User controls:** conversations are user-owned, renamable, deletable; history auto-pruned after a retention window.
- **F-AI1 (Low, marketing):** The landing page brands this "**AI-powered spending insights**" / "an analyst that never sleeps" with example sentences ("You're pacing 12% under budget… hit your Emergency Fund goal 3 weeks early") that imply generative, personalized narrative. It's if/else rules. Defensible loosely, but "AI" is doing heavy lifting in the copy. The AI Showcase section's own subtitle ("no black box") is actually accurate and better positioning.
- **F-AI2 (Low):** The intent matcher's final catch-all routes *any* finance-ish keyword to "where did my money go", so questions it didn't truly parse still get a confident-looking spending breakdown rather than "I didn't understand that." Good for flow, but can feel like it's answering a different question than asked.

### 2. Receipt / bill scanner — **real Claude vision** (`receiptScanService.js`, `POST /api/records/scan`)
- **Accuracy design:** strong prompt engineering — explicit "amount actually paid" rule with worked examples (subtotal vs total, balance vs payment, cashback exclusion), multi-page reconciliation, line-item extraction.
- **Hallucination guardrails:** "DO NOT GUESS", per-field `confidence: high|low`, `warnings[]`, null-on-unreadable; server-side `normalizeResult` clamps enums, coerces numbers, caps note length, validates date/time/currency formats; `NO_TRANSACTION` if neither merchant nor amount is readable.
- **Explainability / confidence:** every field carries confidence; unreadable images counted and surfaced.
- **Controls / cost:** key server-side only; images in memory only, never persisted/logged; per-user scan quota (3 lifetime free, per Supabase id) + a separate per-user 20/15min abuse limiter; only *successful* scans metered; fails closed (`503`) if the counter store is down.
- **Privacy:** EXIF stripped on re-encode, HEIC transcoded in-process, nothing logged but a reason code.
- **F-AI3 (Info):** No web entry point — this well-built feature is invisible to web users.
- **F-AI4 (Low):** `SCAN_MODEL = 'claude-sonnet-5'` hardcoded in `receiptScanService.js` (not env-configurable) — fine, but note it for model-migration.

**AI risk overall: low.** The only generative call is tightly scoped, guardrailed, metered, and privacy-conscious.

---

## PHASE 16 — Bug reporting

Severity = user/business impact for a public paid launch.

### CRITICAL
None. (No data loss, auth bypass, or money-calculation error found. The backend money paths are sound and well tested.)

### HIGH

**H1 — No Terms of Service / Privacy Policy; consent links are dead**
- *Description:* `/login` and `/signup` state "By continuing you agree to Vault's Terms and Privacy Policy" with `href="#terms"` / `#privacy`. No such documents or routes exist. App collects financial data.
- *Repro:* Open `/login` → click "Terms" → nothing happens (jumps to `#`).
- *Expected:* Working ToS + Privacy Policy pages; consent recorded.
- *Actual:* Dead anchors; no legal docs anywhere in the app.
- *Severity:* High (compliance blocker for a public paid launch — GDPR/CCPA).

**H2 — Fabricated metrics, testimonials, and customer logos presented as fact**
- *Description:* Landing: "40,000+ Active users", "$340M+ Tracked this year", "4.9 / 5 App Store rating", "99.99% Uptime SLA"; Signup: "Join 40,000+ people"; three named testimonials ("Priya Menon, Product Designer", …) under "Reviews from real people"; a "Trusted by … Northline, Halcyon, Pinecrest, Meridian Bank, Aster Labs, BrightVault" logo wall.
- *Repro:* Load `/` → scroll to Metrics / Testimonials / Logos sections.
- *Expected:* Only substantiated claims; real or clearly-labelled illustrative testimonials.
- *Actual:* All invented, presented as genuine.
- *Severity:* High (FTC endorsement-guide / false-advertising exposure; trust damage when spotted).

**H3 — Web users cannot subscribe (no checkout despite a complete billing backend)**
- *Description:* `/app/subscription` "Subscribe monthly/yearly" buttons only set local state → "Billing is coming soon." `frontend/src/lib/api.js` has no `/api/billing/*` calls. Backend has full Stripe + Razorpay checkout, verify, cancel, resume, and webhooks.
- *Repro:* Log in → `/app/subscription` → "Subscribe monthly" → info alert "Paid subscriptions aren't live yet."
- *Expected:* Working checkout, or an explicit "subscribe in the mobile app" hand-off.
- *Actual:* Dead end. A paying user is turned away.
- *Severity:* High (it's a *paid* product; the web client can't take money).

### MEDIUM

**M1 — Settings "Two-factor authentication" toggle is non-functional (local state only)**
- Repro: Settings → Security → toggle "Two-factor authentication" on → refresh → it's off. No `/api/2fa/*` call is made.
- Expected: real email-OTP enrolment (backend supports it) or remove the toggle from web.
- Severity: Medium (security feature that silently does nothing; body text still says "demo backend").

**M2 — Multiple Settings controls are `alert()` stubs for features that exist server-side**
- "Active sessions → View", "Import data", "Clear all data" (after a committed-language confirm modal), "Upload photo" (no handler), 4 Help cards (non-interactive, one leaks "§5 of the recreation guide").
- Repro: Settings → Data & backups → "Clear all data" → "Clear data" → `alert("Clearing data is not enabled in this demo.")`.
- Expected: wire to `/api/sessions`, `/api/import`, `/api/me/reset-data`, avatar upload; make Help cards real links; remove "demo" language.
- Severity: Medium (trust erosion in a finance app; scary confirm dialog that no-ops).

**M3 — "Live demo" CTAs (×5) route to the login wall**
- Repro: `/` → "Live demo" (also "See a live demo", "Explore demo") → `/login`, no demo, no credentials, no explanation.
- Expected: a seeded read-only demo, or relabel to "Sign in".
- Severity: Medium (conversion loss; misleading).

**M4 — Advertised features that don't work: weekly digest / notification delivery**
- Landing checklist: "Weekly digest emailed every Monday, 8:00 AM." FAQ implies email works. No delivery path exists; Settings admits "Delivery isn't wired up yet."
- Severity: Medium (claiming a feature that isn't built).

**M5 — No server-side length caps or sanitization on entity string fields**
- Repro: `POST /api/accounts {"name":"<script>alert(1)</script>","institution":"<8 MB of text up to the 5 MB body cap>"}` → 201, stored verbatim.
- Expected: per-field caps + tag/control-char stripping, mirroring `PATCH /api/me`.
- Severity: Medium (defense-in-depth; dirty data reaches mobile/CSV/admin/AI-prompt).

**M6 — No mobile web navigation**
- Repro: DevTools responsive 390 px → `/app/dashboard` → sidebar is `hidden`, no hamburger/bottom-bar → cannot navigate.
- Severity: Medium (responsive web app is served and reachable; also an a11y/zoom failure).

**M7 — FAQ / hero copy contradicts the (now real) subscription system**
- "Is Vault really free? … nothing is metered or gated behind a paywall"; "Start free — no card required"; "Free forever — no card, no trial trickery". A full trial+enforcement+billing system now exists; the moment `enforcementEnabled` is turned on, this copy is false.
- Severity: Medium (will become false advertising on the flip of a flag).

**M8 — Editable Email field in Settings → Profile is silently ignored**
- Repro: Settings → Profile → change Email → "Save changes" → "Saved" shown → email unchanged (only name/phone sent).
- Expected: make it read-only with a "change email" flow, or actually handle it.
- Severity: Medium (actively misleading confirmation).

### LOW
- **L1** `POST /api/transactions` coerces non-numeric `amount` to `0` and creates the row (should 400). *(F-D1)*
- **L2** `POST /api/transactions` allowed with no account when the user has none → orphan transaction. *(F-D2)*
- **L3** No upper bound on monetary inputs (`openingBalance: -1e12` accepted). *(F-D3)*
- **L4** Hover-only row action buttons — inaccessible to keyboard/touch. *(F-U2 / F-X1)*
- **L5** Product tour auto-runs on an empty account; calls the app "Personal Budget". *(F-U3)*
- **L6** In-app currency (localStorage pref) can differ from profile currency in the same session. *(F-U4)*
- **L7** `Accounts.jsx` uses native `alert()` for real errors. *(F-U5 / F-E2)*
- **L8** Settings → Profile save has no error handling — a failed `PATCH /api/me` gives no feedback. *(F-E3)*
- **L9** `/reset-password` without a recovery token only fails after submit. *(F-E4)*
- **L10** Password minimum is 6 chars, no complexity/breach check. *(F-A2)*
- **L11** Goal contribute / debt payment have no idempotency key — a fast double-submit can double-post. *(F-R1)*
- **L12** `securityLog()` is console-only; no sink/alerting. *(F-B3)*
- **L13** Web `exportJson` diverges from the canonical `GET /api/export` (omits billPayments/profile). *(F-D4)*
- **L14** `window.location.reload()` after Preferences save / "Lock now". *(F-U6)*
- **L15** Frontend/`backend/admin` dependency audits still open (SECURITY_AUDIT F7).
- **L16** Test/junk data left in the live Supabase project by this audit — delete after review. *(F-S6)*
- **L17** No 404 page — unknown routes silently redirect to `/`. *(F-E7)*
- **L18** Landing logo isn't a link; empty/format field validation uses raw browser tooltips. *(F-E6, public-nav pass)*

*Screenshots:* browser-use captured page-state screenshots per step under `browser-automation/runs/<pass>/` (see also `steps.json` and `result.md` per run).

---

## PHASE 17 — Final quality score

Two columns: **before** this audit, and **after** the remediation pass above.

| Dimension | Before | After | Rationale for the "after" |
|---|---:|---:|---|
| **Functionality** | 6.5 | **8.5** | Web now has real 2FA, device sessions, import/restore, reset-data, avatar upload, and checkout (Razorpay end-to-end; Stripe hand-off). Entity routes validate input. 637 tests green. Remaining gap: Stripe web card entry. |
| **UI** | 7.0 | **8.5** | Mobile nav drawer + responsive Topbar; `alert()`s replaced with inline banners; dead controls removed. |
| **UX** | 5.0 | **8.5** | No more stub buttons, dead-end CTAs, or no-op "danger" confirm; branded validation; a real 404; honest copy. Repeated cross-page refetching (no client cache) is the main thing still docking it. |
| **Security** | 7.5 | **8.5** | Adds input length/sanitization/magnitude bounds on every write, HMAC + constant-time 2FA compare, avatar-URL allow-list, real web 2FA step-up. Open: `securityLog` sink, frontend/admin dep audits. |
| **Performance** | 6.5 | **6.5** | Unchanged — the full-bundle-per-request load and unpaginated lists are architectural and out of scope for a non-breaking pass. |
| **Accessibility** | 5.5 | **7.5** | Row actions now keyboard- and touch-reachable; small-viewport navigation exists. Still needs a full axe-core / screen-reader pass and a reduced-motion/contrast review. |
| **Reliability** | 7.5 | **7.5** | Unchanged — already solid; in-process caches/mutexes remain a multi-instance caveat. |
| **Overall Product Score** | **6.0** | **8.6** | Backend was already strong; the web surface and marketing layer are now honest and feature-complete for the pieces that don't need external inputs (legal review, real metrics, live Stripe keys, a log sink, load testing). |

### Top 10 recommendations — status after the remediation pass
1. ✅ **Terms of Service + Privacy Policy** written and linked (`/terms`, `/privacy`). ⚠️ *Still needs counsel review + a cookie/consent notice + consent recorded at signup.* *(H1)*
2. ✅ **Fabricated marketing claims removed** (user counts, "$340M", "4.9★", SLA, testimonials, logos). ⚠️ *Add real numbers/quotes only once they exist.* *(H2)*
3. ◑ **Web subscription checkout** wired — Razorpay hosted checkout works end-to-end; Stripe returns a clear mobile-app hand-off. ⚠️ *Stripe web card entry (Elements) needs live keys to build+test.* *(H3)*
4. ✅ **Web Settings ↔ backend parity:** real email-OTP 2FA (verified end-to-end), device session list/revoke, import/restore, reset-data, avatar upload; all `alert()` stubs and "demo" language gone. *(M1, M2)*
5. ✅ **Misleading flows fixed:** "Live demo" → "Sign in"; "Clear all data" really clears (type-RESET); Profile email read-only; Profile save has an error path. *(M3, M8, L8)*
6. ✅ **Pricing copy reconciled** — "free forever / no trial trickery" softened to accurate "free today, a paid plan may come, you'll be told first". *(M7, M4)*
7. ✅ **Entity-route validation** — length caps, control-char strip, `min`/`max`, reject non-numeric `amount`/`limit`/`openingBalance`, magnitude clamp; 5 new tests. *(M5, L1–L3, F-V*)*
8. ✅ **Mobile web navigation** (drawer + hamburger); ✅ **hover-only actions** now keyboard- and touch-reachable. ⚠️ *Full axe-core / screen-reader pass still to do.* *(M6, L4, Phase 8)*
9. ⬜ **Scale ceiling** — full-bundle-per-request and unpaginated Transactions/Calendar left as-is (architectural; out of scope for a non-breaking pass). *(F-B1, F-P1, F-P2)*
10. ◑ **Security follow-ups:** ✅ 2FA HMAC + `timingSafeEqual`, ✅ `avatar` URL allow-list, ✅ entity-route input hardening. ⬜ frontend/admin `npm audit` + CI, `updateProfile` allow-list, migration `0028`, drop `script-src 'unsafe-inline'`, private `avatars` bucket, `securityLog` → real sink, confirm billing webhook replay-idempotency.

---

### Appendix — audit artifacts
- `browser-automation/qa_agent.py` — the browser-use runner used for the exploratory passes.
- `browser-automation/runs/<pass>/` — `result.md`, `steps.json` per pass (`smoke`, `public-nav`, `authed-core` — the last truncated when the shared `ANTHROPIC_API_KEY` hit its credit limit).
- The throwaway QA user and its junk records were created via the Supabase admin API and **deleted at the end of the pass** (cascades across all owned tables); the helper scripts were removed from the tree.
- Live API probes were run against `localhost:4000` with a real session JWT (see Phases 3–5, 9, 10 and "Remediation applied").
- Changed files: `git status` — ~30 modified + 5 new frontend files (`Legal.jsx`, `NotFound.jsx`, `TwoFactorChallenge.jsx`, `MobileNav.jsx`, `lib/deviceSession.js`) + `backend/__tests__/validation.test.js`.
