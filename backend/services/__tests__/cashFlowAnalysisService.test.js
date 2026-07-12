const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeAverageDailySpending, computeWeekendVsWeekday,
  computeTopSpendingCategories, computeTopMerchants,
} = require('../cashFlowAnalysisService');
const { addDaysFromToday, iso } = require('../shared');

test('computeAverageDailySpending divides trailing-window expense total by the window size', () => {
  const userData = {
    transactions: [
      { type: 'expense', amount: -100, date: iso(addDaysFromToday(-1)) },
      { type: 'expense', amount: -200, date: iso(addDaysFromToday(-5)) },
      { type: 'income', amount: 5000, date: iso(addDaysFromToday(-1)) }, // ignored — not an expense
      { type: 'expense', amount: -900, date: iso(addDaysFromToday(-40)) }, // outside the 30-day window
    ],
  };
  // (100 + 200) / 30 = 10
  assert.equal(computeAverageDailySpending(userData, { days: 30 }), 10);
});

test('computeWeekendVsWeekday buckets expense transactions by actual day-of-week', () => {
  // Build the window from real dates so the test can't drift out of sync
  // with "today" — classify each offset the same way the function does
  // (Sun=0/Sat=6), then assert the totals it computes match.
  const days = 10;
  let expectedWeekend = 0, expectedWeekday = 0;
  const transactions = [];
  for (let i = 0; i < days; i++) {
    const d = addDaysFromToday(-i);
    const amount = 10 + i; // distinct amount per day so mis-bucketing would be caught
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    if (isWeekend) expectedWeekend += amount; else expectedWeekday += amount;
    transactions.push({ type: 'expense', amount: -amount, date: iso(d) });
  }
  const result = computeWeekendVsWeekday({ transactions }, { days });
  assert.equal(result.weekendTotal, expectedWeekend);
  assert.equal(result.weekdayTotal, expectedWeekday);
});

test('computeTopSpendingCategories sums expense-only, sorts descending, and respects an explicit n', () => {
  const categories = [{ id: 'c1', name: 'Rent', color: '#111' }, { id: 'c2', name: 'Food', color: '#222' }];
  const userData = {
    categories,
    transactions: [
      { type: 'expense', categoryId: 'c1', amount: -1500 },
      { type: 'expense', categoryId: 'c2', amount: -300 },
      { type: 'expense', categoryId: 'c2', amount: -200 },
      { type: 'income', categoryId: 'c1', amount: 5000 }, // ignored — not an expense
    ],
  };
  const all = computeTopSpendingCategories(userData);
  assert.deepEqual(all.map((c) => c.categoryId), ['c1', 'c2']);
  assert.equal(all[1].amount, 500);
  const capped = computeTopSpendingCategories(userData, { n: 1 });
  assert.equal(capped.length, 1);
  assert.equal(capped[0].categoryId, 'c1');
});

test('computeTopMerchants excludes debt-payment-labeled expenses and non-expense transactions', () => {
  const userData = {
    transactions: [
      { type: 'expense', vendor: 'Landlord', amount: -1000, labels: [] },
      { type: 'expense', vendor: 'Personal Loan', amount: -500, labels: ['debt-payment'] },
      { type: 'transfer', vendor: 'Landlord', amount: -999, labels: [] },
    ],
  };
  const result = computeTopMerchants(userData);
  assert.deepEqual(result, [{ vendor: 'Landlord', amount: 1000 }]);
});
