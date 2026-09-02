// Dummy Supabase env so requiring the module graph (receiptScanQuota ->
// db -> supabaseClient) doesn't throw. No query ever runs here — the db
// counter reads are passed in directly to the pure computeQuota().
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const POLICY = require('../receiptScanPolicy');
const { policyFor, windowKeyFor, computeQuota } = require('../receiptScanQuota');

// ---------------------------------------------------------------------------
// policyFor — subscription status -> allowance
// ---------------------------------------------------------------------------

test('policyFor: no / lapsed subscription -> Free lifetime 3', () => {
  for (const status of ['FREE_ACCESS', 'EXPIRED', 'CANCELLED', undefined, 'WHATEVER']) {
    const p = policyFor(status ? { status } : null);
    assert.equal(p.plan, 'free');
    assert.equal(p.scope, 'lifetime');
    assert.equal(p.limit, 3);
  }
});

test('policyFor: ACTIVE subscriber -> 15 per billing period', () => {
  const p = policyFor({ status: 'ACTIVE' });
  assert.equal(p.plan, 'active');
  assert.equal(p.scope, 'billing_period');
  assert.equal(p.limit, 15);
  assert.equal(p.limit, POLICY.MONTHLY.limit);
});

test('policyFor: FREE_TRIAL -> the same 15 per billing period', () => {
  const p = policyFor({ status: 'FREE_TRIAL' });
  assert.equal(p.plan, 'trial');
  assert.equal(p.scope, 'billing_period');
  assert.equal(p.limit, 15);
});

// ---------------------------------------------------------------------------
// windowKeyFor
// ---------------------------------------------------------------------------

test('windowKeyFor: lifetime / month / year keys (UTC)', () => {
  const at = new Date('2026-08-30T12:00:00Z');
  assert.equal(windowKeyFor('lifetime', at), 'lifetime');
  assert.equal(windowKeyFor('month', at), '2026-08');
  assert.equal(windowKeyFor('year', at), '2026');
});

test('windowKeyFor: billing_period keys on the provider period start, else the calendar month', () => {
  const at = new Date('2026-08-30T12:00:00Z');
  // provider subscription with a real period -> key tracks current_period_start
  const start = '2026-09-02T00:00:00.000Z';
  assert.equal(windowKeyFor('billing_period', at, { currentPeriodStart: start }), `bp:${Date.parse(start)}`);
  // a renewal advances current_period_start -> a different key -> count resets
  const next = '2026-10-02T00:00:00.000Z';
  assert.notEqual(
    windowKeyFor('billing_period', at, { currentPeriodStart: start }),
    windowKeyFor('billing_period', at, { currentPeriodStart: next })
  );
  // pre-checkout auto-trial (no provider period) -> calendar month fallback
  assert.equal(windowKeyFor('billing_period', at, null), '2026-08');
  assert.equal(windowKeyFor('billing_period', at, { currentPeriodStart: null }), '2026-08');
});

// ---------------------------------------------------------------------------
// computeQuota — the enforcement math the route relies on
// ---------------------------------------------------------------------------

test('Free user, 1 of 3 lifetime scans used', () => {
  const q = computeQuota({ status: 'FREE_ACCESS' }, { lifetimeCount: 1, windowKey: null, windowCount: 0 });
  assert.equal(q.scope, 'lifetime');
  assert.equal(q.limit, 3);
  assert.equal(q.used, 1);
  assert.equal(q.remaining, 2);
  assert.equal(q.unlimited, false);
});

test('Free user who has used all 3 -> remaining 0 (route blocks)', () => {
  const q = computeQuota({ status: 'FREE_ACCESS' }, { lifetimeCount: 3, windowKey: null, windowCount: 0 });
  assert.equal(q.remaining, 0);
  assert.equal(q.unlimited, false);
});

test('Free user somehow over the cap never goes negative', () => {
  const q = computeQuota({ status: 'FREE_ACCESS' }, { lifetimeCount: 9, windowKey: null, windowCount: 0 });
  assert.equal(q.remaining, 0);
});

test('paid user counts only the CURRENT billing period; last period reads as 0 (auto-reset)', () => {
  const now = new Date('2026-10-05T00:00:00Z');
  const period = { status: 'ACTIVE', currentPeriodStart: '2026-10-02T00:00:00.000Z', currentPeriodEnd: '2026-11-02T00:00:00.000Z' };
  const lastPeriodKey = `bp:${Date.parse('2026-09-02T00:00:00.000Z')}`;
  const thisPeriodKey = `bp:${Date.parse('2026-10-02T00:00:00.000Z')}`;

  const stale = computeQuota(period, { lifetimeCount: 500, windowKey: lastPeriodKey, windowCount: 15 }, now);
  assert.equal(stale.used, 0, 'a fresh billing period starts the count over');
  assert.equal(stale.remaining, 15);
  assert.equal(stale.windowKey, thisPeriodKey);

  const current = computeQuota(period, { lifetimeCount: 500, windowKey: thisPeriodKey, windowCount: 9 }, now);
  assert.equal(current.used, 9);
  assert.equal(current.remaining, 6);
  assert.equal(current.periodEnd, period.currentPeriodEnd);
});

test('paid user at 15/15 in the current period -> remaining 0 (route blocks)', () => {
  const now = new Date('2026-10-05T00:00:00Z');
  const key = `bp:${Date.parse('2026-10-02T00:00:00.000Z')}`;
  const q = computeQuota(
    { status: 'ACTIVE', currentPeriodStart: '2026-10-02T00:00:00.000Z' },
    { lifetimeCount: 999, windowKey: key, windowCount: 15 },
    now
  );
  assert.equal(q.remaining, 0);
  assert.equal(q.unlimited, false);
});

test('table not applied yet -> unlimited, never blocks (pure computeQuota / dev+test)', () => {
  const q = computeQuota({ status: 'FREE_ACCESS' }, { lifetimeCount: 0, windowKey: null, windowCount: 0, unavailable: true });
  assert.equal(q.unlimited, true);
  assert.equal(q.remaining, null);
  assert.equal(q.enforced, false);
  // Surfaced so resolve() can fail the request closed in production instead
  // of handing out free unlimited scans when the counter store is missing.
  assert.equal(q.unavailable, true);
});

test('counter store reachable -> unavailable is false', () => {
  const q = computeQuota({ status: 'FREE_ACCESS' }, { lifetimeCount: 1, windowKey: null, windowCount: 0 });
  assert.equal(q.unavailable, false);
});

test('quota exposes advertised monthly/yearly limits for the upgrade screen', () => {
  const q = computeQuota({ status: 'FREE_ACCESS' }, { lifetimeCount: 0, windowKey: null, windowCount: 0 });
  assert.equal(q.monthlyLimit, POLICY.MONTHLY.limit);
  assert.equal(q.yearlyLimit, POLICY.YEARLY.limit);
});
