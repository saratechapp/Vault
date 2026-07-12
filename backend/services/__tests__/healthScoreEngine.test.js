const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeCreditUtilization } = require('../healthScoreEngine');

test('computeCreditUtilization returns null when no credit account has a limit set', () => {
  const accounts = [
    { type: 'credit', balance: -5000, creditLimit: null },
    { type: 'bank', balance: 10000, creditLimit: null },
  ];
  assert.equal(computeCreditUtilization(accounts), null);
});

test('computeCreditUtilization sums used/limit across credit accounts with a limit, ignoring others', () => {
  const accounts = [
    // Owes 3,000 of a 10,000 limit.
    { type: 'credit', balance: -3000, creditLimit: 10000 },
    // Owes 1,000 of a 5,000 limit.
    { type: 'credit', balance: -1000, creditLimit: 5000 },
    // No limit set — excluded entirely, not treated as 0% used.
    { type: 'credit', balance: -9000, creditLimit: null },
    // Not a credit account — excluded regardless of balance.
    { type: 'bank', balance: -500, creditLimit: 1000 },
  ];
  const result = computeCreditUtilization(accounts);
  // (3000 + 1000) / (10000 + 5000) = 4000 / 15000 = 26.666...%
  assert.deepEqual(result, { totalUsed: 4000, totalLimit: 15000, utilizationPct: 26.7 });
});

test('computeCreditUtilization treats a positive (paid-off) credit balance as zero used', () => {
  const accounts = [{ type: 'credit', balance: 200, creditLimit: 10000 }];
  const result = computeCreditUtilization(accounts);
  assert.deepEqual(result, { totalUsed: 0, totalLimit: 10000, utilizationPct: 0 });
});
