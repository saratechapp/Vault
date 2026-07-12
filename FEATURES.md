# Wallet App — Feature List

A personal finance / wallet web app. React (Vite) frontend, Node/Express backend, single encrypted JSON data file (no real database yet).

## 1. Authentication & Account
- Email/password signup and login
- Google Sign-In (OAuth)
- Session-token based auth (bearer token), logout
- Logged-in "who am I" profile fetch
- PIN lock screen (set/change a PIN to lock the app on this device)
- Automatic sign-out after a period of inactivity (idle timer, configurable)
- Two-factor authentication toggle (UI stub, not enforced yet)
- Biometric unlock toggle (UI stub, WebAuthn planned)
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
- "Run" a bill (post it as a transaction)
- Automatic bill posting on schedule (server-side)
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
- AES-256-GCM encryption of the data file at rest
- Scrypt password hashing
- Random bearer session tokens
- Ownership checks on every resource (users only access their own data)
- Rate limiting (auth endpoints stricter than general API)
- CORS allowlist, secure HTTP headers (helmet)
- Server-side input validation
- Global error handler that never leaks stack traces
- Security event logging (auth failures, invalid tokens, rate-limit hits)

## Known limitations (worth disclosing)
- Backend storage is a single encrypted JSON file loaded fully into memory (no real database) — fine for a demo/single-user scale, not yet built for high concurrent traffic.
- Two-factor authentication and biometric unlock are UI toggles only; not enforced by the backend yet.
- Notification "delivery" (email/push) preferences exist but aren't wired to an actual email/push service yet.
- Security/audit logging is console-based, not shipped to a real log sink.
