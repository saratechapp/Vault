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

// The counter key that defines "this allowance window":
//   'lifetime'                 -> the free 3-ever cap
//   'YYYY' / 'YYYY-MM'         -> legacy calendar year / month
//   'bp:<ms>'                  -> a billing period: the ms timestamp of the
//                                subscription's current_period_start. It
//                                changes the instant a renewal webhook
//                                advances the period, so the count resets on
//                                the actual billing anniversary, not the 1st
//                                of the month. `subscription` is the resolved
//                                status object from db.resolveForUser (carries
//                                currentPeriodStart once the user has a
//                                provider subscription).
// UTC so calendar boundaries are deterministic regardless of server TZ.
function windowKeyFor(scope, now = new Date(), subscription = null) {
  if (scope === 'lifetime') return 'lifetime';
  const y = now.getUTCFullYear();
  const monthKey = `${y}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  if (scope === 'year') return String(y);
  if (scope === 'billing_period') {
    const start = subscription && subscription.currentPeriodStart;
    const t = start ? Date.parse(start) : NaN;
    // Pre-checkout auto-trial (0025) has no provider period yet -> nearest
    // equivalent is the calendar month, which is also what a lapsed trial /
    // free user would already be keyed on.
    return Number.isNaN(t) ? monthKey : `bp:${t}`;
  }
  return monthKey;
}

// Pure: (subscription status, raw counter row) -> quota object. `counters`
// is what db.getReceiptScanCounters returns:
//   { lifetimeCount, windowKey, windowCount, unavailable? }
function computeQuota(subscription, counters, now = new Date()) {
  const pol = policyFor(subscription);
  const enforced = POLICY.ENFORCED && !(counters && counters.unavailable);
  const windowKey = windowKeyFor(pol.scope, now, subscription);

  const used =
    pol.scope === 'lifetime'
      ? (counters && counters.lifetimeCount) || 0
      : counters && counters.windowKey === windowKey
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
    // The exact counter key this quota was computed against — record() reuses
    // it so the bump lands in the same window the check read.
    windowKey,
    // The subscription period this allowance follows, so the app can show
    // "resets on <date>" without hardcoding a month boundary. Null for the
    // lifetime (free) and calendar-month (pre-checkout trial) windows.
    periodStart: (subscription && subscription.currentPeriodStart) || null,
    periodEnd: (subscription && subscription.currentPeriodEnd) || null,
    // True only when the counter store couldn't be read (table missing /
    // unreachable). The pure math above still degrades to "no cap" for
    // dev/test; resolve() decides whether that degradation is acceptable
    // for the current environment.
    unavailable: !!(counters && counters.unavailable),
    monthlyLimit: POLICY.MONTHLY.limit,
    yearlyLimit: POLICY.YEARLY.limit,
  };
}

async function resolve(userId, subscription) {
  const counters = await db.getReceiptScanCounters(userId);
  const quota = computeQuota(subscription, counters);
  // Fail closed in production: an un-countable scan is an unmetered scan,
  // which silently defeats the lifetime / window cap the spec requires be
  // un-bypassable. If the counter store is unreachable (0027 not applied,
  // Postgres down), a production request gets a 503 from the route rather
  // than free unlimited scans. Dev/test keep the original "degrade to no
  // cap" behaviour so a local env without 0027 still works — and the pure
  // computeQuota() unit tests are unaffected.
  if (quota.unavailable && process.env.NODE_ENV === 'production') {
    return { ...quota, unlimited: false, enforced: true, remaining: 0, used: quota.limit ?? 0 };
  }
  return quota;
}

// Call AFTER a scan has actually produced a result. `resolvedQuota` is what
// resolve() returned at the top of the same request.
async function record(userId, resolvedQuota) {
  if (!resolvedQuota.enforced) return resolvedQuota; // nothing to count
  // Reuse the exact key the check was computed against (billing_period keys
  // can't be recomputed here without the subscription object).
  const windowKey = resolvedQuota.windowKey || windowKeyFor(resolvedQuota.scope);
  const bumped = await db.bumpReceiptScanCounter(userId, windowKey);
  const used = resolvedQuota.scope === 'lifetime' ? bumped.lifetimeCount : bumped.windowCount;
  const limit = resolvedQuota.limit;
  return {
    ...resolvedQuota,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
  };
}

module.exports = { resolve, record, policyFor, windowKeyFor, computeQuota };
