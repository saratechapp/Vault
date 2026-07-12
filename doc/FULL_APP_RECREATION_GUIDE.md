# Vault — Full App Recreation Guide

> **Purpose of this document.** This is the single-source-of-truth guide for
> the *actual* Wallet / "Vault" application as it stands today. It is written
> so that another Claude Code session (or a developer) can recreate the same
> app end-to-end without reading any other file. Everything below reflects
> what has been built, not what has been planned.
>
> **Last updated:** 2026-07-03 (Recurring & Bills merger · Goals CRUD · themed Contribute modal · Debts strategy callout · data-driven notifications · Modal component enhancements)

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [Tech stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Complete feature list](#4-complete-feature-list)
5. [Recently added / updated features](#5-recently-added--updated-features)
6. [Folder & file structure](#6-folder--file-structure)
7. [UI theme & design system](#7-ui-theme--design-system)
8. [Reusable component library](#8-reusable-component-library)
9. [Application pages (every route)](#9-application-pages-every-route)
10. [Dashboard widget system](#10-dashboard-widget-system)
11. [Data model & mock data (`sampledata.json`)](#11-data-model--mock-data-sampledatajson)
12. [Backend API reference](#12-backend-api-reference)
13. [Frontend state management](#13-frontend-state-management)
14. [Application logic details](#14-application-logic-details)
15. [User flows (step by step)](#15-user-flows-step-by-step)
16. [Routing map](#16-routing-map)
17. [User roles & permissions](#17-user-roles--permissions)
18. [Security](#18-security)
19. [Setup & run instructions](#19-setup--run-instructions)
20. [Responsive behavior](#20-responsive-behavior)
21. [Future enhancements](#21-future-enhancements)
22. [Instructions for Claude Code to recreate this app](#22-instructions-for-claude-code-to-recreate-this-app)

---

## 1. Project overview

- **App name:** Vault (working name; product concept: "Wallet" — personal finance manager)
- **Category:** Personal finance / budgeting / net-worth tracking (single-user, self-hosted-friendly)
- **Target users:** Individuals who track their own finances across multiple accounts, budgets, goals and debts and want a **premium, calm, data-dense workspace** on the desktop web.
- **Business problem:** Existing budgeting apps are either mobile-only, ad-heavy, or feature-thin. Users want one workspace that combines accounts, transactions, budgets, bills, goals, debts and reports with real customization and multi-currency support.
- **Solution:** A React web app with a Node/Express backend that persists data (encrypted at rest) to a JSON file. The UI is premium SaaS-style (glassmorphism, gradient accents, both light & dark themes) with a customizable dashboard.
- **Product goal:** Deliver an enterprise-looking, feature-parity-with-competitors (BudgetBakers Wallet, Money Manager, Expenses Manager) web app that can be extended into a real product.
- **Platform focus:** **Desktop web only** (mobile-responsive is out of scope for now).

---

## 2. Tech stack

### Frontend
- **React** 18.3
- **Vite** 5.3 (dev server + build)
- **React Router** 6.24 (`BrowserRouter`, `Routes`, `Route`, `Navigate`, `Link`, `NavLink`)
- **Tailwind CSS** 3.4 (utility-first, custom design tokens driven by CSS variables)
- **Recharts** 2.12 (all charts — Area, Bar, Line, Pie, RadialBar)
- **Lucide React** 0.400 (all icons)
- **PostCSS** 8.4 + **Autoprefixer** 10.4

### Backend
- **Node.js** with **Express** 4.19
- **compression** — gzip responses
- **cors** — permissive during dev
- **morgan** — request logging
- **nodemon** (dev)
- Node's built-in `crypto` for AES-256-GCM

### External services (frontend, free)
- **Fawaz Ahmed's Currency API** via jsDelivr CDN + a fallback host — live FX rates. No auth, no CORS issues.

---

## 3. Architecture

```
┌───────────────────────────────────────────────────────────────┐
│ Browser                                                       │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ React app (Vite dev on :5173)                            │ │
│  │  ┌──────────────┐  ┌───────────────┐  ┌───────────────┐  │ │
│  │  │  Contexts    │  │ Pages/Routes  │  │  UI library   │  │ │
│  │  │  (Auth,      │  │               │  │  (Button,     │  │ │
│  │  │  Theme,      │  ├───────────────┤  │  Card, Chip,  │  │ │
│  │  │  Prefs,      │  │  Layouts      │  │  Modal, …)    │  │ │
│  │  │  NewTx)      │  └───────────────┘  └───────────────┘  │ │
│  │  └──────────────┘                                        │ │
│  │        │                                                 │ │
│  │        └──── fetch("/api/*") ────┐                       │ │
│  │                                  │                       │ │
│  │  localStorage:                   │                       │ │
│  │    wallet_theme, wallet_prefs_v1,│                       │ │
│  │    wallet_dashboard_layout_v1,   │                       │ │
│  │    wallet_fx_v1, wallet_pin_v1,  │                       │ │
│  │    wallet_user, wallet_token     │                       │ │
│  └──────────────────────────────────┼───────────────────────┘ │
└─────────────────────────────────────┼─────────────────────────┘
                                      │  Vite proxy → :4000
                                      ▼
┌───────────────────────────────────────────────────────────────┐
│  Express API (:4000)                                          │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  server.js (endpoints + response cache + ETag)         │   │
│  │  ┌────────────────────────────────────────────────┐    │   │
│  │  │  In-memory `db` + precomputed `idx`            │    │   │
│  │  │  (dashboard, transactions, budgets, reports)   │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  │                       │                                │   │
│  │  crypto.js:  AES-256-GCM encrypt/decrypt               │   │
│  └────────────────────────────────────────────────────────┘   │
│                          │                                    │
│                          ▼                                    │
│  backend/sampledata.json  (encrypted JSON envelope on disk)   │
│  backend/.data-key        (256-bit key, auto-generated)       │
└───────────────────────────────────────────────────────────────┘
```

### Data flow

- All UI data comes from `/api/*` endpoints via `fetch`. There is no WebSocket / long-polling.
- Response caching: strong ETags on Express + a per-endpoint in-memory string cache keyed on an `etagBase` that flips on any write. `Cache-Control: private, max-age=30, must-revalidate` means the browser can revalidate cheaply.
- After any write, the response cache is cleared, indexes are recomputed, and the file is re-encrypted atomically (`.tmp` write → rename).

---

## 4. Complete feature list

### Landing / Marketing
- Sticky top nav with theme toggle
- Hero with heading gradient + CTA + trust bar
- Interactive hero product preview (mini cards + sparkline SVG)
- Trusted-by logos strip
- 6-item feature grid
- Product preview with financial health card
- Metrics band (users, tracked, rating, uptime)
- 3-column testimonials
- 3-tier pricing (Free / Pro / Family)
- Collapsible FAQ
- Bottom CTA + footer

### Authentication
- Login (email/password, Google/Apple stubs, "Keep me signed in", forgot-password link)
- Signup (name/email/password + strength meter + terms checkbox)
- Auto-logout on inactivity (configurable, with 60-second warning modal)
- PIN lock (4–8 digits, hashed with SHA-256 + salt via Web Crypto; per-session unlocked flag)
- Sign out (both from sidebar and PIN screen)
- Note: the demo backend accepts any credentials — auth is presentational, not enforced.

### Dashboard
- Customizable widget grid (drag & drop, add / remove, span 1-2-3)
- Layout persisted in localStorage
- 11 widgets available
- Fixed horizontal-scroll accounts strip (frosted glass with color halo)
- Toolbar with Customize / Reset / Add card
- Auto-reload when a transaction is created anywhere in the app

### Accounts
- Summary cards (Total assets / Total debt / Net worth)
- Full CRUD per account
- Colored gradient cards with icon per account
- Balance derived from opening balance + net movement

### Transactions
- 4 stat cards (Income / Expense / Transfers / Net) — respect filters
- Search + filter by type / account / category
- Import (CSV) + Export (CSV, filter-aware)
- Global Add Record modal (Income / Expense / Transfer)
- Templates dropdown + "save as template" toggle
- Category-aware label suggestions (chips)
- Delete + edit affordances per row
- Two-column Add Record modal (see § 15)

### Categories
- CRUD with sub-category support (parent picker)
- Icon picker (~80 curated icons, grouped, searchable)
- Color palette (18 swatches)
- Backend refuses delete if the category is in use

### Templates
- CRUD via Settings → Templates
- Auto-populates the Add Record form when selected
- "Create template from this record" checkbox in Add Record

### Budgets
- Full CRUD with weekly / monthly / yearly / custom periods
- Custom period includes start & end dates
- Alert threshold (default 80%)
- Overall progress card + per-category cards
- Color-coded progress by usage (brand < 75% < amber < 90% < rose)

### Recurring & Bills
- Single unified page (sidebar and topbar label: **Recurring & Bills**; URL: `/app/bills`).
- Recurring rules are modelled as **bills with `autoPost: true`** — on the due date the backend posts a real transaction and advances `dueDate`.
- Grouped by Pending / Paid.
- Urgency detection (≤ 5 days = red).
- Add / edit modal covers Type (expense/income), Amount, Category label + posting Category (`categoryId`), Due date, Frequency, Paid-from account, Payment method, Vendor, Note, plus two independent checkboxes: **Auto-post to ledger** (`autoPost`) and **Autopay is set up** (`autopay`).
- Cards render a 🔄 **Auto-post** chip when `autoPost=true`; the amber ⚡ **Autopay** chip is purely cosmetic.
- Hover reveals ⚡ **Run now** and ⏸ **Pause** icons on auto-post rows; **Mark as paid** is hidden for auto-post bills (the generated transaction is the proof of payment).
- Backend posts due auto-post bills on boot and logs `[auto-post] checked (N active) · generated K scheduled transaction(s).`.
- Legacy `recurringRules[]` on disk are migrated into `bills[]` one time on first boot; the migration is non-destructive.

### Savings Goals
- Full CRUD (create · edit · delete) via a themed `GoalModal` covering Goal name, Target, Saved so far, Deadline, Priority (High/Medium/Low), Planned monthly contribution, Note, and a 10-swatch color picker.
- Cards reveal ✏️ Edit and 🗑 Delete affordances on hover; a themed delete-confirmation modal guards destructive actions.
- Validation: name required, target > 0, saved ≤ target.
- Full progress + pace calculation, on-track/behind pace chip, deadline + monthly need.
- **Contribute** action opens a themed `ContributeModal` (size `sm`) with the goal summary card at top, an auto-focused amount input, quick-add chips (`+₹500`, `+₹1,000`, `+₹5,000`, `+₹10,000`, `Max (₹<remaining>)`), and a live preview panel showing projected balance / progress / percent (with a `🎉 Target reached` badge and an amber overshoot warning when applicable). The primary button label updates dynamically (`Add ₹10,000` / `—` / `Already reached`).
- The **Highest priority** hero panel is data-driven — goals sorted by priority rank (high>medium>low) then completion %, and it shows *"No goals yet"* when empty.
- Empty state on first visit surfaces an "Add your first goal" CTA. Deep links `?add=1` and `?contribute=<goal_id>` open the corresponding modal on navigation.

### Debts (payoff planner)
- CRUD + summary cards (total debt, monthly minimum, average APR)
- Snowball vs. Avalanche simulator
- Interactive extra-payment slider
- Line chart of total balance over months
- Payoff date + total interest projection
- **Strategy callout is always visible** on both tabs. It detects three cases dynamically: (a) when the two strategies converge on the same timeline (typical when the highest-APR debt is also the smallest balance), it explains *why*; (b) when one strategy wins, it names the winner and its savings; (c) when viewing the sub-optimal tab, it offers a **"Switch to {winner}"** shortcut link.

### Reports
- Overview tab: income vs. expense bar chart, top vendors, category share pie
- By-category tab: horizontal bar chart
- Trends tab: monthly comparison bar chart
- CSV export (trend + categories)

### Notifications center
- **Auto-generated from real user data** via `generateNotificationsFor(userData)` on the backend — no more hand-seeding.
- Triggers, in priority order (danger → warning → success → info):
  - **Bill overdue** (danger, red **Bill** chip) — pending bill with `dueDate < today`
  - **Bill due soon** (warning, amber **Bill** chip) — pending bill with `dueDate ≤ today + 5 days`
  - **Over budget** (danger, red **Budget** chip) — budget where `spent ≥ limit`
  - **Budget alert** (warning, amber **Budget** chip) — budget where `spent ≥ alertAt%`
  - **Goal reached** (success, emerald **Goal** chip) — goal where `saved ≥ target`
  - **Inactivity insight** (info, cyan **Insight** chip) — latest transaction ≥ 7 days old
- Each derived row has a deterministic ID (`gen_<kind>_<sourceId>`) so re-runs don't duplicate.
- **Persistence overlay:** `userData.notifications` now stores minimal `{ id, read?, dismissed? }` state records keyed on the generated IDs, so read state and dismissals survive backend restarts. Any legacy hand-seeded rows whose IDs don't start with `gen_` continue to render — the system is backward compatible.
- Filters: All / Unread / Budget / Bills / Goals / Insights.
- Per-notification type icon + colored tone chip (the frontend `Notifications.jsx` respects the server-provided `tone` so "Bill overdue" renders red and "Bill due soon" renders amber despite both sharing `type: 'bill'`).
- Mark read + mark-all read + dismiss.
- Unread counter badge on the tab.
- API surface unchanged: `GET /api/notifications`, `PATCH /:id`, `DELETE /:id`, `POST /read-all`.

### Multi-currency
- 90+ currencies with local formatting
- 180+ countries with default currency + timezone mapping
- Country change auto-updates currency + timezone
- Add multiple tracked currencies with **live FX rates + inverse** and refresh
- Date format picker (4 options with live preview)

### Preferences
- Country / currency / language / date format / time zone
- Additional currencies list (live rates)
- Theme (Light / Dark)
- Compact tables, weekly digest toggles
- On save → soft reload so amounts/dates re-format everywhere

### Security
- **AES-256-GCM at rest** for `backend/sampledata.json`
- Key resolution: `WALLET_DATA_KEY` env var → `backend/.data-key` (auto-generated)
- Plaintext → encrypted migration on first boot
- Atomic writes (`.tmp` → rename)
- Auto-logout on inactivity (5 min → 2 h options)
- PIN lock

### Global affordances
- Global **New transaction** modal available from Topbar on any page
- Global theme toggle in Topbar, Sidebar-adjacent Auth screens, and Landing
- Global notification bell in Topbar (links to Notifications center)
- Sticky sidebar + sticky Topbar

---

## 5. Recently added / updated features

Track of what has been added most recently, most-recent first.

### 5.-1a Recurring & Bills merged into one page (Jul 2026)
- The dedicated Recurring rule collection has been retired. Every rule is now expressed as a **bill with `autoPost: true`**.
- The Settings → Recurring tab and the `RecurringPanel` component have been removed. The sidebar/topbar label for `/app/bills` is now **Recurring & Bills**.
- Bill schema gained the `autoPost` boolean (advances `dueDate` and posts a real transaction on due date, replacing the old recurring generator) alongside the existing `autopay` cosmetic flag.
- Add/edit modal now covers Type (expense/income), Amount, Category label + posting Category (`categoryId`), Due date, Frequency, Paid-from account, Payment method, Vendor, Note, and two checkboxes: **Auto-post to ledger** and **Autopay is set up**.
- Bill cards render a 🔄 **Auto-post** chip when `autoPost=true`, plus ⚡ **Run now** and ⏸ **Pause** hover icons. **Mark as paid** is hidden for auto-post bills.
- Backend endpoints: **`/api/recurring/*` are removed**. `POST /api/bills/:id/run` replaces the old `POST /api/recurring/:id/run`. Existing `recurringRules[]` on disk are migrated into `bills[]` on first boot (one-time, non-destructive).
- Boot log now reads `[auto-post] checked (N active) · generated K scheduled transaction(s).` (previously `[recurring]`).

### 5.-1b Modal component enhancements (Jul 2026)
- `components/ui/Modal.jsx` now caps at `max-h-[90vh]` with a **sticky header + sticky footer + scrollable body**. Long modals (Add-bill, GoalModal, category modal, etc.) no longer spill off-screen.
- Header has a bottom border; footer has a top border plus a subtle tint.
- Enter animation: backdrop fades in and the card scales up subtly (`animate-modalIn` and `animate-modalPop` in tailwind config).
- Accessibility: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` wired to the modal title.
- Every existing caller (Bills, Goals, Debts, Budgets, delete confirmations, CSV import, Add Record, PIN prompts, etc.) benefits automatically.

### 5.-1c Savings goals — CREATE / UPDATE / DELETE (Jul 2026)
- Backend adds `POST /api/goals`, `PATCH /api/goals/:id`, `DELETE /api/goals/:id`. `POST /api/goals/:id/contribute` remains.
- Frontend `GoalModal` covers: Goal name, Target, Saved so far, Deadline, Priority (High/Medium/Low), Planned monthly contribution, Note, and a 10-swatch color picker.
- Hover on a goal card reveals ✏️ Edit and 🗑 Delete affordances; delete is guarded by a themed confirmation modal.
- Validation: name required, target > 0, saved ≤ target.
- Empty state with an "Add your first goal" CTA.
- The **Highest priority** hero panel is now data-driven — sorted by priority rank (high>medium>low) then completion %; shows *"No goals yet"* when empty. (Previously hardcoded "Emergency Fund · 85% complete".)
- `?add=1` deep-link opens the modal on navigation.

### 5.-1d Contribute — themed modal (Jul 2026)
- Replaces the old `window.prompt('Contribute amount (₹)?', '5000')` native dialog.
- New `ContributeModal` (a size `sm` themed modal) with:
  - Goal summary card at top (icon in the goal's color, name, saved/target, current %, colored progress bar).
  - Auto-focused amount input.
  - Quick-add chips: `+₹500`, `+₹1,000`, `+₹5,000`, `+₹10,000`, plus `Max (₹<remaining>)`.
  - Live preview panel as user types: projected balance, projected progress bar, projected %, `🎉 Target reached` badge when the amount hits the target, amber warning when the amount overshoots.
  - Primary button label updates dynamically: `Add ₹10,000` / `—` / `Already reached` (disabled when goal fully funded).
  - Rose validation error for amount ≤ 0.
- Backend contribute still caps `saved` at `target`.
- `?contribute=<goal_id>` deep-link opens the modal for that goal.

### 5.-1e Debts — Avalanche vs Snowball callout improved (Jul 2026)
- Previously the callout only appeared on the Avalanche tab and only when the strategies differed.
- Callout is now **always visible on both tabs** and dynamically detects three states:
  - **Convergence** — when both strategies produce identical timelines (typical when the highest-APR debt is also the smallest balance), it explains: *"Both strategies produce the same result for your current debts — this usually means the highest-APR debt is also the smallest balance…"*.
  - **Winner** — either strategy can win depending on the debts; the callout names it plus the interest / months saved.
  - **Switch shortcut** — when the current tab isn't the winner, a **"Switch to {winner}"** link jumps to the better strategy.

### 5.-1f Notifications — auto-generated from real data (Jul 2026)
- Backend now derives notifications from actual user state via `generateNotificationsFor(userData)` on every read. Triggers: bill overdue, bill due soon, over budget, budget alert (`spent ≥ alertAt%`), goal reached, inactivity insight (latest transaction ≥ 7 days old).
- Each has a deterministic ID (`gen_<kind>_<sourceId>`) so re-runs don't duplicate.
- **Persistence overlay:** `userData.notifications` now stores minimal `{ id, read?, dismissed? }` state records keyed on the generated IDs so read state and dismissals survive backend restarts. Legacy hand-seeded rows (id not starting with `gen_`) continue to render — the system is backward compatible.
- Sorted danger → warning → success → info.
- API surface unchanged (`GET /api/notifications`, `PATCH /:id`, `DELETE /:id`, `POST /read-all`).
- Frontend `Notifications.jsx` now respects the server-provided `tone` field, so "Bill overdue" renders red and "Bill due soon" renders amber even though both share `type: 'bill'`.

### 5.0a Real multi-user authentication (Jul 2026)
- Backend now stores users in a `users[]` array with **scrypt-hashed** passwords + per-user random salts (Node's built-in `crypto.scryptSync`, timing-safe compare).
- `POST /api/auth/signup` creates a new user + a fresh seed dataset (`createSeedUserData()`); `POST /api/auth/login` verifies the hash; `POST /api/auth/logout` invalidates the token.
- Each signup/login mints a random opaque token (`wtok_<64 hex>`) held in an in-memory `sessions` Map **and mirrored into `db.sessions`** so the encrypted data file preserves them across restarts. Sessions have a 30-day expiry.
- Frontend `api.js` attaches `Authorization: Bearer <token>` on every request. 401 responses on auth endpoints surface as form errors; 401 on any other endpoint clears localStorage and redirects to `/login`.
- Data is **per-user**: `db.userData[<userId>]` holds accounts / transactions / budgets / bills (including auto-post bills that replaced the old recurring rules) / goals / debts / categories / templates / notifications overlay / health breakdown. Every protected endpoint scopes reads and writes to `req.userData` (populated by the `requireAuth` middleware).
- Migration path: if the file was still in the old single-user shape, it's wrapped under a demo user (`demo@example.com` / `demo1234`) on first boot.
- The demo `Login` prefill was removed — you now start with an empty form (or sign up fresh).
- **AuthContext** persists `token` + `user` to `localStorage` **synchronously** inside `login()` / `signup()` (not in a `useEffect`) so the first API call after login already carries the token.

### 5.0b Bills — full CRUD (Jul 2026)
- Backend now exposes `POST /api/bills` and `DELETE /api/bills/:id` (previously only `GET` + `PATCH`).
- Bills page ([frontend/src/pages/Bills.jsx](../frontend/src/pages/Bills.jsx)) rebuilt with a proper **Add / Edit modal** covering name, amount, category (Rent, Utilities, Subscription, Insurance, Credit Card, Loan, Internet, Phone, Other), due date, frequency (one-time / weekly / monthly / yearly), paid-from account, and autopay flag.
- Hover any pending or paid bill for ✏️ Edit and 🗑 Delete affordances plus a `Clock3` icon on paid rows to revert to pending.
- Empty state — before any bills exist — shows an inviting "Add your first bill" card.

### 5.0c Live-computed analytics (Jul 2026)
The backend `computeIndexesFor()` derives all these from actual transactions instead of relying on static seed arrays:
- **`spendingTrend`** — 7 monthly buckets ending on the current month, `income` and `expense` summed by transaction date via `buildSpendingTrend()`.
- **`categorySpend`** — current-month expense totals per category via `buildCategorySpend()`, sorted descending.
- **`metrics.monthlyIncome / monthlyExpense / savingsRate`** — derived from the trend series with real MoM delta pills via `buildMetrics()`.
- **`metrics.totalBalance`** — sum of derived account balances.
- **`budget.spent`** — via `computeBudgetSpent()` which respects the budget's window (weekly / monthly / yearly / custom start-end) **and includes sub-categories** of the budget's category.

### 5.0d Sub-category fix + Category CRUD tightening (Jul 2026)
- Backend `POST /api/categories` and `PATCH /api/categories/:id` now accept and validate `parentId` (previously the field was silently dropped, which broke sub-category creation from the UI).
- Guards: parent must exist, parent cannot itself be a sub-category (no grandchildren), a category cannot become its own parent, and a category with existing children cannot be demoted into a sub-category.

### 5.0e Insight widget — computed, not hardcoded (Jul 2026)
- The previous "AI insight — dining down 22%" was a static placeholder. `InsightWidget` in [widgets.jsx](../frontend/src/pages/dashboard/widgets.jsx) now runs `computeInsight(data)` which picks (in order): month-over-month expense delta, biggest current-month category, first-month kicker, income-only.
- Widget renamed in the registry from "AI Insight" → "This month's insight" with an honest description.

### 5.0f Chart tooltip fix (Jul 2026)
- Every chart tooltip (`ChartTip`, `CategoryTip`) uses **explicit hex background colors from the theme context**, not the previous glassmorphism `bg-surface` that Recharts / some browsers were rendering translucent.
- Light: `#ffffff`; Dark: `#111334`. Border and text colors similarly explicit.

### 5.0g Dynamic sidebar badges + Topbar cleanup (Jul 2026)
- Sidebar badge counts (Accounts, Transactions, Bills, Notifications) are now **live-fetched from `/api/accounts`, `/api/transactions`, `/api/bills`, `/api/notifications`** — no more hardcoded `5` / `23`. Bills badge counts only *pending* bills; Notifications badge counts *unread*.
- The Topbar search input (⌘K stub) has been **removed**. Search lives on the Transactions page only, and it's now **wider** — matches vendor, note, category name, labels, payer, payment method, account name(s), and from/to account names.
- The Transactions filter toolbar now shows a **`Reset filters (N)`** button whenever any filter is active.

### 5.0h Response cache correction (Jul 2026)
- Backend `Cache-Control` changed from `private, max-age=15, must-revalidate` → `private, no-cache`. The browser now revalidates via ETag on every GET (server responds with `304` when nothing changed). Fixes "edit doesn't reflect until page refresh".

### 5.0i Reworked label suggestions (Jul 2026)
- Suggestion chips now appear for all three tabs (Expense / Income / Transfer), not just for category-picking tabs.
- Scope selection is per-type: transfers pull from other transfers; income/expense prefer same-category, then same-type, then all-history.
- Category names and account names are filtered out of suggestions to avoid mis-entries.

### 5.0j Add Record modal — Vendor field restored + fresh state on open (Jul 2026)
- The Vendor / Source / Description input (label adapts to the type tab) is required for income/expense; transfer treats it as an optional Description.
- Every open in "new record" mode resets the form to blank defaults, preventing stale values from a previous cancelled attempt.
- Modal supports **edit mode** via `openForEdit(txn)` on the global `NewTransactionContext`; title flips to "Edit record", template picker + "save as template" toggle are hidden, and the bottom buttons become **Cancel / Save changes** side-by-side.

### 5.1 Global "New transaction" modal (Jul 2026)
- Extracted `NewTransactionModal` into `frontend/src/components/NewTransactionModal.jsx`
- New `NewTransactionContext` provider at `frontend/src/context/NewTransactionContext.jsx` — lazy-loads pickers, owns modal open state, renders the modal once at layout level
- Added helper hook `useTxCreatedListener(fn)` — pages call it to auto-refresh their lists on save
- Topbar's **New transaction** button now works from every page
- `Transactions.jsx` and `Dashboard.jsx` both subscribe to the create event

### 5.2 Category-aware label suggestions (Jul 2026)
- Labels field in Add Record now shows removable chips for currently-picked labels + suggestion chips below
- Suggestions are frequency-ranked from transactions in the currently-selected category
- Fallback to global most-used labels if category has no history

### 5.3 Templates (Jul 2026)
- Backend: `GET/POST/PATCH/DELETE /api/templates`
- Frontend: Settings → **Templates** panel (CRUD)
- "Select template" dropdown in Add Record modal actually applies a template
- "Create template from this record" checkbox creates a template on save

### 5.4 Recurring transactions (Jul 2026, superseded by 5.-1a)
- *Superseded by the Recurring & Bills merger — see §5.-1a. Historically:* a separate rules collection with `processRecurringRules()` at boot and a Settings → Recurring panel; today those rules live in `bills[]` with `autoPost: true` and are handled on the Recurring & Bills page.

### 5.5 CSV Import + Export (Jul 2026)
- New utility `frontend/src/lib/csv.js` (RFC-4180 parser + serializer + Blob download)
- New `CsvImportModal` with drag-drop, delimiter auto-detect, column mapping preview, default account/category, and bulk-create
- Working Export buttons on Transactions (filter-aware) and Reports (trend + categories)

### 5.6 Debts (payoff planner) (Jul 2026)
- New page `/app/debts` + sidebar entry
- Backend `GET/POST/PATCH/DELETE /api/debts`
- Snowball vs. Avalanche simulator with interactive slider, timeline chart and savings-vs-strategy comparison message

### 5.7 Sub-categories (Jul 2026)
- Category schema gains optional `parentId`
- Categories tab groups sub-categories under their parent, with an "Add sub-category" button per parent card
- Category modal has a Parent category selector

### 5.8 Custom budget periods (Jul 2026)
- Budgets: `period: 'weekly' | 'monthly' | 'yearly' | 'custom'`
- Custom period exposes start-date and end-date pickers
- Backend `POST/PATCH/DELETE /api/budgets`

### 5.9 Notifications center (Jul 2026)
- New page `/app/notifications`
- Backend adds `PATCH /:id`, `POST /read-all`, `DELETE /:id`
- Topbar bell now navigates to the center

### 5.10 PIN lock (Jul 2026)
- Storage in `frontend/src/lib/pin.js`, hashed with SHA-256 + per-user salt via Web Crypto
- Full-screen number-pad unlock (`components/PinLockScreen.jsx`)
- Settings → Security: set / change / remove + Lock now
- Session-scoped unlocked flag in `sessionStorage`

### 5.11 Auto-logout on inactivity (Jul 2026)
- Idle timer hook + warning modal with 60-second countdown
- Configurable duration in Security (5 / 10 / 15 / 30 / 60 / 120 min)
- Any activity restarts the timer; warning modal is not silently dismissed by activity

### 5.12 AES-256-GCM data at rest (Jul 2026)
- `backend/crypto.js` — JSON envelope `{ v, algorithm, iv, tag, data }`
- Auto-generated `.data-key` on first boot; env var override supported
- Plaintext → encrypted migration on first boot

### 5.13 Multi-currency + additional currencies (Jul 2026)
- 90+ currencies + 180+ countries
- Live FX via Fawaz Ahmed's Currency API with 1-hour cache
- Add Currency modal (rate + inverse + refresh)
- Country change auto-updates currency + timezone

### 5.14 Customizable dashboard (Jun–Jul 2026)
- Persistent layout in localStorage
- Drag & drop reorder
- Column-span cycle (1/2/3)
- Add Card modal from a widget library

### 5.15 Multi-account model + transfers (Jun–Jul 2026)
- Account entity (bank/savings/credit/cash/wallet)
- Transaction gains `accountId` for income/expense and `fromAccountId`/`toAccountId` for transfers
- Backend recomputes account balances from `openingBalance + net movement`

### 5.16 Frosted-glass accounts strip on Dashboard
- Horizontal-scroll pills with account color halo + ghost icon
- "Add account" dashed slot at the end
- Snap points on scroll

---

## 6. Folder & file structure

```
Wallet/
├── .gitignore                          # ignores node_modules, dist, backend/.data-key
├── README.md
├── backend/
│   ├── crypto.js                       # AES-256-GCM encrypt/decrypt + key mgmt
│   ├── package.json                    # deps: express, cors, morgan, compression
│   ├── sampledata.json                 # ENCRYPTED at rest (JSON envelope)
│   ├── server.js                       # Express app + endpoints
│   └── .data-key                       # 256-bit key (gitignored, auto-generated)
├── doc/                                # documentation
│   ├── FULL_APP_RECREATION_GUIDE.md    # <— this file
│   ├── Wallet_App_Master_Documentation_Index.md
│   ├── Wallet_App_FREE_Version_Complete.md
│   ├── Wallet_App_Launch_Strategy_Market_Viability.md
│   ├── Feature_Comparison_Removed_vs_Kept.md
│   ├── Bank_API_Costs_Breakdown.md
│   ├── Wallet_App_Complete_Missing_Screens.md
│   └── Wallet_App_Complete_Screen_Design_List.md
├── frontend/
│   ├── index.html                      # pre-hydration theme + Google Fonts
│   ├── package.json                    # deps: react, react-router-dom, recharts, lucide-react
│   ├── postcss.config.js
│   ├── tailwind.config.js              # semantic tokens (bg-app, text-fg, border-line, etc.)
│   ├── vite.config.js                  # port 5173, proxy /api → http://localhost:4000
│   └── src/
│       ├── App.jsx                     # routes + providers
│       ├── index.css                   # design tokens + component classes
│       ├── main.jsx                    # ReactDOM.createRoot + BrowserRouter
│       ├── components/
│       │   ├── CsvImportModal.jsx      # CSV upload → map → preview → bulk POST
│       │   ├── IdleLogoutManager.jsx   # idle timer + warning modal
│       │   ├── NewTransactionModal.jsx # global Add Record modal
│       │   ├── PinLockScreen.jsx       # full-screen unlock number pad
│       │   ├── Sidebar.jsx             # left nav
│       │   ├── ThemeToggle.jsx         # sun/moon icon button
│       │   ├── Topbar.jsx              # sticky top nav (breadcrumb, search, bell, +tx)
│       │   └── ui/
│       │       ├── Button.jsx          # variants: primary/ghost/outline/danger
│       │       ├── Card.jsx            # + CardHeader
│       │       ├── ChartTooltip.jsx    # ChartTip + CategoryTip
│       │       ├── Chip.jsx            # tone variants
│       │       ├── EmptyState.jsx
│       │       ├── IconPicker.jsx      # searchable grouped icon grid
│       │       ├── index.js            # barrel export
│       │       ├── Input.jsx           # Input + Select + Field
│       │       ├── KpiCard.jsx         # KPI with delta pill
│       │       ├── Modal.jsx           # Esc-to-close + body scroll lock
│       │       ├── ProgressBar.jsx     # auto-tone + custom color
│       │       ├── SectionHeader.jsx   # eyebrow + heading + subtitle
│       │       └── Toggle.jsx          # + ToggleRow
│       ├── context/
│       │   ├── AuthContext.jsx         # user, token, login/signup/logout
│       │   ├── NewTransactionContext.jsx # global modal open state + event bus
│       │   ├── PreferencesContext.jsx  # country/currency/timezone/date/language
│       │   └── ThemeContext.jsx        # 'light' | 'dark' with localStorage
│       ├── hooks/
│       │   └── useIdleTimer.js         # window-event-based idle timer with pause
│       ├── layouts/
│       │   └── AppLayout.jsx           # sidebar + topbar + outlet + PIN gate + idle mgr
│       ├── lib/
│       │   ├── api.js                  # fetch wrapper + formatCurrency + formatDate
│       │   ├── categoryIcons.js        # ~80 curated Lucide icons + 18-color palette
│       │   ├── csv.js                  # parse/serialize/download helpers
│       │   ├── fx.js                   # Fawaz Ahmed FX API + 1-hour cache
│       │   ├── pin.js                  # setPin/verifyPin/isUnlocked
│       │   └── preferences.js          # CURRENCIES / COUNTRIES / LANGUAGES / TIMEZONES / DATE_FORMATS
│       └── pages/
│           ├── Accounts.jsx
│           ├── Bills.jsx
│           ├── Budgets.jsx
│           ├── Dashboard.jsx
│           ├── Debts.jsx
│           ├── Goals.jsx
│           ├── Landing.jsx
│           ├── Login.jsx
│           ├── Notifications.jsx
│           ├── Reports.jsx
│           ├── Settings.jsx
│           ├── Signup.jsx
│           ├── Transactions.jsx
│           └── dashboard/
│               ├── useDashboardLayout.js  # localStorage-backed layout state
│               └── widgets.jsx            # 11 widget components + registry
├── screen/                                 # reference wireframes (functionality only)
```

---

## 7. UI theme & design system

### Design language

- **Dark-first** premium SaaS aesthetic (glassmorphism, soft radial gradients, gentle color blobs).
- **Full light mode** driven by the same CSS-variable tokens.
- Rounded, generous spacing, subtle borders, tabular numerals for money.
- Two typefaces: **Inter** for body, **Plus Jakarta Sans** for display headings.

### Design tokens (CSS variables — `frontend/src/index.css`)

Values are `R G B` triplets so Tailwind's `rgb(var(--x) / <alpha-value>)` works.

**Light theme (`:root`)**

| Token              | Value              | Purpose                             |
| ------------------ | ------------------ | ----------------------------------- |
| `--app`            | 248 250 253        | Page background                     |
| `--surface`        | 255 255 255        | Card background                     |
| `--surface-2`      | 245 247 252        | Elevated / muted surface            |
| `--surface-3`      | 238 241 249        | Hover / third layer                 |
| `--fg`             | 15 23 42           | Main text                           |
| `--muted`          | 71 85 105          | Secondary text                      |
| `--subtle`         | 148 163 184        | Tertiary text                       |
| `--line`           | 226 232 240        | Borders                             |
| `--line-strong`    | 203 213 225        | Emphasized borders                  |
| `--tint`           | 0 0 0              | Additive tint (=black in light)     |

**Dark theme (`html.dark`)**

| Token              | Value              |
| ------------------ | ------------------ |
| `--app`            | 5 6 20             |
| `--surface`        | 17 19 52           |
| `--surface-2`      | 23 26 64           |
| `--surface-3`      | 30 34 78           |
| `--fg`             | 238 240 251        |
| `--muted`          | 163 169 212        |
| `--subtle`         | 107 115 179        |
| `--line`           | 38 42 85           |
| `--line-strong`    | 58 64 128          |
| `--tint`           | 255 255 255        |

**Ambient gradient** — the body has a two-blob radial gradient in both themes.

### Brand palette (`tailwind.config.js`)

- **`brand` (indigo)** — 50 → 900 (Tailwind indigo scale). Primary is `brand-500` `#6366f1`; hover `brand-400`; deeper `brand-700`.
- **`accent`** — `cyan #22d3ee`, `purple #a855f7`, `pink #ec4899`, `lime #84cc16`, `amber #f59e0b`, `rose #f43f5e`, `teal #14b8a6`.

### Semantic Tailwind color aliases (added in `tailwind.config.js`)

```js
colors: {
  app:            'rgb(var(--app) / <alpha-value>)',
  surface:        'rgb(var(--surface) / <alpha-value>)',
  'surface-2':    'rgb(var(--surface-2) / <alpha-value>)',
  'surface-3':    'rgb(var(--surface-3) / <alpha-value>)',
  fg:             'rgb(var(--fg) / <alpha-value>)',
  muted:          'rgb(var(--muted) / <alpha-value>)',
  subtle:         'rgb(var(--subtle) / <alpha-value>)',
  line:           'rgb(var(--line) / <alpha-value>)',
  'line-strong':  'rgb(var(--line-strong) / <alpha-value>)',
  tint:           'rgb(var(--tint) / <alpha-value>)',
  brand: { /* 50-900 */ },
  accent: { /* cyan, purple, pink, lime, amber, rose, teal */ },
}
```

**Use these tokens exclusively** in components so light/dark switch just works.
Common utility patterns:
- Backgrounds: `bg-app`, `bg-surface`, `bg-tint/5`, `bg-tint/[0.03]`
- Text: `text-fg`, `text-fg/80`, `text-muted`, `text-subtle`
- Borders: `border-line`, `border-line-strong`

### Typography

- Font stacks in `tailwind.config.js`:
  - `font-sans`: `Inter, ui-sans-serif, system-ui, sans-serif`
  - `font-display`: `"Plus Jakarta Sans", Inter, sans-serif`
- Google Fonts loaded in `index.html` with `preconnect`.
- Headings use `font-display font-bold` and, when hero-styled, add `.heading-gradient`.
- Money values use `font-display font-bold` for large numbers and `tabular-nums` inside tables.

### Component classes (declared in `@layer components` inside `index.css`)

- `.card` — surface + `border-line` + rounded 2xl + subtle inset + soft shadow. `html.dark .card` uses `rgb(var(--surface) / 0.6)` + blur.
- `.card-strong` — bigger radius, `border-line-strong`, stronger shadow.
- `.glass` / `.glass-strong` — translucent surface + border + blur.
- `.chip` — pill: rounded-full, border-line, `bg-tint/4`.
- `.btn` + `.btn-primary` / `.btn-ghost` / `.btn-outline` / `.btn-danger`.
- `.input`, `.label` — form primitives.
- `.divider` — horizontal fade line.
- `.heading-gradient` — text-gradient (`fg → brand-500 → fg`).
- `.link-underline` — underline that animates in on hover.
- `.grid-bg` — decorative subtle grid with a radial mask.

### Shadows

- `soft`: `0 10px 40px -12px rgba(15,23,42,0.25)`
- `glow`: `0 0 60px -10px rgba(99,102,241,0.45)`
- `card`: `0 1px 0 rgb(var(--tint)/0.05) inset, 0 8px 30px -12px rgba(0,0,0,0.4)`

### Spacing / radius

- Card padding: `p-5` default, `p-6` for wider content, `p-8` for feature blocks.
- Card radius: `rounded-2xl` (16px) default, `rounded-3xl` for hero.
- Button radius: `rounded-xl` (12px).
- Chip radius: `rounded-full`.
- Sidebar width: `w-[260px]`.
- Content max width: `max-w-[1600px]`.

### Interaction states

- `hover:` — always defined for buttons, chips, links, list rows.
- `active:` — `active:scale-[0.98]` on `.btn`.
- `focus:` — `.btn:focus-visible` gets a 2 px brand ring.
- `disabled:` — `disabled:opacity-60` and `disabled:opacity-70` on primary CTAs.
- Cards used as list items usually have `group` + hover-reveal action buttons via `opacity-0 group-hover:opacity-100`.

### Icons

- **Lucide React** — never emoji in the UI. Wallet-related icons: `Wallet`, `Landmark`, `PiggyBank`, `CreditCard`, `Smartphone`.
- Category icons come from a curated set in `lib/categoryIcons.js`.

---

## 8. Reusable component library

Every UI primitive lives in `frontend/src/components/ui/` and is re-exported from `ui/index.js`. Import with:

```js
import { Button, Card, CardHeader, Chip, KpiCard, ProgressBar, Input, Field, Select,
         Toggle, ToggleRow, Modal, SectionHeader, EmptyState, ChartTip, CategoryTip, IconPicker }
  from '../components/ui/index.js';
```

### `Button`

- **Props:** `variant` (`primary` default | `ghost` | `outline` | `danger`), `size` (`sm | md | lg | icon`), `leftIcon`, `rightIcon`, `fullWidth`, `as` (polymorphic — `<Button as={Link} to="/x">`), plus native button props.
- **File:** `components/ui/Button.jsx`.

### `Card` + `CardHeader`

- **Card props:** `strong` (bool), `padding` (`none | sm | md | lg | xl`), `hover` (bool), `as`, `className`.
- **CardHeader props:** `title`, `subtitle`, `right`.

### `Chip`

- **Props:** `tone` (`neutral | brand | success | danger | warning | info`), `leftIcon`, `children`, `style`.

### `ProgressBar`

- **Props:** `value` (0-100), `max` (default 100), `size` (`xs | sm | md | lg`), `tone` (`brand | success | warning | danger | info`), optional `color` override (any CSS color — makes a gradient from the color to `color+90` alpha), `className`.
- Auto-tones by percentage when `tone` is not given (`>=90 → danger, >=75 → warning, else brand`).

### `KpiCard`

- **Props:** `label`, `value`, `delta` (number, %), `icon`, `tone` (`brand | lime | rose | cyan | amber`), `hint`, `invertDelta`.

### `Input`, `Select`, `Field`

- **Input props:** `leftIcon`, `rightSlot`, `className`, plus native input props.
- **Select** — thin wrapper around native `<select>` with `.input` styles.
- **Field props:** `label` (string | ReactNode), `hint`, `error`, `children`, `className`.

### `Toggle`, `ToggleRow`

- **Toggle props:** `checked`, `onChange(next: boolean)`, `disabled`, `label`.
- **ToggleRow props:** `title`, `body`, `checked`, `onChange`.

### `Modal`

- **Props:** `open`, `onClose`, `title`, `subtitle`, `footer`, `size` (`sm | md | lg | xl`), `children`.
- **Behavior:** Esc to close, backdrop click to close, body scroll lock while open.
- **Layout:** capped at `max-h-[90vh]` with a **sticky header** (bottom border), a **scrollable body**, and a **sticky footer** (top border + subtle tint). Long content — Add-bill, GoalModal, category modal, CSV import, etc. — scrolls inside the body instead of overflowing the viewport.
- **Enter animation:** backdrop fades in and the card scales up subtly via `animate-modalIn` / `animate-modalPop` (see `tailwind.config.js`).
- **Accessibility:** wired with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing at the modal title.

### `SectionHeader`

- **Props:** `eyebrow`, `title`, `subtitle`, `align` (`center | left`).

### `EmptyState`

- **Props:** `icon`, `title`, `body`, `action`.

### `ChartTooltip` — `ChartTip`, `CategoryTip`

- Custom Recharts `Tooltip` content components. `ChartTip` shows all payload rows; `CategoryTip` shows the category name + amount (for pies).

### `IconPicker`

- **Props:** `value` (icon name), `onChange(name)`, `color`.
- Searchable grid of ~80 Lucide icons, grouped by domain (Money, Food & Drink, Transport, Shopping, Home, Bills & Utilities, Entertainment, Health, Education & Work, Travel, Pets, Misc).

### Non-UI reusable components

- `Sidebar` — sticky left nav with brand mark, section list (Dashboard, Accounts, Transactions, Budgets, **Recurring & Bills**, Savings goals, Debts, Reports, Notifications, Settings), upgrade card, user chip. **Badges next to Accounts / Transactions / Recurring & Bills (pending) / Notifications (unread) are live-computed from the API**; the notifications badge uses an urgent (rose) tone.
- `Topbar` — sticky top nav with breadcrumb title, theme toggle, notifications bell (with dynamic unread counter), **New transaction** button (opens the global modal via `useNewTransaction().open()`), user chip. No search box — searching is done from the Transactions page.
- `ThemeToggle` — sun/moon icon button that toggles theme
- `NewTransactionModal` — full Add Record modal (see § 15)
- `CsvImportModal` — 3-stage import (drop → map → preview) with bulk POST
- `IdleLogoutManager` — mounts a modal that appears after idle threshold
- `PinLockScreen` — full-screen number-pad unlock

---

## 9. Application pages (every route)

Each page below lists **route · purpose · layout · components · user actions**.

### 9.1 Landing (`/`)

- **Purpose:** Marketing home; hero + product preview + features + pricing + FAQ + CTA.
- **Layout:** Full-width, own header (not Topbar).
- **Components used:** `Button`, `Card`, `SectionHeader`, `ThemeToggle`; local `Nav`, `Hero`, `HeroPreview`, `Logos`, `Features`, `ProductPreview`, `Metrics`, `Testimonials`, `Pricing`, `FAQ`, `CTA`, `Footer`, `SparkChart` (SVG), `MiniCard`, `MiniGoal`.
- **User actions:** Sign in, Get started (→ signup), toggle theme, jump to feature sections.

### 9.2 Login (`/login`) and Signup (`/signup`)

- **Purpose:** Auth pages. Signup has a live password strength meter.
- **Layout:** Two-pane split (brand pane on one side, form on the other). Theme toggle in the top-right of the form pane.
- **Signup:** Fields — Full name, Work email, Password (show/hide + strength bars + label Weak/Fair/Good/Strong), Terms checkbox, submit, link back to Login.
- **Login:** Fields — Email, Password (show/hide), Keep me signed in, error banner, Google/Apple stub buttons.
- **On success:** navigate to `/app/dashboard`.

### 9.3 Dashboard (`/app/dashboard`)

- **Purpose:** Personal financial overview with a **customizable widget grid**. Accounts strip is fixed at the top.
- **Toolbar:** date-range chip · `Reset` · `Add card` · `Customize / Done` toggle.
- **Sections:**
  1. Horizontal-scroll frosted-glass accounts strip (fixed).
  2. Overview toolbar.
  3. 3-column customizable widget grid (drag & drop, span 1/2/3).
  4. Empty state when the layout has no widgets.
- **See § 10 for widgets.**

### 9.4 Accounts (`/app/accounts`)

- **Summary cards:** Total assets, Total debt, Net worth.
- **List:** grid of colored account cards (icon + name + type + institution + balance + inflow/outflow/txn count).
- **Actions:** Add / Edit / Delete via `AccountModal`. Modal has a type picker (Bank / Savings / Credit / Cash / Wallet), color swatches, opening balance.

### 9.5 Transactions (`/app/transactions`)

- **Stat cards:** Income · Expense · Transfers · Net (filtered).
- **Filter bar:** search, type dropdown, account dropdown, category dropdown, "More filters" (stub), Import (CSV), Export (CSV — filter-aware), New transaction.
- **Table:** vendor + category chip + account pill (or from→to for transfers) + date + colored amount + edit/delete.
- **Empty state** with reset-filters CTA.

### 9.6 Budgets (`/app/budgets`)

- **Summary cards:** Total budget · Total spent · Remaining · Overall usage.
- **Overall progress card** with big progress bar.
- **Grid:** per-category cards with icon in gradient tile, spent/limit, progress bar, over/left chip.
- **Actions:** New budget / Edit / Delete via `BudgetModal`. Period picker Weekly · Monthly · Yearly · Custom (Custom exposes start/end date).

### 9.7 Recurring & Bills (`/app/bills`)

- Sidebar and topbar label: **Recurring & Bills**. URL preserved as `/app/bills`.
- **Summary cards:** Total this month · Paid · Pending.
- **Sections:** Pending (grid of cards with urgency color) · Paid (list). Auto-post rows sit in Pending until the backend posts them; the generated transaction is the proof.
- **Chips per card:** 🔄 **Auto-post** (present when `autoPost=true`) · amber ⚡ **Autopay** (cosmetic — indicates the user has autopay wired up on the biller side).
- **Hover affordances:** ⚡ Run now (posts the auto-post immediately) · ⏸ Pause · ✏️ Edit · 🗑 Delete. **Mark as paid** is hidden for auto-post bills.
- **Add / Edit modal** fields: Type (expense/income) · Amount · Category (label — string) · Category (posting — `categoryId`) · Due date · Frequency · Paid-from account · Payment method · Vendor · Note · **Auto-post to ledger** checkbox · **Autopay is set up** checkbox.
- **Backend endpoint** `POST /api/bills/:id/run` forces an immediate execution of an auto-post bill (replaces the retired `POST /api/recurring/:id/run`).

### 9.8 Goals (`/app/goals`)

- **Header strong card** with total progress, a data-driven "Highest priority" summary (ranked by priority then completion %, "No goals yet" when empty), and a "New goal" button.
- **Grid:** per-goal card with icon in gradient tile, saved/target, progress bar, deadline chip, monthly need, on-track chip. Hover reveals ✏️ Edit and 🗑 Delete plus a **Contribute** button.
- **GoalModal (create / edit)** fields: Goal name · Target · Saved so far · Deadline · Priority (High/Medium/Low) · Planned monthly contribution · Note · 10-swatch color picker. Validation: name required, target > 0, saved ≤ target.
- **Delete** is guarded by a themed confirmation modal.
- **Contribute** opens a themed size `sm` `ContributeModal` — goal-summary card up top, auto-focused amount input, quick-add chips (`+₹500`, `+₹1,000`, `+₹5,000`, `+₹10,000`, and `Max (₹<remaining>)`), live preview panel (projected balance / progress bar / percent, `🎉 Target reached` badge, amber overshoot warning), and a dynamic primary button label (`Add ₹10,000` / `—` / `Already reached`).
- **Empty state** with an "Add your first goal" CTA.
- **Deep links:** `?add=1` opens the create modal · `?contribute=<goal_id>` opens the contribute modal on that goal.

### 9.9 Debts (`/app/debts`)

- **Stat cards:** Total debt · Monthly minimum · Average APR · # debts.
- **List of debt cards.**
- **Payoff planner card:**
  - Extra monthly payment slider + numeric input
  - Strategy selector: **Avalanche** (highest APR first) vs. **Snowball** (smallest balance first) — pills describing each
  - Summary: Debt-free in, Est. payoff date, Total interest
  - Line chart of total balance across months
  - **Strategy callout** — always visible on both tabs. Detects convergence (both strategies produce the same timeline) and explains it, otherwise names the winning strategy and its savings. When the current tab isn't the winner, includes a **"Switch to {winner}"** shortcut link.
- **Actions:** New / Edit / Delete debt via `DebtModal` (name, creditor, balance, APR, min payment, due date).

### 9.10 Reports (`/app/reports`)

- **Stat cards:** Total income · Total expense · Net savings · Savings rate.
- **Tab switcher** (Overview / By category / Trends).
- **Overview tab:** monthly Income vs. Expense bar chart · top vendors list with horizontal bars · category-share donut + legend.
- **By category tab:** horizontal bar chart of category amounts using each category's color.
- **Trends tab:** monthly income vs. expense bar chart.
- **Export CSV** button downloads trend + categories.

### 9.11 Notifications (`/app/notifications`)

- **Header card:** count of unread + `Mark all read`.
- **Filter tabs:** All / Unread / Budget / Bills / Goals / Insights.
- **List of notifications** — auto-derived from live user state (bill overdue / due-soon, over budget / budget alert, goal reached, inactivity insight). Each row shows a type icon, title, body, a colored tone chip (red / amber / emerald / cyan matching the server-provided `tone`), and a dot when unread. Hover reveals mark-read + dismiss.
- **Sorting:** danger → warning → success → info.
- **State persistence:** read state and dismissals are stored as a lightweight `{ id, read?, dismissed? }` overlay keyed on deterministic `gen_<kind>_<sourceId>` IDs, so state survives backend restarts. Legacy hand-seeded rows still render.

### 9.12 Settings (`/app/settings`)

- **Left rail:** vertical section nav (Profile / Preferences / Categories / Templates / Notifications / Security / Data & backups / Help & support) + Sign out. (The former **Recurring** section was retired — recurring rules now live as auto-post bills on the **Recurring & Bills** page; see §9.7.)
- **Profile panel:** avatar + upload stub + editable name/email/phone + readonly Plan.
- **Preferences panel:** Location & currency section (country, currency, timezone, language, date format with 4-card picker) + Currencies list (add/remove tracked currencies with live rate + inverse) + Theme picker (Light/Dark) + toggles for compact tables & weekly digest. Save button reloads the page.
- **Categories panel:** grouped view of categories → sub-categories with per-item edit/delete, `Add category` and per-parent `Add sub-category`. Category modal has icon picker + color palette + parent selector.
- **Templates panel:** CRUD grid.
- **Notifications panel:** static toggles for delivery preferences.
- **Security panel:** PIN row (set/change/remove + Lock now) + 2FA/Biometric toggle stubs + Automatic sign-out (with idle timeout picker: 5/10/15/30/60/120 min) + Change password + Active sessions stubs.
- **Data & backups panel:** CSV/JSON export stubs, Backup now stub, danger zone.
- **Help & support panel:** cards for support, security disclosure, changelog, community.

---

## 10. Dashboard widget system

Widget metadata lives in `frontend/src/pages/dashboard/widgets.jsx` (`WIDGET_REGISTRY`). Layout state lives in `frontend/src/pages/dashboard/useDashboardLayout.js` and is persisted to `localStorage['wallet_dashboard_layout_v1']`.

### Widget registry (id → title, defaultSpan, component)

| id                    | title                     | defaultSpan | icon         | Component                     |
| --------------------- | ------------------------- | ----------- | ------------ | ----------------------------- |
| `cashflow`            | Cash Flow                 | 2           | LineChart    | `CashFlowWidget`              |
| `health`              | Financial Health Score    | 1           | ShieldCheck  | `HealthWidget`                |
| `expenses-structure`  | Expenses Structure        | 1           | PieChart     | `ExpensesStructureWidget`     |
| `bills`               | Upcoming Bills            | 1           | CalendarDays | `BillsWidget`                 |
| `goals`               | Top Goals                 | 1           | Target       | `GoalsWidget`                 |
| `transactions`        | Recent Transactions       | 3           | ArrowLeftRight| `TransactionsWidget`         |
| `insight`             | This month's insight      | 3           | Sparkles     | `InsightWidget` (computed via `computeInsight()`) |
| `balance-trend`       | Balance Trend             | 1           | Activity     | `BalanceTrendWidget`          |
| `period-comparison`   | Period to Period          | 1           | ArrowLeftRight| `PeriodComparisonWidget`     |
| `top-vendors`         | Top Vendors               | 1           | Store        | `TopVendorsWidget`            |
| `savings-rate`        | Savings Rate              | 1           | PiggyBank    | `SavingsRateWidget`           |

Default layout (`DEFAULT_LAYOUT`):

```js
[
  { id: 'w-cashflow',      type: 'cashflow',           span: 2 },
  { id: 'w-health',        type: 'health',             span: 1 },
  { id: 'w-expenses',      type: 'expenses-structure', span: 1 },
  { id: 'w-bills',         type: 'bills',              span: 1 },
  { id: 'w-goals',         type: 'goals',              span: 1 },
  { id: 'w-transactions',  type: 'transactions',       span: 3 },
  { id: 'w-insight',       type: 'insight',            span: 3 },
]
```

Layout API (from `useDashboardLayout()`): `layout`, `add(type, span)`, `remove(id)`, `move(fromId, toId)`, `setSpan(id, span)`, `reset()`.

### Drag-and-drop implementation (native HTML5)

- Each widget's outer `<div>` sets `draggable={editing}`.
- `onDragStart`: `e.dataTransfer.effectAllowed = 'move'`, sets `text/plain` (Firefox needs it), stores dragging id.
- `onDragOver`: `e.preventDefault()` + tracks overId.
- `onDrop`: calls `move(dragId, overId)`.
- Dragging card gets `opacity-40 scale-[0.98]`; drop target gets a brand ring.
- Edit mode also shows three per-card controls in the top-right: **span cycle**, **delete**, **drag handle**.

### Accounts strip (fixed above the widget grid)

- Horizontal scroll (`flex overflow-x-auto snap-x snap-mandatory`).
- Each account pill is `w-[240px] shrink-0` with a colored halo (two blurred gradient blobs behind the pill), a small pulsing dot in the account color, name, big balance (rose-tinted if negative), ghost icon watermarked in the corner, and an arrow that appears on hover.
- Last pill is a dashed `w-[180px]` "Add account" link to `/app/accounts`.

---

## 11. Data model & mock data (`sampledata.json`)

The file is stored **encrypted at rest**. Below is the *decrypted* schema. When you start with a plaintext `sampledata.json`, the backend will auto-migrate to the encrypted envelope on first boot. If it's still in the old single-user shape, the backend also migrates it to the new multi-user shape on first boot (creating a demo user).

### Top-level keys (multi-user shape)

```
users, userData, sessions
```

- `users[]` — user records: `{ id, name, email, phone, avatar, currency, currencySymbol, memberSince, plan, passwordHash, passwordSalt, twoFactorEnabled, biometricEnabled, healthScore, healthGrade }`.
- `userData` — object keyed by userId; each value holds the per-user datasets: `metrics, accounts, categories, transactions, templates, debts, budgets, bills, goals, spendingTrend, categorySpend, notifications, healthBreakdown`. (Any legacy `recurringRules[]` on disk is migrated into `bills[]` on first boot.)
- `sessions` — object keyed by token (`wtok_<hex>`) mapping to `{ userId, createdAt }`. Mirrored from the in-memory Map. 30-day expiry.

### Derived vs. stored

The following per-user fields are **not read from disk** — the backend recomputes them from live transactions on every request via `computeIndexesFor()`:

- `spendingTrend` — via `buildSpendingTrend(transactions, 7)` (last 7 monthly buckets).
- `categorySpend` — via `buildCategorySpend(transactions)` (current-month expense per category).
- `metrics.monthlyIncome / monthlyExpense / savingsRate + deltas` — via `buildMetrics()`.
- `metrics.totalBalance` — sum of derived account balances.
- Account balances (`balance`, `inflow`, `outflow`, `txnCount`) — from `openingBalance + net movement`.
- `budget.spent` — via `computeBudgetSpent()`, respects period window and includes sub-categories.

The corresponding *stored* fields (`userData.spendingTrend`, `userData.categorySpend`) are ignored on read and can be omitted from seed data.

### `user`

```json
{
  "id": "usr_001",
  "name": "Aarav Sharma",
  "email": "aarav.sharma@example.com",
  "phone": "+91 98765 43210",
  "avatar": "https://api.dicebear.com/7.x/initials/svg?seed=Aarav%20Sharma&backgroundColor=6366f1",
  "currency": "INR",
  "currencySymbol": "₹",
  "memberSince": "2024-11-12",
  "plan": "Pro",
  "healthScore": 82,
  "healthGrade": "A-",
  "twoFactorEnabled": true,
  "biometricEnabled": true
}
```

### `metrics` — precomputed top-level KPIs

```json
{
  "totalBalance": 428500, "totalBalanceDelta": 12.4,
  "monthlyIncome": 145000, "monthlyIncomeDelta": 4.8,
  "monthlyExpense": 87340, "monthlyExpenseDelta": -6.2,
  "savingsRate": 39.8,    "savingsRateDelta": 3.1,
  "netWorth": 1284500,    "netWorthDelta": 8.7
}
```

(Note: on `/api/dashboard`, `totalBalance` is *recomputed* from the sum of account balances.)

### `accounts`

```json
{
  "id": "acc_hdfc",
  "name": "HDFC Checking",
  "type": "bank",             // bank | savings | credit | cash | wallet
  "openingBalance": 120000,   // negative for credit cards
  "color": "#0ea5e9",
  "icon": "Landmark",         // Lucide icon name
  "currency": "INR",
  "institution": "HDFC Bank"
}
```

### `categories`

```json
{
  "id": "cat_food",
  "name": "Food & Dining",
  "icon": "UtensilsCrossed",
  "color": "#f97316",
  "parentId": null            // string id if this is a sub-category
}
```

Include `{ "id": "cat_transfer", "name": "Transfer", "icon": "ArrowLeftRight", "color": "#64748b" }` — transactions of type `transfer` use it.

### `transactions`

Two shapes.

**Income / Expense:**

```json
{
  "id": "txn_001",
  "date": "2026-07-01",
  "vendor": "Salary - Cognizant",
  "categoryId": "cat_salary",
  "amount": 145000,           // signed: negative for expense, positive for income
  "type": "income",           // income | expense
  "accountId": "acc_hdfc",
  "paymentMethod": "Bank Transfer",
  "note": "July payroll",
  "labels": []                // string[]
}
```

**Transfer:**

```json
{
  "id": "txn_008",
  "date": "2026-06-28",
  "vendor": "Transfer to Savings",
  "categoryId": "cat_transfer",
  "amount": 40000,            // always positive for transfers
  "type": "transfer",
  "fromAccountId": "acc_hdfc",
  "toAccountId": "acc_savings",
  "paymentMethod": "Bank Transfer",
  "note": "Monthly savings sweep",
  "labels": []
}
```

Optional per-transaction fields: `payer`, `paymentStatus` (`cleared|pending|reconciled`), `currency`.

### `templates`

```json
{
  "id": "tpl_1", "name": "Morning coffee",
  "type": "expense", "amount": 380,
  "categoryId": "cat_food_coffee", "accountId": "acc_upi",
  "paymentMethod": "UPI",
  "vendor": "Blue Tokai Coffee", "note": "Daily coffee"
}
```

### `recurringRules` *(retired — migrated into `bills`)*

The dedicated `recurringRules[]` collection has been retired. Every rule is now expressed as a **bill with `autoPost: true`** in the `bills[]` collection (see below). Any legacy `recurringRules[]` on disk is migrated into `bills[]` on first boot; the migration is one-time and non-destructive.

Historically the shape was:

```json
{
  "id": "rec_1", "name": "Salary",
  "type": "income", "amount": 145000,
  "categoryId": "cat_salary", "accountId": "acc_hdfc",
  "paymentMethod": "Bank Transfer",
  "vendor": "Salary - Cognizant", "note": "Monthly payroll",
  "frequency": "monthly",      // daily | weekly | monthly | yearly
  "nextDue": "2026-08-01",
  "active": true
}
```

### `debts`

```json
{
  "id": "debt_credit",
  "name": "HDFC Credit Card", "creditor": "HDFC Bank",
  "balance": 18420, "apr": 36.0, "minPayment": 920,
  "dueDate": "2026-07-22"
}
```

### `budgets`

```json
{
  "id": "bud_food", "categoryId": "cat_food",
  "limit": 12000, "spent": 6580,
  "period": "monthly",         // weekly | monthly | yearly | custom
  "alertAt": 80,
  "startDate": null, "endDate": null   // populated only for `custom`
}
```

### `bills`

```json
{
  "id": "bill_rent", "name": "Home Rent",
  "type": "expense",                       // expense | income
  "amount": 24000, "dueDate": "2026-07-05",
  "frequency": "monthly", "status": "pending",  // pending | paid
  "category": "Rent",                      // display label (string)
  "categoryId": "cat_rent",                // posting reference (for auto-post)
  "vendor": "Landlord",
  "paymentMethod": "Bank Transfer",
  "note": "July rent",
  "autoPost": false,                       // on due date, backend posts a real txn and advances dueDate
  "autopay": false,                        // cosmetic amber chip only — no automation
  "accountId": "acc_hdfc"
}
```

When `autoPost` is `true`, the backend posts a real transaction on the due date and advances `dueDate` by the `frequency`. The `autopay` flag is purely cosmetic (renders the amber ⚡ chip) and drives no automation.

### `goals`

```json
{
  "id": "goal_vacation", "name": "Bali Getaway", "icon": "Palmtree",
  "target": 180000, "saved": 112500,
  "deadline": "2026-12-15", "priority": "high",   // low | medium | high
  "color": "#06b6d4", "monthlyContribution": 15000,
  "accountId": "acc_savings"
}
```

### `spendingTrend`

Array of monthly rows used by charts:

```json
{ "month": "Jan", "income": 138000, "expense": 92400 }
```

### `categorySpend`

Aggregate per category used by the pie/donut widgets:

```json
{ "categoryId": "cat_food", "amount": 12480 }
```

### `notifications`

Notifications are **auto-derived** from live user state on every read (`generateNotificationsFor(userData)`). What's persisted on disk is an **overlay** — minimal state records keyed on the deterministic generated ID, so read state and dismissals survive backend restarts:

```json
// stored overlay entry
{ "id": "gen_bill_overdue_bill_rent", "read": true, "dismissed": false }
```

The full rendered shape returned by `GET /api/notifications` looks like:

```json
{
  "id": "gen_budget_alert_bud_food",
  "type": "budget",                   // budget | bill | goal | insight
  "tone": "warning",                  // danger | warning | success | info — drives chip color
  "title": "Shopping budget nearly maxed",
  "body": "You've used 90% of your ₹8,000 shopping budget.",
  "createdAt": "2026-07-03T08:00:00Z",
  "read": false,
  "dismissed": false
}
```

Generator triggers (priority order — sorted danger → warning → success → info):
- **Bill overdue** — pending bill with `dueDate < today` → danger + red **Bill** chip
- **Bill due soon** — pending bill with `dueDate ≤ today + 5 days` → warning + amber **Bill** chip
- **Over budget** — budget where `spent ≥ limit` → danger + red **Budget** chip
- **Budget alert** — budget where `spent ≥ alertAt%` → warning + amber **Budget** chip
- **Goal reached** — goal where `saved ≥ target` → success + emerald **Goal** chip
- **Inactivity insight** — latest transaction ≥ 7 days old → info + cyan **Insight** chip

**Legacy hand-seeded rows** (id NOT starting with `gen_`) still render — the two shapes coexist for backward compatibility.

### `healthBreakdown`

```json
{ "name": "Budget Adherence", "score": 88, "note": "Under limit on 6 of 8 budgets." }
```

---

## 12. Backend API reference

Base URL: `http://localhost:4000/api` (proxied from `/api` in dev by `vite.config.js`).

### Auth (real, per-user)

- `POST /auth/signup` — body `{ name, email, password }`. Password ≥ 6 chars; email must be unique. Returns `{ token, user }` (user is safe — no password fields). Creates a new user + seeds their per-user data.
- `POST /auth/login` — body `{ email, password }`. Verifies against `scrypt(salt + ':' + password)`. Returns `{ token, user }`.
- `POST /auth/logout` — invalidates the current token (requires `Authorization` header).
- `GET  /me` — returns the current authenticated user.
- All non-auth `/api/*` routes require an `Authorization: Bearer <token>` header. Missing/invalid/expired token → **401**.

### Dashboard

- `GET /dashboard` → `{ user, metrics, spendingTrend, categorySpend, recentTransactions, upcomingBills, goals, accounts, healthScore, healthGrade, healthBreakdown }`

### Categories

- `GET /categories`
- `POST /categories` — `{ name, icon, color, parentId? }`
- `PATCH /categories/:id`
- `DELETE /categories/:id` — returns 409 `in_use` if any transaction references it.

### Accounts

- `GET /accounts` — includes derived `balance`, `inflow`, `outflow`, `txnCount`
- `POST /accounts` — `{ name, type, openingBalance, color, icon, currency, institution }`
- `PATCH /accounts/:id`
- `DELETE /accounts/:id`

### Transactions

- `GET /transactions?type=&category=&q=&accountId=` — filtered (fully cached when no filters)
- `POST /transactions` — see § 11 for shapes. Server signs the amount and picks a default account.
- `PATCH /transactions/:id` — full edit support. Type can change (Income ↔ Expense ↔ Transfer) and the amount + account fields get re-derived; validation matches POST.
- `POST /transactions/bulk` — `{ rows: [ ... ] }` — used by CSV import.
- `DELETE /transactions/:id`

### Budgets

- `GET /budgets` — includes joined category
- `POST /budgets` — `{ categoryId, limit, period, alertAt, startDate?, endDate? }`
- `PATCH /budgets/:id`
- `DELETE /budgets/:id`

### Bills (Recurring & Bills)

- `GET /bills`
- `POST /bills` — body `{ name, type, amount, dueDate, frequency, status, category, categoryId?, vendor?, paymentMethod?, note?, autoPost?, autopay?, accountId }`.
- `PATCH /bills/:id` — used to mark paid, update fields, toggle `autoPost` / `autopay`, etc. Accepts any subset of the same fields as POST.
- `POST /bills/:id/run` — force one immediate execution of an `autoPost` bill (posts the transaction and advances `dueDate`). Replaces the retired `POST /api/recurring/:id/run`.
- `DELETE /bills/:id`

### Goals

- `GET /goals`
- `POST /goals` — `{ name, target, saved?, deadline?, priority, monthlyContribution?, note?, color, icon? }`. Validates name required, target > 0, saved ≤ target.
- `PATCH /goals/:id` — same fields as POST (all optional).
- `DELETE /goals/:id`
- `POST /goals/:id/contribute` — `{ amount }` — adds to `saved`, capped at `target`

### Reports

- `GET /reports` → `{ totals, savings, savingsRate, spendingTrend, categorySpend, topVendors }`

### Templates

- `GET /templates`
- `POST /templates`
- `PATCH /templates/:id`
- `DELETE /templates/:id`

### Recurring rules *(retired — merged into Bills)*

The `/api/recurring/*` endpoints have been removed. Recurring rules are now expressed as bills with `autoPost: true`; use the Bills endpoints above. `POST /api/bills/:id/run` replaces `POST /api/recurring/:id/run`.

### Debts

- `GET /debts`
- `POST /debts`
- `PATCH /debts/:id`
- `DELETE /debts/:id`

### Notifications

- `GET /notifications`
- `PATCH /notifications/:id` — used to `{ read: true }`
- `POST /notifications/read-all`
- `DELETE /notifications/:id`

### Health

- `GET /health` → `{ status, service, time }`

### Response caching

The server has a small custom cache (`responseCache` Map) keyed on `etagBase:userId:route` (**per-user** — no user ever sees another user's cached response). Any write bumps `etagBase` and clears the cache. Frontend requests get `ETag` + `Cache-Control: private, no-cache` for GETs — the browser always revalidates via `If-None-Match` (server responds with `304` when nothing changed, so it's cheap; when data has changed the client gets the fresh copy immediately without a stale window).

---

## 13. Frontend state management

No Redux / Zustand — just React context and local state.

### Contexts (all in `frontend/src/context/`)

| Provider                    | Purpose                                                                    | Storage                                             |
| --------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| `AuthProvider`              | `user`, `token`, `login`, `signup`, `logout`, `isAuthed`                   | `localStorage['wallet_user' / 'wallet_token']`      |
| `ThemeProvider`             | `theme` ('light'/'dark'), `setTheme`, `toggleTheme`, `isDark`               | `localStorage['wallet_theme']` + `.dark` on `<html>`|
| `PreferencesProvider`       | `prefs` (country, currency, currencies[], language, dateFormat, timezone, autoLogout…) + `setPrefs` + `resetPrefs` | `localStorage['wallet_prefs_v1']` |
| `NewTransactionProvider`    | Global Add Record modal — `open()`, `close()`, `isOpen`; renders the modal + loads pickers on first open; broadcasts `wallet:tx-created` on save | Event bus |

Provider order in `App.jsx`:

```jsx
<ThemeProvider>
  <PreferencesProvider>
    <AuthProvider>
      <Routes>...</Routes>
    </AuthProvider>
  </PreferencesProvider>
</ThemeProvider>
```

`NewTransactionProvider` is mounted **inside** `AppLayout` so it only exists for authenticated users.

### Hooks

- `useAuth()` / `useTheme()` / `usePreferences()` / `useNewTransaction()` — throw if used outside their provider.
- `useTxCreatedListener(fn)` — subscribes to the global `wallet:tx-created` window event.
- `useIdleTimer({ enabled, idleMs, onIdle, paused })` — listens for `mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll`, `wheel`, `visibilitychange` and calls `onIdle` after `idleMs` with no activity.

### localStorage keys used

| Key                              | Purpose                                             |
| -------------------------------- | --------------------------------------------------- |
| `wallet_theme`                   | 'light' or 'dark'                                   |
| `wallet_user`                    | Cached user profile                                 |
| `wallet_token`                   | Demo auth token                                     |
| `wallet_prefs_v1`                | Country / currency / date format / timezone / …     |
| `wallet_dashboard_layout_v1`     | Widget layout array                                 |
| `wallet_fx_v1`                   | FX rate cache (base → rates + timestamp)            |
| `wallet_pin_v1`                  | `{ salt, hash, createdAt }` — hashed PIN            |
| `wallet_pin_unlocked_v1` *(session)* | Per-session unlocked flag                       |

---

## 14. Application logic details

### 14.1 Currency + date formatting

`frontend/src/lib/api.js`:

```js
import { readPrefs, getCurrencyMeta } from './preferences.js';

export function formatCurrency(n, symbol) {
  const prefs = readPrefs();
  const meta = getCurrencyMeta(prefs.currency);
  const sym = symbol || meta.symbol;
  const val = Math.abs(Number(n) || 0);
  return `${n < 0 ? '-' : ''}${sym}${val.toLocaleString(meta.locale, { maximumFractionDigits: 0 })}`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const prefs = readPrefs();
  const day = String(d.getDate()).padStart(2, '0');
  const monNum = String(d.getMonth() + 1).padStart(2, '0');
  const monShort = d.toLocaleDateString('en-US', { month: 'short' });
  const year = d.getFullYear();
  switch (prefs.dateFormat) {
    case 'MM/DD/YYYY':  return `${monNum}/${day}/${year}`;
    case 'YYYY-MM-DD':  return `${year}-${monNum}-${day}`;
    case 'DD MMM YYYY': return `${day} ${monShort} ${year}`;
    default:            return `${day}/${monNum}/${year}`;
  }
}
```

Both read `localStorage` on every call so previously-rendered components pick up the new format after `window.location.reload()`, which is what happens when the user hits **Save changes** in Preferences.

### 14.2 Filtering in Transactions

Client-side memoized filter over the full loaded list. Filters:
- `type` — Income / Expense / Transfer / All
- `accountId` — matches `accountId`, `fromAccountId`, or `toAccountId`
- `category`
- `q` — case-insensitive substring match against **vendor, note, category name, payer, payment method, account name, from/to account names, and every label**

The toolbar shows a **`Reset filters (N)`** button whenever ≥ 1 filter is active. Stats cards (Income / Expense / Transfers / Net) recompute from the filtered subset.

### 14.3 Category-aware label suggestions

Inside `NewTransactionModal.jsx`:

```js
const suggestedLabels = useMemo(() => {
  if (!transactions?.length) return { suggested: [], scope: 'category' };
  const inCat = transactions.filter(t => t.categoryId === form.categoryId);
  const counts = new Map();
  const collect = t => (t.labels || []).forEach(l =>
    l && counts.set(l, (counts.get(l) || 0) + 1));
  inCat.forEach(collect);
  if (counts.size === 0) transactions.forEach(collect);
  const scope = inCat.length && [...counts.keys()].some(k => inCat.some(t => (t.labels || []).includes(k)))
    ? 'category' : 'all';
  return {
    suggested: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label]) => label)
      .filter(l => !currentLabels.includes(l))
      .slice(0, 8),
    scope,
  };
}, [transactions, form.categoryId, currentLabels]);
```

### 14.4 Debt payoff simulator

`Debts.jsx#simulate(debts, extraMonthly, strategy)`:

- Copies debts, then iterates up to 480 months.
- Each month: accrue monthly interest = `balance * (apr/100/12)`, then apply minimum payments, then apply `extraMonthly` to the target (avalanche = highest APR, snowball = smallest balance), cascading any leftover once.
- Emits a `timeline` array of monthly snapshots `{ month, total, [debtName]: balance }` for Recharts.

**Strategy callout** (always rendered on both tabs):

- Runs `simulate()` for both strategies with the current inputs and compares `payoffMonths` + `totalInterest`.
- If `payoffMonths` and `totalInterest` match within a small epsilon → renders the **convergence** message ("Both strategies produce the same result for your current debts — this usually means the highest-APR debt is also the smallest balance…").
- Otherwise picks the winner (fewer months, then lower interest), reports the delta ("Avalanche saves ₹X and Y months"), and — when the current tab is the loser — renders a **"Switch to {winner}"** shortcut link that flips the strategy.

### 14.5 Auto-post engine (formerly the recurring rule engine)

In `backend/server.js` — the boot-time engine now iterates over `bills` with `autoPost: true` (there is no longer a separate `recurringRules[]` collection):

- For each active auto-post bill, while `dueDate <= today` and iterations < 24:
  - Create a transaction copying the bill's type / amount / categoryId / accountId / vendor / paymentMethod / note (with `note += ' · [auto-post]'` and `labels: ['auto-post']`), plus a `sourceBillId` back-reference.
  - Advance `dueDate` by the bill's `frequency` (`daily / weekly / monthly / yearly`).
- Update `bill.lastRun = new Date().toISOString()`.
- Boot log: `[auto-post] checked (N active) · generated K scheduled transaction(s).`

`POST /api/bills/:id/run` forces one immediate execution using the same logic.

### 14.6 Idle logout

`IdleLogoutManager.jsx`:

- Uses `useIdleTimer({ enabled: authenticated && prefs.autoLogoutEnabled, idleMs: max(60_000, prefs.autoLogoutIdleMinutes * 60_000), onIdle, paused: warning })`.
- On idle, shows a modal with a 60-second countdown (progress bar changes tone) and two buttons — **Sign out now** and **Stay signed in**. If the countdown hits 0, `logout()` is called automatically.

### 14.7 PIN lock

`lib/pin.js` uses Web Crypto:

- `setPin(pin)`: 16-byte random salt hex + `SHA-256(salt + ':' + pin)`; both persist to `localStorage['wallet_pin_v1']`.
- `verifyPin(pin)`: recompute and compare.
- On successful unlock, `sessionStorage['wallet_pin_unlocked_v1'] = '1'`.
- `AppLayout.jsx` renders `PinLockScreen` if `hasPin() && !isUnlocked()`.

### 14.8 CSV import + export

`lib/csv.js`:

- `parseCSV(text)` — auto-detects `,` vs `;` from the first line; supports RFC-4180 quoting including `""` escapes and multi-line quoted fields.
- `toCSV(rows, columns)` — `columns` is `[{ header, value: (row)=>any }, ...]`; escapes with double-quotes when value contains `, " \n \r`.
- `downloadCSV(filename, csv)` — Blob URL + auto-click + revoke.

`CsvImportModal.jsx` guesses column mapping (`guessMapping(headers)`) using normalized-header dictionaries, previews the first 5 rows, and calls `POST /api/transactions/bulk` on submit.

### 14.9 FX rates

`lib/fx.js`:

- URL: `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/<base>.json` (primary) with `https://latest.currency-api.pages.dev/v1/currencies/<base>.json` fallback.
- Cache: `localStorage['wallet_fx_v1']` keyed by base currency, 1-hour TTL.
- `fetchRates(base, { force: true })` bypasses cache.

### 14.10 Global "New transaction" modal

`context/NewTransactionContext.jsx`:

- Renders `NewTransactionModal` at layout level.
- On first open, lazily fetches categories, accounts, templates, and transactions.
- On save, dispatches a `wallet:tx-created` window event and refreshes its own copy.
- Any page can subscribe via `useTxCreatedListener(reloadFn)`.

---

## 15. User flows (step by step)

### 15.1 First-time visit

1. Load `/` (Landing). No auth required.
2. Click **Get started** → `/signup`.
3. Fill form, submit → backend responds with `{ token, user }`, `AuthContext` stores them, navigate to `/app/dashboard`.
4. Dashboard fetches `/api/dashboard`, renders accounts strip + default widget layout.

### 15.2 Add a new record from anywhere

1. Click **New transaction** in the Topbar (on any page) or on the Transactions page.
2. `useNewTransaction().open()` → modal mounts, first-open lazy-loads pickers.
3. Optionally pick a template from "Select template" → form auto-populates.
4. Choose tab: Expense / Income / Transfer.
5. Fill Amount + Currency, pick Account (icon-select popover) and Category (for expense/income).
6. Type / pick labels — suggestions appear from previous transactions in the picked category.
7. Fill Date & Time and, on the right column, Note / Payer / Payment type / Payment status.
8. Toggle "Create template from this record" if you want to save it as a template on submit.
9. Click **Add record** (closes modal) or **Add and create another** (resets, keeps modal).
10. On save the modal fires `wallet:tx-created`; Dashboard + Transactions list refresh.

### 15.3 Customize the dashboard

1. Click **Customize** on the Dashboard toolbar.
2. Edit-mode indicators appear: dashed borders + per-card `N×`, delete, drag-handle buttons.
3. Drag a card to reorder (drop target gets a brand ring).
4. Click `N×` to cycle its column span 1 → 2 → 3.
5. Click delete to remove.
6. Click **Add a card** or the dashed slot at the end → widget-picker modal.
7. Click **Reset** to restore default layout.
8. Click **Done** to lock.

### 15.4 Change currency & country

1. Settings → Preferences.
2. Change **Country** dropdown → currency + timezone auto-fill.
3. Change **Currency** or **Date format** independently if you want (live preview updates).
4. Click **Save changes** → 600 ms later a soft reload re-renders every amount/date with the new format.

### 15.5 Add a tracked currency (with live rate)

1. Settings → Preferences → "Your currencies" section.
2. Click **Add currency**.
3. Modal shows a currency dropdown (excluding your primary + already-added ones). Live rate fetches automatically and displays rate + inverse.
4. Click the small refresh icon to bypass cache.
5. Click **Add** → currency appears in the list with a refreshable rate.

### 15.6 Import a CSV

1. Transactions → **Import**.
2. Drop or pick a `.csv` file.
3. Modal parses it, guesses column mapping, and shows the first 5 rows.
4. Fix mapping (Date/Vendor/Amount are required). Pick default Account + default Category.
5. Click **Import N rows** — bulk POST + success screen.
6. Modal closes → Transactions list refreshes.

### 15.7 Manage categories with sub-categories

1. Settings → Categories.
2. Click **Add category** to make a parent. Icon picker (grouped, searchable) + color palette + optional Parent (leave as *None* for parent).
3. Hover any parent → **Add sub-category** button (+ icon).
4. Sub-categories render indented under the parent with edit / delete buttons on hover.

### 15.8 Simulate a debt payoff

1. Debts page → adjust the **extra payment** slider.
2. Toggle **Avalanche** ↔ **Snowball**.
3. Summary cards (Debt-free in / Est. payoff date / Total interest) and the line chart update instantly.
4. A hint bar at the bottom compares the two strategies.

### 15.9 Set a PIN

1. Settings → Security → **Set PIN**.
2. Modal asks for a 4–8 digit PIN, then a confirmation.
3. On save the app remembers the hash; when you return next session the full-screen PIN pad appears.
4. Enter your PIN (auto-submits at 6 digits). Wrong PIN shakes the dots and clears.

### 15.10 Get logged out for inactivity

1. Stop touching the mouse/keyboard.
2. After the configured idle window (default 15 min) the "Are you still there?" modal appears with a 60-second countdown.
3. Do nothing → automatic sign-out.
4. Or click **Stay signed in** → clock restarts.

---

## 16. Routing map

Defined in `frontend/src/App.jsx` using `<Routes>` + `<Route>` + `<Navigate>`.

| Path                    | Element                                    | Guard          | Notes                                           |
| ----------------------- | ------------------------------------------ | -------------- | ----------------------------------------------- |
| `/`                     | `<Landing />`                              | public         | Marketing home                                  |
| `/login`                | `<Login />`                                | public         | Two-pane sign-in                                |
| `/signup`               | `<Signup />`                               | public         | Two-pane sign-up                                |
| `/app`                  | `<Protected><AppLayout /></Protected>`     | requires auth  | Redirects to `/login` if `!isAuthed`            |
| `/app` (index)          | `<Navigate to="dashboard" replace />`      | requires auth  |                                                 |
| `/app/dashboard`        | `<Dashboard />`                            | requires auth  |                                                 |
| `/app/accounts`         | `<Accounts />`                             | requires auth  |                                                 |
| `/app/transactions`     | `<Transactions />`                         | requires auth  |                                                 |
| `/app/budgets`          | `<Budgets />`                              | requires auth  |                                                 |
| `/app/bills`            | `<Bills />`                                | requires auth  | Sidebar/topbar label: **Recurring & Bills**     |
| `/app/goals`            | `<Goals />`                                | requires auth  | `?add=1` opens create · `?contribute=<id>` opens contribute |
| `/app/debts`            | `<Debts />`                                | requires auth  |                                                 |
| `/app/reports`          | `<Reports />`                              | requires auth  |                                                 |
| `/app/notifications`    | `<Notifications />`                        | requires auth  |                                                 |
| `/app/settings`         | `<Settings />`                             | requires auth  | Section switching is *local* state, not routing |
| `*`                     | `<Navigate to="/" replace />`              | —              | Catch-all                                       |

`<AppLayout />` wraps its `<Outlet />` with `NewTransactionProvider`, then mounts `IdleLogoutManager` at the end so the modal always overlays.

**PIN gate:** When `hasPin() && !isUnlocked()`, `AppLayout` short-circuits to `<PinLockScreen />` instead of rendering `<Outlet />`.

---

## 17. User roles & permissions

The backend is now **truly multi-user** (see §5.0a). Every signed-in user has a fully isolated dataset — accounts, transactions, budgets, categories, everything. Cross-user access is impossible: the `requireAuth` middleware attaches `req.userData = db.userData[req.userId]` and all writes go through it.

There are no *role-based* permissions today (owner / editor / viewer). Every signed-in user has full access to their own data.

Suggested future role model (not implemented):

- **Owner** — full access to their workspace
- **Editor** — create/edit anything in a shared workspace
- **Viewer** — read-only in a shared workspace

Where to add: introduce a `workspaces[]` model, move `userData` under `workspaces[].data`, add `memberships[]` mapping userId → workspaceId + role, then check role on each write endpoint.

---

## 18. Security

### AES-256-GCM data at rest

Implemented in `backend/crypto.js`. Wire format on disk:

```json
{
  "v": 1,
  "algorithm": "aes-256-gcm",
  "iv":  "<24 hex — 12 bytes>",
  "tag": "<32 hex — 16 bytes>",
  "data": "<hex ciphertext>"
}
```

**Key resolution:**

1. Env var `WALLET_DATA_KEY` — accepts a 64-char hex string (32 bytes) or a base64-encoded 32-byte value.
2. `backend/.data-key` — auto-generated on first boot if the env var isn't set. File mode `0o600`. **Gitignored.**

**Migration:** If `sampledata.json` exists as plaintext JSON, the server encrypts it in place on first read.

**Writes:** always atomic — write ciphertext to `sampledata.json.tmp` → `rename()` on top.

**Rotation:** Keep the current `.data-key` while the server is running, so it decrypts once, then swap key files and delete the encrypted file; on next boot the plaintext (from your backup) will be re-encrypted with the new key.

### PIN lock (frontend)

- `SHA-256(salt + ':' + pin)` — 16-byte per-user salt via `crypto.getRandomValues`. Stored in `localStorage['wallet_pin_v1']`.
- Unlocked flag lives in `sessionStorage['wallet_pin_unlocked_v1']` so it clears on window close.

### Auto-logout

See § 14.6.

### Password hashing (backend)

- Node's `crypto.scryptSync(password, salt, 64)` — 32-byte random salt per user (via `crypto.randomBytes(16).toString('hex')`), 64-byte hash, comparison via `crypto.timingSafeEqual`.
- Both `passwordHash` and `passwordSalt` live inside the encrypted `sampledata.json`, never in a separate secret store.

### Session tokens

- Random opaque tokens: `wtok_` + 64 hex chars (`crypto.randomBytes(32).toString('hex')`).
- Stored in an in-memory `sessions` Map **and mirrored to `db.sessions`** so tokens survive backend restarts (previously they were lost on any nodemon restart).
- 30-day expiry — enforced in `requireAuth`; expired tokens are auto-cleared.
- `POST /api/auth/logout` explicitly destroys the token.

### What's still plaintext (localStorage)

Browser localStorage keys (`wallet_user`, `wallet_token`, `wallet_prefs_v1`, `wallet_dashboard_layout_v1`, `wallet_fx_v1`, `wallet_pin_v1`) are **not** encrypted. Adding client-side encryption would require either a per-session passphrase or a keystore in IndexedDB and is out of scope today.

---

## 19. Setup & run instructions

### Prerequisites

- Node.js 18+ (uses `crypto.randomBytes`, `SubtleCrypto` on the browser side)
- npm 9+

### Install

```bash
cd backend
npm install

cd ../frontend
npm install
```

### Run (two terminals)

Terminal 1 — backend:

```bash
cd backend
npm run dev      # nodemon; or: npm start for plain node
```

You should see:

```
Wallet backend running on http://localhost:4000
Data-at-rest: aes-256-gcm · key source: backend/.data-key (generated)
```

Terminal 2 — frontend:

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173**. Sign in with any credentials (the demo backend accepts anything).

### Build for production

```bash
cd frontend
npm run build       # → dist/
npm run preview     # serves the build locally
```

### Environment variables

- `PORT` (backend) — override the default `4000`.
- `WALLET_DATA_KEY` (backend) — 32-byte key as 64 hex chars or base64. Overrides `.data-key`.

### `.gitignore`

Already excludes `node_modules/`, `dist/`, `.vite/`, `.env*`, and importantly:

```
backend/.data-key
backend/sampledata.json.tmp
```

---

## 20. Responsive behavior

**Current status: desktop-first.** The reference viewport is set in `index.html` to `width=1024`. Below that width some things do work (grids collapse) but layout is not tuned. Explicit responsive patterns in use:

- `md:` breakpoint (768px) shows the sidebar and switches Login/Signup to a two-pane layout.
- `md:grid-cols-2`, `xl:grid-cols-3` — the Dashboard widget grid collapses smoothly to 1 → 2 → 3 columns.
- Filter bars use `flex-wrap` so long control rows spill onto new lines.
- Tables should be wrapped in `overflow-x-auto` if row content exceeds container width.

Mobile-friendly work still to do (not required by product):

- Hamburger sidebar
- Card-stacked table replacements
- Touch-friendly drag handles for the widget grid

---

## 21. Future enhancements

Practical next steps (also listed in README):

1. **CSV/OFX/QIF importers** — currently CSV only.
2. **Password hashing upgrade** — `scrypt` is now used (see §18). A production hardening step would migrate to **argon2id** with per-user tuning and add breach-list checks.
3. **Server-side account balance snapshots** — for accurate "Balance trend" over months.
4. **Real bank sync** — via a paid aggregator (Plaid / Salt Edge / Sahamati).
5. **Cloud sync & multi-device** — needs a real database + real auth.
6. **PDF export** — currently only CSV.
7. **Push / email notifications** — data exists, delivery does not.
8. **Roles & sharing** — see § 17.
9. **Receipt OCR** — file upload + a hosted OCR (Google ML Kit, Tesseract).
10. **Split transactions** — one expense across multiple categories.
11. **HTTPS in dev** — self-signed cert for the Vite/Express dev servers.
12. **WebAuthn / biometrics** on desktop where supported.

---

## 22. Instructions for Claude Code to recreate this app

If this file is dropped into a new Claude Code session, follow these rules exactly. **Do not simplify** the application. Rebuild what's described here without downgrading.

### Non-negotiables

1. **Do not remove any feature** listed in §§ 4 and 9.
2. **Match the folder structure** in § 6 exactly.
3. **Use the exact design tokens** in § 7 — CSS variables driving Tailwind semantic classes. Both light + dark must work.
4. **Use the same libraries** (Vite, Tailwind, Recharts, Lucide, react-router-dom v6) at the versions in § 2.
5. **Reuse the shared UI primitives** in `frontend/src/components/ui/` — don't inline styles into pages when a component exists.
6. **Contexts must be nested in the order** shown in § 13.
7. **Persist to `localStorage` under the exact keys** in § 13.
8. **The backend data file is encrypted at rest** — implement `backend/crypto.js` per § 18. First-boot plaintext migration is required.
9. **All money formatting goes through `formatCurrency()`** in `lib/api.js`, which reads from `readPrefs()`. Never hard-code `₹` in components.
10. **Dashboard widgets** are registered in `pages/dashboard/widgets.jsx`; add new widgets there, not inline in `Dashboard.jsx`.

### Recreation order (suggested)

1. Scaffold the folder structure (§ 6).
2. Add Tailwind + `index.css` + all design tokens (§ 7). Verify both themes render an empty page correctly.
3. Set up `App.jsx` with router + provider chain (§ 13, § 16).
4. Build the UI library (§ 8). Barrel-export from `ui/index.js`.
5. Build the backend (§ 12) with the encrypted-at-rest layer. Seed `sampledata.json` from § 11.
6. Build the API client (`lib/api.js`) covering every endpoint in § 12.
7. Build authentication pages, landing page, and the app layout (sidebar + topbar + PIN gate + idle manager).
8. Build the Accounts + Transactions pages, then the global `NewTransactionModal` + `NewTransactionContext` (§ 13). Wire the Topbar's "New transaction" button to it.
9. Build the dashboard widget system (§ 10), including drag & drop and the widget picker.
10. Add remaining pages one by one (Budgets, Bills, Goals, Debts, Reports, Notifications, Settings). Follow the sections & behaviors described in § 9.
11. Wire preferences + FX rates (§ 14.9, § 15.4-15.5).
12. Wire PIN lock + idle logout (§§ 14.6-14.7, 15.9-15.10).
13. Wire CSV import + exports (§ 14.8).
14. Verify all user flows in § 15 end-to-end.

### Behaviors that must remain identical

- Landing hero has a heading gradient and a `SparkChart` in the product preview.
- Login and Signup are two-pane splits with a theme toggle in the top-right of the form pane.
- Dashboard accounts strip is a single horizontal-scroll row of frosted glass pills; **never wraps**.
- Expenses Structure widget uses a centered donut with total in the middle and a top-5 list with per-category progress bars below.
- Transactions row shows `From → To` account pills for transfers.
- Add Record modal is two-column with **Add record** and **Add and create another** buttons side-by-side (grid-cols-2) at the bottom, not stacked.
- Budget cards color-code progress at 75% (amber) and 90% (rose).
- Debts uses a Recharts `LineChart` and shows a comparison hint bar when both strategies differ.
- Notifications page has filter tabs including an "Unread" tab with a count badge.
- Settings is a two-column layout with a vertical section rail on the left.

### Anti-checklist (do not do these)

- Do **not** replace Tailwind with plain CSS.
- Do **not** replace Recharts with another chart lib.
- Do **not** remove the encryption layer to "simplify" persistence.
- Do **not** hard-code the ₹ symbol or `en-IN` locale — read from preferences.
- Do **not** turn the Dashboard into a fixed set of cards — the widget grid + drag & drop is central.
- Do **not** collapse the Add Record modal into a one-column layout.
- Do **not** put the New Transaction modal state inside a single page — it lives in `NewTransactionContext` so any button anywhere can open it.

### Final verification

The app is considered correctly recreated when all of the following are true:

- [ ] Landing page renders in both themes without layout shift.
- [ ] Signup navigates to Dashboard on success.
- [ ] Dashboard's default layout matches § 10's `DEFAULT_LAYOUT`, and Customize mode enables drag & drop + span cycle + delete + add.
- [ ] Adding a transaction from the Topbar refreshes both Dashboard and Transactions.
- [ ] Adding an account colors immediately appear in the Dashboard's accounts strip.
- [ ] Toggling **Country = United States** in Preferences and saving reloads the app and every rupee amount now renders as `$…`.
- [ ] Adding a tracked currency shows a real live rate.
- [ ] CSV Import goes through drop → mapping → preview → success with real rows added.
- [ ] Debts payoff planner recomputes both timeline and totals when the slider moves.
- [ ] Setting a 4-digit PIN and closing/reopening the tab shows the PIN lock screen.
- [ ] Idle for the configured timeout triggers the 60-second warning modal.
- [ ] `sampledata.json` on disk is opaque ciphertext (JSON envelope), not readable text.

If every item is ✅, the recreation is complete.


