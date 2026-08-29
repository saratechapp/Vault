// ---------------------------------------------------------------------------
// Per-user compute cache for the analysis-service bundles (health score,
// AI insights, AI monthly report). Caches the *computed* result, not the
// Postgres fetch — req.userData is still fetched fresh on every request by
// requireAuth (see server.js); this only saves re-running the ~10 statistics
// passes buildInsightsBundle performs over the same in-memory arrays.
//
// Invalidation is a per-user version counter bumped by touch(userId), called
// from server.js's bumpCache(userId) — which already runs at the end of
// every mutating route (32 call sites). A version counter (not a row-count/
// last-modified fingerprint) is required for correctness: editing an
// existing transaction's amount via PATCH changes neither row count nor most
// recent date, so a fingerprint would serve a stale cache after an in-place
// edit. A 5-minute TTL is a backstop in case a future mutating route is ever
// added without wiring bumpCache(userId).
//
// Single-process in-memory Map — fine only because the app is already
// documented as single-instance (see CLAUDE.md's note on securityLog). If
// this app is ever deployed multi-instance, this cache needs to move to a
// shared store (Redis) or be removed.
// ---------------------------------------------------------------------------
const TTL_MS = 5 * 60 * 1000;

const versions = new Map(); // userId -> number
const entries = new Map(); // `${userId}:${cacheName}` -> { version, expiresAt, value }

function currentVersion(userId) {
  return versions.get(userId) || 0;
}

function touch(userId) {
  versions.set(userId, currentVersion(userId) + 1);
}

async function getOrCompute(userId, cacheName, computeFn) {
  const key = `${userId}:${cacheName}`;
  const version = currentVersion(userId);
  const cached = entries.get(key);
  if (cached && cached.version === version && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const value = await computeFn();
  entries.set(key, { version, expiresAt: Date.now() + TTL_MS, value });
  return value;
}

module.exports = {
  touch,
  getOrCompute,
};
