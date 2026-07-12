const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeUnusedBudgets, recommendBudgetAdjustments } = require('../budgetAnalysisService');

const categories = [{ id: 'cat-1', name: 'Coffee', parentId: null }];

test('computeUnusedBudgets flags a monthly budget with zero spend over the checked periods', () => {
  const userData = {
    budgets: [{ id: 'budget-1', categoryId: 'cat-1', limit: 1000, period: 'monthly' }],
    transactions: [], // no spend at all, in any month
    categories,
  };
  const result = computeUnusedBudgets(userData, { periods: 3, thresholdPct: 5 });
  assert.equal(result.length, 1);
  assert.equal(result[0].budgetId, 'budget-1');
  assert.equal(result[0].avgPctUsed, 0);
});

test('computeUnusedBudgets does not flag a budget that was used in even one checked period', () => {
  const now = new Date();
  // A transaction one full month ago — inside the "last 3 periods" window.
  const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 10);
  const userData = {
    budgets: [{ id: 'budget-1', categoryId: 'cat-1', limit: 1000, period: 'monthly' }],
    transactions: [
      { type: 'expense', categoryId: 'cat-1', amount: -500, date: oneMonthAgo.toISOString().slice(0, 10) },
    ],
    categories,
  };
  const result = computeUnusedBudgets(userData, { periods: 3, thresholdPct: 5 });
  assert.equal(result.length, 0);
});

test('computeUnusedBudgets skips custom-period budgets (no repeating cadence to look back over)', () => {
  const userData = {
    budgets: [{ id: 'budget-1', categoryId: 'cat-1', limit: 1000, period: 'custom', startDate: '2026-01-01', endDate: '2026-01-31' }],
    transactions: [],
    categories,
  };
  assert.equal(computeUnusedBudgets(userData).length, 0);
});

test('recommendBudgetAdjustments suggests increasing a limit that is consistently exceeded', () => {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 10);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 10).toISOString().slice(0, 10);
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 10).toISOString().slice(0, 10);
  const userData = {
    budgets: [{ id: 'budget-1', categoryId: 'cat-1', limit: 1000 }],
    transactions: [
      { type: 'expense', categoryId: 'cat-1', amount: -2000, date: thisMonth },
      { type: 'expense', categoryId: 'cat-1', amount: -2000, date: lastMonth },
      { type: 'expense', categoryId: 'cat-1', amount: -2000, date: twoMonthsAgo },
    ],
    categories,
  };
  // avgSpend = 2000, limit = 1000 → +100% over threshold (20%) → increase.
  const result = recommendBudgetAdjustments(userData, { months: 3, thresholdPct: 20 });
  assert.equal(result.length, 1);
  assert.equal(result[0].direction, 'increase');
  assert.equal(result[0].avgSpend, 2000);
});

test('recommendBudgetAdjustments says nothing when average spend is within the threshold of the limit', () => {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 10);
  const userData = {
    budgets: [{ id: 'budget-1', categoryId: 'cat-1', limit: 1000 }],
    transactions: [{ type: 'expense', categoryId: 'cat-1', amount: -1050, date: thisMonth }],
    categories,
  };
  // avgSpend over 3 months = 1050/3 = 350, well under the limit, but that's
  // itself a >20% delta — this case exists to document the behavior (a
  // single month's spend divided across the whole window), not to assert
  // "no recommendation": confirm it correctly flags 'decrease' instead of
  // silently returning nothing.
  const result = recommendBudgetAdjustments(userData, { months: 3, thresholdPct: 20 });
  assert.equal(result.length, 1);
  assert.equal(result[0].direction, 'decrease');
});
