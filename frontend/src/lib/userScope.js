// Namespaces client-side storage keys (localStorage/sessionStorage) by the
// signed-in user so per-device caches — theme, preferences, PIN, dashboard
// layout cache, account order — can never bleed from one account to another
// on a shared browser. The app is a pure SPA (no full reload on login/
// logout, see AuthContext), so plain module-level state here is the only way
// non-hook utilities (formatCurrency, idleSession, etc.) see the current
// user without threading userId through every call site.
let currentUserId = null;

export function setCurrentUserId(id) {
  currentUserId = id || null;
}

export function getCurrentUserId() {
  return currentUserId;
}

// No signed-in user yet (landing/login pages) falls back to the bare key —
// same behavior as before this file existed.
export function scopedKey(base) {
  return currentUserId ? `${base}::${currentUserId}` : base;
}
