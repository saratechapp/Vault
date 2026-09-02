// Dummy Supabase env so requiring subscriptionService (via canonicalStatus)
// doesn't throw. Nothing here touches the DB.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { SUB_STATUS, grantsPremium, mirrorShapeFor } = require('../canonicalStatus');
const { STATUS } = require('../../subscriptionService');

const FUTURE = new Date(Date.now() + 20 * 864e5).toISOString();
const PAST = new Date(Date.now() - 5 * 864e5).toISOString();
const NOW = new Date();

test('grantsPremium: trialing / active / past_due yes; incomplete / paused / expired / cancelled no', () => {
  assert.equal(grantsPremium(SUB_STATUS.TRIALING), true);
  assert.equal(grantsPremium(SUB_STATUS.ACTIVE), true);
  assert.equal(grantsPremium(SUB_STATUS.PAST_DUE), true, 'grace period keeps access');
  assert.equal(grantsPremium(SUB_STATUS.INCOMPLETE), false);
  assert.equal(grantsPremium(SUB_STATUS.PAUSED), false);
  assert.equal(grantsPremium(SUB_STATUS.EXPIRED), false);
  assert.equal(grantsPremium(SUB_STATUS.CANCELLED), false);
});

test('mirrorShapeFor: incomplete -> null (leave prior profile state untouched)', () => {
  assert.equal(mirrorShapeFor({ status: SUB_STATUS.INCOMPLETE, provider: 'stripe' }, NOW), null);
});

test('mirrorShapeFor: trialing -> FREE_TRIAL with trial dates', () => {
  const m = mirrorShapeFor(
    { status: SUB_STATUS.TRIALING, provider: 'stripe', trialStartAt: PAST, trialEndAt: FUTURE, currentPeriodEnd: FUTURE },
    NOW
  );
  assert.equal(m.subscriptionType, STATUS.FREE_TRIAL);
  assert.equal(m.trialEndsAt, FUTURE);
  assert.equal(m.subscriptionEndsAt, null);
});

test('mirrorShapeFor: active -> ACTIVE, ends at current_period_end', () => {
  const m = mirrorShapeFor(
    { status: SUB_STATUS.ACTIVE, provider: 'razorpay', currentPeriodStart: PAST, currentPeriodEnd: FUTURE, billingCycle: 'monthly' },
    NOW
  );
  assert.equal(m.subscriptionType, STATUS.ACTIVE);
  assert.equal(m.subscriptionEndsAt, FUTURE);
  assert.equal(m.billingPeriod, 'monthly');
});

test('mirrorShapeFor: past_due keeps ACTIVE until the paid period end (grace, no revoke)', () => {
  const m = mirrorShapeFor(
    { status: SUB_STATUS.PAST_DUE, provider: 'stripe', currentPeriodStart: PAST, currentPeriodEnd: FUTURE },
    NOW
  );
  assert.equal(m.subscriptionType, STATUS.ACTIVE);
  assert.equal(m.subscriptionEndsAt, FUTURE);
});

test('mirrorShapeFor: cancelled but still inside the paid period -> ACTIVE + cancelAtPeriodEnd', () => {
  const m = mirrorShapeFor(
    { status: SUB_STATUS.CANCELLED, provider: 'stripe', currentPeriodEnd: FUTURE },
    NOW
  );
  assert.equal(m.subscriptionType, STATUS.ACTIVE);
  assert.equal(m.subscriptionEndsAt, FUTURE);
  assert.equal(m.cancelAtPeriodEnd, true);
});

test('mirrorShapeFor: cancelled after the paid period -> CANCELLED', () => {
  const m = mirrorShapeFor({ status: SUB_STATUS.CANCELLED, provider: 'stripe', currentPeriodEnd: PAST }, NOW);
  assert.equal(m.subscriptionType, STATUS.CANCELLED);
});

test('mirrorShapeFor: paused -> CANCELLED (no access) ; expired -> EXPIRED', () => {
  assert.equal(mirrorShapeFor({ status: SUB_STATUS.PAUSED, currentPeriodEnd: PAST }, NOW).subscriptionType, STATUS.CANCELLED);
  assert.equal(mirrorShapeFor({ status: SUB_STATUS.EXPIRED, currentPeriodEnd: PAST }, NOW).subscriptionType, STATUS.EXPIRED);
});
