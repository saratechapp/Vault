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

test('policyFor: ACTIVE subscriber -> paid monthly window', () => {
  const p = policyFor({ status: 'ACTIVE' });
  assert.equal(p.plan, 'active');
  assert.equal(p.scope, 'month');
  assert.equal(p.limit, POLICY.MONTHLY.limit);
});

test('policyFor: FREE_TRIAL -> trial monthly window', () => {
  const p = policyFor({ status: 'FREE_TRIAL' });
  assert.equal(p.plan, 'trial');
  assert.equal(p.scope, 'month');
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

test('paid user counts only the CURRENT month window; a stale window reads as 0', () => {
  const now = new Date('2026-08-15T00:00:00Z');
  const stale = computeQuota({ status: 'ACTIVE' }, { lifetimeCount: 500, windowKey: '2026-07', windowCount: 40 }, now);
  assert.equal(stale.used, 0);
  assert.equal(stale.remaining, POLICY.MONTHLY.limit);

  const current = computeQuota({ status: 'ACTIVE' }, { lifetimeCount: 500, windowKey: '2026-08', windowCount: 40 }, now);
  assert.equal(current.used, 40);
  assert.equal(current.remaining, POLICY.MONTHLY.limit - 40);
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
