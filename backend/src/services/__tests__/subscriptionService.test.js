const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  STATUS,
  addMonths,
  daysRemaining,
  resolveInitialSubscription,
  computeStatus,
  toApiShape,
} = require('../subscriptionService');

test('addMonths adds calendar months and clamps to end of a shorter month', () => {
  assert.equal(addMonths('2026-01-31T00:00:00.000Z', 1).toISOString().slice(0, 10), '2026-02-28');
  assert.equal(addMonths('2026-01-15T00:00:00.000Z', 1).toISOString().slice(0, 10), '2026-02-15');
  assert.equal(addMonths('2026-12-20T00:00:00.000Z', 1).toISOString().slice(0, 10), '2027-01-20');
  assert.equal(addMonths('2024-01-31T00:00:00.000Z', 1).toISOString().slice(0, 10), '2024-02-29');
});

test('daysRemaining ceils partial days and floors at zero', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(daysRemaining('2026-01-23T09:00:00.000Z', now), 23);
  assert.equal(daysRemaining('2026-01-01T00:00:01.000Z', now), 1);
  assert.equal(daysRemaining('2025-12-30T00:00:00.000Z', now), 0);
  assert.equal(daysRemaining(null, now), 0);
});

test('resolveInitialSubscription: trial system OFF -> FREE_ACCESS for everyone', () => {
  const sub = resolveInitialSubscription({
    profileCreatedAt: '2026-01-01',
    settings: { trialEnabled: false },
    now: new Date('2026-06-01'),
  });
  assert.equal(sub.type, STATUS.FREE_ACCESS);
  assert.equal(sub.trialEndsAt, null);
});

test('resolveInitialSubscription: account created BEFORE enforcement is grandfathered to FREE_ACCESS', () => {
  const sub = resolveInitialSubscription({
    profileCreatedAt: '2026-01-10T00:00:00.000Z',
    settings: {
      trialEnabled: true,
      trialDurationMonths: 1,
      enforcementStartedAt: '2026-02-01T00:00:00.000Z',
    },
    now: new Date('2026-02-15T00:00:00.000Z'),
  });
  assert.equal(sub.type, STATUS.FREE_ACCESS);
});

test('resolveInitialSubscription: account created AFTER enforcement gets a 1-month trial from its creation date', () => {
  const sub = resolveInitialSubscription({
    profileCreatedAt: '2026-02-20T00:00:00.000Z',
    settings: {
      trialEnabled: true,
      trialDurationMonths: 1,
      enforcementStartedAt: '2026-02-01T00:00:00.000Z',
    },
    now: new Date('2026-02-21T00:00:00.000Z'),
  });
  assert.equal(sub.type, STATUS.FREE_TRIAL);
  assert.equal(sub.trialStartedAt.toISOString().slice(0, 10), '2026-02-20');
  assert.equal(sub.trialEndsAt.toISOString().slice(0, 10), '2026-03-20');
});

test('computeStatus: FREE_TRIAL flips to EXPIRED the instant the clock passes trialEndsAt', () => {
  const sub = { type: STATUS.FREE_TRIAL, trialEndsAt: '2026-03-20T00:00:00.000Z' };
  assert.equal(computeStatus(sub, new Date('2026-03-19T23:59:59.000Z')), STATUS.FREE_TRIAL);
  assert.equal(computeStatus(sub, new Date('2026-03-20T00:00:01.000Z')), STATUS.EXPIRED);
});

test('computeStatus: ACTIVE with a future end stays ACTIVE, past end is EXPIRED; CANCELLED/FREE_ACCESS pass through', () => {
  const now = new Date('2026-03-01T00:00:00.000Z');
  assert.equal(computeStatus({ type: STATUS.ACTIVE, subscriptionEndsAt: '2026-04-01' }, now), STATUS.ACTIVE);
  assert.equal(computeStatus({ type: STATUS.ACTIVE, subscriptionEndsAt: '2026-02-01' }, now), STATUS.EXPIRED);
  assert.equal(computeStatus({ type: STATUS.ACTIVE }, now), STATUS.ACTIVE);
  assert.equal(computeStatus({ type: STATUS.CANCELLED }, now), STATUS.CANCELLED);
  assert.equal(computeStatus({ type: STATUS.FREE_ACCESS }, now), STATUS.FREE_ACCESS);
});

test('toApiShape exposes ISO dates + a derived daysRemaining only while the trial/sub is live', () => {
  const now = new Date('2026-03-01T00:00:00.000Z');
  const trial = toApiShape(
    { type: STATUS.FREE_TRIAL, trialStartedAt: '2026-02-20', trialEndsAt: '2026-03-20T00:00:00.000Z' },
    now
  );
  assert.equal(trial.status, STATUS.FREE_TRIAL);
  assert.equal(trial.trialEndDate, '2026-03-20T00:00:00.000Z');
  assert.equal(trial.daysRemaining, 19);

  const expired = toApiShape({ type: STATUS.FREE_TRIAL, trialEndsAt: '2026-02-01' }, now);
  assert.equal(expired.status, STATUS.EXPIRED);
  assert.equal(expired.daysRemaining, 0);
});
