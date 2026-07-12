// Persisted idle-session tracking. The in-tab warning countdown
// (useIdleTimer/IdleLogoutManager) still uses a JS setTimeout for its precise
// UX timing, but that timer stops the moment the tab/browser/PC is closed or
// suspended. This module is the durable backstop: the last-activity
// timestamp lives in localStorage (survives full shutdown/restart), so idle
// expiry can be re-checked at app boot, on tab focus, and on every
// authenticated API call — not just while a JS timer happens to be running.
import { readPrefs } from './preferences.js';

const LAST_ACTIVITY_KEY = 'wallet_last_activity';
export const SESSION_EXPIRED_REASON_KEY = 'wallet_session_expired_reason';
// Set by lib/api.js when a request comes back `account_suspended` (an admin
// suspended this account — see backend/routes/admin/users.js) so Login.jsx
// can show a clear reason instead of a silent, confusing sign-out.
const ACCOUNT_SUSPENDED_KEY = 'wallet_account_suspended';

function idleDurationMs() {
  const prefs = readPrefs();
  return Math.max(60_000, (prefs.autoLogoutIdleMinutes || 15) * 60_000);
}

export function touchActivity() {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    // storage unavailable (private mode / quota) — idle backstop just no-ops
  }
}

export function clearActivity() {
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    // storage unavailable
  }
}

// True once auto-logout is enabled, activity has been recorded at least once,
// and more real time has elapsed since than the configured idle window.
export function isIdleExpired() {
  const prefs = readPrefs();
  if (!prefs.autoLogoutEnabled) return false;
  const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
  if (!raw) return false;
  const last = Number(raw);
  if (!Number.isFinite(last)) return false;
  return Date.now() - last > idleDurationMs();
}

export function markSessionExpired() {
  try {
    sessionStorage.setItem(SESSION_EXPIRED_REASON_KEY, '1');
  } catch {
    // storage unavailable
  }
}

// Read-only — safe to call more than once (e.g. a useState lazy initializer,
// which React invokes twice under StrictMode in dev). Pair with
// clearSessionExpiredFlag() in a separate effect so the flag is still only
// ever consumed once per page load, regardless of how many times it's read.
export function peekSessionExpiredFlag() {
  try {
    return sessionStorage.getItem(SESSION_EXPIRED_REASON_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearSessionExpiredFlag() {
  try {
    sessionStorage.removeItem(SESSION_EXPIRED_REASON_KEY);
  } catch {
    // storage unavailable
  }
}

export function markAccountSuspended() {
  try {
    sessionStorage.setItem(ACCOUNT_SUSPENDED_KEY, '1');
  } catch {
    // storage unavailable
  }
}
export function peekAccountSuspendedFlag() {
  try {
    return sessionStorage.getItem(ACCOUNT_SUSPENDED_KEY) === '1';
  } catch {
    return false;
  }
}
export function clearAccountSuspendedFlag() {
  try {
    sessionStorage.removeItem(ACCOUNT_SUSPENDED_KEY);
  } catch {
    // storage unavailable
  }
}
