const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeLargeExpenseAlerts, computeRecurringPatterns } = require('../spendingAnalysisService');
const { addDaysFromToday, iso } = require('../shared');

test('computeLargeExpenseAlerts flags recent expenses at/above the trailing percentile threshold', () => {
  // 20 expenses of 100 in the lookback window, plus one at 1000 recently —
  // the 95th percentile of a 20-value array sorted ascending sits at the
  // top value, so only the 1000 (and nothing at 100) should be flagged.
  const transactions = [];
  for (let i = 2; i < 21; i++) {
    transactions.push({ id: `t${i}`, type: 'expense', vendor: 'Regular', amount: -100, date: iso(addDaysFromToday(-i)) });
  }
  transactions.push({ id: 'big', type: 'expense', vendor: 'Big One', amount: -1000, date: iso(addDaysFromToday(-1)) });
  const result = computeLargeExpenseAlerts({ transactions }, { lookbackDays: 90, recentDays: 30, percentile: 0.95 });
  assert.equal(result.length, 1);
  assert.equal(result[0].transactionId, 'big');
  assert.equal(result[0].amount, 1000);
});

test('computeLargeExpenseAlerts returns nothing with too little history to judge from', () => {
  const transactions = [{ type: 'expense', amount: -100, date: iso(addDaysFromToday(-1)) }];
  assert.deepEqual(computeLargeExpenseAlerts({ transactions }), []);
});

function monthlyOccurrences(vendor, amounts) {
  // amounts[0] is oldest, last is most recent — spaced 30 days apart, which
  // is inside computeRecurringPatterns' 20-40 day "recurring" window.
  return amounts.map((amount, i) => ({
    id: `${vendor}-${i}`,
    type: 'expense',
    vendor,
    categoryId: null,
    amount: -amount,
    date: iso(addDaysFromToday(-30 * (amounts.length - 1 - i))),
  }));
}

test('computeRecurringPatterns detects a price change on the most recent occurrence', () => {
  // Steady at 500 for two occurrences, then a 20% jump to 600 — under the
  // 15% max-deviation-from-average guard (avg of [500,500,600]=533, max
  // deviation ~12.5%) so it still counts as "recurring", but the price
  // change is still worth surfacing separately.
  const transactions = monthlyOccurrences('Gym', [500, 500, 600]);
  const patterns = computeRecurringPatterns(transactions, []);
  assert.equal(patterns.length, 1);
  assert.ok(patterns[0].priceChange, 'expected a priceChange to be detected');
  assert.equal(patterns[0].priceChange.to, 600);
});

test('computeRecurringPatterns reports no priceChange when the amount is stable', () => {
  const transactions = monthlyOccurrences('Rent', [15000, 15000, 15000]);
  const patterns = computeRecurringPatterns(transactions, []);
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].priceChange, null);
});

test('computeRecurringPatterns flags isDuplicate when two vendor spellings match the same subscription hint', () => {
  const netflix1 = monthlyOccurrences('Netflix', [500, 500, 500]);
  const netflix2 = monthlyOccurrences('Netflix.com', [500, 500, 500]);
  const patterns = computeRecurringPatterns([...netflix1, ...netflix2], []);
  assert.equal(patterns.length, 2);
  assert.ok(patterns.every((p) => p.isSubscription));
  assert.ok(patterns.every((p) => p.isDuplicate === true));
});

test('computeRecurringPatterns does not flag isDuplicate for two different services filed under the same category', () => {
  const netflix = monthlyOccurrences('Netflix', [500, 500, 500]);
  const spotify = monthlyOccurrences('Spotify', [200, 200, 200]);
  const patterns = computeRecurringPatterns([...netflix, ...spotify], []);
  assert.equal(patterns.length, 2);
  assert.ok(patterns.every((p) => p.isDuplicate === false));
});
