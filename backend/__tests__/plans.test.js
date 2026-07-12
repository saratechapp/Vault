const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PLANS, getPlanConfig, can, limitFor, serializableLimits } = require('../plans');

test('getPlanConfig resolves each of the 4 real tiers by exact key', () => {
  assert.equal(getPlanConfig('free'), PLANS.free);
  assert.equal(getPlanConfig('pro'), PLANS.pro);
  assert.equal(getPlanConfig('premium'), PLANS.premium);
  assert.equal(getPlanConfig('enterprise'), PLANS.enterprise);
});

test('getPlanConfig falls back to PLANS.free for an unknown or undefined plan key', () => {
  assert.equal(getPlanConfig('not-a-real-plan'), PLANS.free);
  assert.equal(getPlanConfig(undefined), PLANS.free);
  assert.equal(getPlanConfig(null), PLANS.free);
  assert.equal(getPlanConfig(''), PLANS.free);
});

test('getPlanConfig lowercases the plan key before lookup', () => {
  assert.equal(getPlanConfig('FREE'), PLANS.free);
  assert.equal(getPlanConfig('Pro'), PLANS.pro);
  assert.equal(getPlanConfig('PREMIUM'), PLANS.premium);
});

test('can() reflects the free plan\'s fully-unlocked feature set', () => {
  assert.equal(can('free', 'canCreateUnlimitedAccounts'), true);
  assert.equal(can('free', 'canUseOCR'), true);
  assert.equal(can('free', 'canCloudBackup'), true);
});

test('can() reflects pro\'s specific restrictions: no unlimited accounts, no OCR, no cloud backup', () => {
  assert.equal(can('pro', 'canCreateUnlimitedAccounts'), false);
  assert.equal(can('pro', 'canUseOCR'), false);
  assert.equal(can('pro', 'canCloudBackup'), false);
  // Pro still has these enabled, for contrast.
  assert.equal(can('pro', 'canUseAIInsights'), true);
  assert.equal(can('pro', 'canExportPDF'), true);
});

test('can() reflects premium\'s fully-unlocked feature set', () => {
  assert.equal(can('premium', 'canCreateUnlimitedAccounts'), true);
  assert.equal(can('premium', 'canUseOCR'), true);
  assert.equal(can('premium', 'canCloudBackup'), true);
});

test('can() reflects enterprise\'s fully-unlocked feature set', () => {
  assert.equal(can('enterprise', 'canCreateUnlimitedAccounts'), true);
  assert.equal(can('enterprise', 'canUseOCR'), true);
  assert.equal(can('enterprise', 'canCloudBackup'), true);
});

test('can() returns false for a nonexistent feature flag', () => {
  assert.equal(can('free', 'notARealFeature'), false);
});

test('limitFor returns pro\'s specific finite numeric limits', () => {
  assert.equal(limitFor('pro', 'accounts'), 10);
  assert.equal(limitFor('pro', 'budgets'), 25);
  assert.equal(limitFor('pro', 'goals'), 25);
  assert.equal(limitFor('pro', 'aiRequestsPerDay'), 50);
});

test('limitFor returns Infinity for an unlimited limit on an unlimited tier', () => {
  assert.equal(limitFor('free', 'accounts'), Infinity);
  assert.equal(limitFor('premium', 'accounts'), Infinity);
  assert.equal(limitFor('enterprise', 'accounts'), Infinity);
  assert.equal(limitFor('pro', 'transactions'), Infinity);
});

test('limitFor returns Infinity for an unknown limit key', () => {
  assert.equal(limitFor('pro', 'notARealLimit'), Infinity);
  assert.equal(limitFor('free', 'notARealLimit'), Infinity);
});

test('limitFor falls back to the free plan (and its Infinity limits) for an unknown plan key', () => {
  assert.equal(limitFor('not-a-real-plan', 'accounts'), Infinity);
});

test('serializableLimits converts every Infinity limit to null and leaves finite numbers untouched (pro)', () => {
  const result = serializableLimits('pro');
  assert.deepEqual(result, {
    accounts: 10,
    budgets: 25,
    goals: 25,
    transactions: null,
    aiRequestsPerDay: 50,
  });
});

test('serializableLimits converts every limit to null for a fully-unlimited plan (free)', () => {
  const result = serializableLimits('free');
  assert.deepEqual(result, {
    accounts: null,
    budgets: null,
    goals: null,
    transactions: null,
    aiRequestsPerDay: null,
  });
});
