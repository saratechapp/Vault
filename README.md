# Vault (Wallet) — Personal Finance Manager

A premium, desktop-web personal finance manager: accounts, transactions, budgets,
recurring bills, savings goals, debt payoff planning, reports, notifications and a
fully customizable dashboard — backed by an Express API that encrypts its data
file at rest (AES-256-GCM).

See [`doc/FULL_APP_RECREATION_GUIDE.md`](doc/FULL_APP_RECREATION_GUIDE.md) for the
complete spec this app was built from.

## Quick start

```bash
cd backend && npm install
cd ../frontend && npm install
```

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Open http://localhost:5173 and sign up with any name/email/password.

## Environment variables

Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env`, then fill in what you need.

- `PORT` (backend) — default `4000`.
- `WALLET_DATA_KEY` (backend) — 32-byte key as 64 hex chars or base64. Overrides the
  auto-generated `backend/.data-key`.
- `GOOGLE_CLIENT_ID` (backend) / `VITE_GOOGLE_CLIENT_ID` (frontend) — enables real
  "Sign in with Google" on the Login/Signup pages. Both must be set to the **same**
  Client ID. Without it, the Google button shows a friendly "not configured" error
  instead of crashing.

### Setting up Google sign-in

1. [console.cloud.google.com](https://console.cloud.google.com) → create/select a project.
2. **APIs & Services → OAuth consent screen** → External → fill in app name + your email → save.
3. **APIs & Services → Credentials → + Create Credentials → OAuth client ID** → type **Web application**.
4. Under **Authorized JavaScript origins**, add `http://localhost:5173` (and your production URL later).
5. Copy the generated Client ID (`xxxx.apps.googleusercontent.com`).
6. Put it in both `backend/.env` (`GOOGLE_CLIENT_ID=...`) and `frontend/.env` (`VITE_GOOGLE_CLIENT_ID=...`).
7. Restart both dev servers.

New Google sign-ins are matched/created by email — signing in with Google using an
email that already has a password account logs into that same account.

## Future enhancements

1. CSV/OFX/QIF importers — currently CSV only.
2. Argon2id password hashing with per-user tuning + breach-list checks.
3. Server-side account balance snapshots for accurate long-range balance trends.
4. Real bank sync via a paid aggregator (Plaid / Salt Edge / Sahamati).
5. Cloud sync & multi-device — needs a real database.
6. PDF export (currently CSV only).
7. Push / email notification delivery.
8. Roles & sharing (owner/editor/viewer workspaces).
9. Receipt OCR.
10. Split transactions across multiple categories.
11. HTTPS in dev.
12. WebAuthn / biometrics on desktop.
