# Wallet App — Feature List

A personal finance / wallet web app. React (Vite) frontend, Node/Express backend, Supabase (Postgres + Supabase Auth) for data and authentication. A parallel React Native mobile app shares the same backend.

## 1. Authentication & Account
- Email/password signup and login
- Google Sign-In (OAuth)
- Supabase Auth (JWT bearer token) — signup via email OTP, login, logout
- Logged-in "who am I" profile fetch
- PIN lock screen (set/change a PIN to lock the app on this device)
- Automatic sign-out after a period of inactivity (idle timer, configurable)
- Two-factor authentication (email OTP) — enforced backend step-up on new devices (web + mobile)
- Biometric unlock (mobile app only)
- Password & sessions panel in Settings

## 2. Dashboard
- Customizable, drag/reorder widget layout (saved per user)
- Widget categories: Insights & Health Score, Spending & Budgets, Bills & Reminders, Goals & Savings, Accounts & Vendors, Cash Flow & Trends
- Core widgets: Financial health score, Expenses structure, Upcoming bills, Top goals, Recent transactions, Balance trend, Period-to-period comparison, Top payees, Savings rate
- AI-powered widgets:
  - AI Daily Summary (natural-language "what matters today")
  - AI cash flow forecast (7-day, 30-day, month-end projection)
  - Budget pace warnings (projected to exceed limit)
  - Budget adherence breakdown
  - Unusual transaction detection (anomalies) with reasons
  - Subscriptions & recurring payment detection (automatic)
  - AI spending insights (notable month-over-month category changes)
  - Duplicate transaction alerts

## 3. Accounts
- Multiple accounts: bank, card, wallet, cash, etc.
- Add / edit / delete accounts with custom icon and color
- Account details page (per-account transaction history & stats)
- Computed balances per account

## 4. Transactions
- Add / edit / delete transactions
- Bulk transaction actions
- CSV import (map columns, preview, bulk create)
- CSV export
- Reusable transaction templates ("Add Record" presets)
- Categorization with parent/sub-categories, custom icons and colors
- Calendar view of transactions by day

## 5. Budgets
- Create / edit / delete budgets per category
- Budget alert thresholds
- Budget vs. actual tracking, pace/overspend warnings (AI)

## 6. Bills
- Recurring bill tracking with due dates
- "Mark as paid" posts the bill as a transaction (explicit human confirmation — no automatic posting) and rolls the due date forward
- Per-payment history (bill_payments)
- Bill reminder notifications

## 7. Goals
- Savings goals with target amounts
- Contribute to a goal
- Progress tracking widget

## 8. Debts
- Track debts/loans
- Record payments against a debt
- Debt payoff/health tracking

## 9. Reports & Analytics
- Cash flow chart (monthly, last 7 months)
- Category share breakdown
- Top payees/vendors
- Spending by category
- Monthly income vs. expense comparison
- Achievements (gamified milestones)
- Recommendations (savings opportunities, pace warnings)
- AI monthly report (auto-generated summary for a given month)

## 10. Notifications
- In-app notification center
- Mark as read / mark all as read / delete
- Generated from budget alerts, bill reminders, anomalies, etc.

## 11. Multi-Currency
- Track balances in multiple currencies
- Live FX rate conversion against a primary/base currency
- Add/remove tracked currencies

## 12. Settings
- Profile management
- Location & currency preferences
- Theme (light/dark) toggle
- Display preferences (compact tables)
- Weekly digest email toggle (preference only — delivery not wired up)
- Categories management (create/edit/delete, nested sub-categories)
- Templates management
- Notification delivery preferences (email/push/budget/bills)
- Security panel (PIN, 2FA stub, biometric stub, idle sign-out, password/sessions)
- Data panel: export all data, import data, clear all data (danger zone)
- Help panel

## 13. Security (backend)
- Data in Supabase Postgres — encrypted at rest (Supabase), TLS in transit; RLS on every table; service-role key server-only
- Supabase Auth for passwords/sessions/JWT/OAuth; backend verifies the JWT and applies its own ownership checks (`ownsAccount` + per-`user_id` query scoping)
- Email-OTP 2FA step-up (HMAC-hashed codes, constant-time compare), per-device session list + revoke, force-logout, suspension — all backend-enforced
- Ownership checks on every resource (users only access their own data)
- Rate limiting (blanket `/api` limiter + stricter per-route limiters on 2FA and admin sensitive actions)
- CORS allowlist (refuses to boot open in production), secure HTTP headers + CSP (helmet)
- Server-side input validation + length/control-char/magnitude bounds on every entity route
- Global error handler that never leaks stack traces
- Security event logging (auth failures, invalid tokens, webhook signature failures) — console-based; wire to a real sink before scaling past one instance
- Signature-verified, idempotent recurring-billing webhooks (Stripe / Razorpay)

## Known limitations (worth disclosing)
- `requireAuth` loads the user's full data bundle on every authenticated request — fine at current scale, needs pagination/narrower loads for a very large per-user dataset.
- `GET /api/transactions` filtering and the Transactions/Calendar UI are not paginated/virtualized yet.
- Notification "delivery" (email/push) preferences exist but delivery isn't wired to an email/push service yet (in-app notifications work).
- Security/audit logging is console-based, not shipped to a real log sink.
- Web subscription checkout supports Razorpay hosted checkout; Stripe card entry on web (Elements) is still completed via the mobile app.
- `backend/crypto.js` (AES-256-GCM) is retained for possible future field-level encryption; it is not on any live path today.
