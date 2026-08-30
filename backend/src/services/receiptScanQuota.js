// Resolves and records a user's AI receipt-scan allowance. The route
// (POST /api/records/scan, GET /api/records/scan/quota) does no limit
// arithmetic of its own — it asks here.
//
//   resolve(userId, subscription)  -> quota object (see shape below), read-only
//   record(userId, quota)          -> bumps the counter for a COMPLETED scan,
//                                     returns the fresh quota object
//
// Quota object (this is exactly what the mobile app renders from — it never
// hardcodes a number):
//   {
//     scope: 'lifetime' | 'month' | 'year',
//     plan:  'free' | 'trial' | 'active',
//     subscriptionStatus: 'FREE_ACCESS' | 'FREE_TRIAL' | 'ACTIVE' | ...,
//     limit: number | null,        // null = unlimited
//     used: number,
//     remaining: number | null,    // null = unlimited
//     unlimited: boolean,
//     enforced: boolean,           // false ⇒ never blocked (master switch / table missing)
//     monthlyLimit: number | null, // advertised paid limits, for the upgrade screen
//     yearlyLimit: number | null,
//   }
//
// The pure helpers (policyFor / windowKeyFor / computeQuota) take no db and
// are unit-tested directly; resolve/record just wrap them around
// db.getReceiptScanCounters / db.bumpReceiptScanCounter.
const db = require('../db');
const POLICY = require('./receiptScanPolicy');

function policyFor(subscription) {
  const status = subscription && subscription.status;
  if (status === 'ACTIVE') return { plan: 'active', ...POLICY.MONTHLY };
  if (status === 'FREE_TRIAL') return { plan: 'trial', ...POLICY.TRIAL };
  // FREE_ACCESS, EXPIRED, CANCELLED, or anything unknown → Free tier.
  return { plan: 'free', ...POLICY.FREE };
}

// 'YYYY' for a yearly window, 'YYYY-MM' for a monthly one, 'lifetime'
// otherwise. UTC so the boundary is deterministic regardless of server TZ.
function windowKeyFor(scope, now = new Date()) {
  if (scope === 'lifetime') return 'lifetime';
  const y = now.getUTCFullYear();
  if (scope === 'year') return String(y);
  return `${y}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Pure: (subscription status, raw counter row) -> quota object. `counters`
// is what db.getReceiptScanCounters returns:
//   { lifetimeCount, windowKey, windowCount, unavailable? }
function computeQuota(subscription, counters, now = new Date()) {
  const pol = policyFor(subscription);
  const enforced = POLICY.ENFORCED && !(counters && counters.unavailable);

  const used =
    pol.scope === 'lifetime'
      ? (counters && counters.lifetimeCount) || 0
      : counters && counters.windowKey === windowKeyFor(pol.scope, now)
        ? counters.windowCount || 0
        : 0;

  const limit = pol.limit;
  const unlimited = limit === null || limit === undefined || limit === Infinity || !enforced;

  return {
    scope: pol.scope,
    plan: pol.plan,
    subscriptionStatus: (subscription && subscription.status) || 'FREE_ACCESS',
    limit: unlimited ? null : limit,
    used,
    remaining: unlimited ? null : Math.max(0, limit - used),
    unlimited,
    enforced,
    monthlyLimit: POLICY.MONTHLY.limit,
    yearlyLimit: POLICY.YEARLY.limit,
  };
}

async function resolve(userId, subscription) {
  const counters = await db.getReceiptScanCounters(userId);
  return computeQuota(subscription, counters);
}

// Call AFTER a scan has actually produced a result. `resolvedQuota` is what
// resolve() returned at the top of the same request.
async function record(userId, resolvedQuota) {
  if (!resolvedQuota.enforced) return resolvedQuota; // nothing to count
  const bumped = await db.bumpReceiptScanCounter(userId, windowKeyFor(resolvedQuota.scope));
  const used = resolvedQuota.scope === 'lifetime' ? bumped.lifetimeCount : bumped.windowCount;
  const limit = resolvedQuota.limit;
  return {
    ...resolvedQuota,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
  };
}

module.exports = { resolve, record, policyFor, windowKeyFor, computeQuota };
