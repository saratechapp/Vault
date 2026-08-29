const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildRecommendations } = require('../recommendationEngine');

test('buildRecommendations returns an empty list when given no inputs', () => {
  assert.deepEqual(buildRecommendations(), []);
  assert.deepEqual(buildRecommendations({}), []);
});

test('buildRecommendations maps a health-score budget factor\'s improve object to a budget recommendation', () => {
  const health = {
    breakdown: [
      { name: 'budgetAdherence', improve: { type: 'budget', categoryName: 'Food', pctUsed: 95 } },
    ],
  };
  const result = buildRecommendations({ health });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'improve_budget_budgetAdherence');
  assert.match(result[0].title, /Food/);
});

test('buildRecommendations skips a health factor whose improve.type is "none" or unrecognized', () => {
  const health = { breakdown: [{ name: 'x', improve: { type: 'none' } }, { name: 'y', improve: null }] };
  assert.deepEqual(buildRecommendations({ health }), []);
});

test('buildRecommendations includes at most the first 2 budgetPredictions, each as a budget_pace recommendation', () => {
  const budgetPredictions = [
    { budgetId: 'b1', categoryName: 'Food', projected: 1200, limit: 1000 },
    { budgetId: 'b2', categoryName: 'Fuel', projected: 1300, limit: 1000 },
    { budgetId: 'b3', categoryName: 'Fun', projected: 1400, limit: 1000 },
  ];
  const result = buildRecommendations({ budgetPredictions });
  const paceRecs = result.filter((r) => r.id.startsWith('budget_pace_'));
  assert.equal(paceRecs.length, 2);
  assert.deepEqual(paceRecs.map((r) => r.id), ['budget_pace_b1', 'budget_pace_b2']);
});

test('buildRecommendations includes at most the first 2 unusedBudgets recommendations', () => {
  const unusedBudgets = [
    { budgetId: 'b1', categoryName: 'Food', avgPctUsed: 5, periodsChecked: 3 },
    { budgetId: 'b2', categoryName: 'Fuel', avgPctUsed: 2, periodsChecked: 3 },
    { budgetId: 'b3', categoryName: 'Fun', avgPctUsed: 1, periodsChecked: 3 },
  ];
  const result = buildRecommendations({ unusedBudgets });
  assert.equal(result.filter((r) => r.id.startsWith('unused_budget_')).length, 2);
});

test('buildRecommendations only turns positive-pct spendingInsights into spending_increase recommendations, capped at 2', () => {
  const spendingInsights = [
    { categoryId: 'c1', categoryName: 'Food', pct: 20, prev: 100, curr: 120 },
    { categoryId: 'c2', categoryName: 'Fuel', pct: -20, prev: 100, curr: 80 }, // decrease: excluded
    { categoryId: 'c3', categoryName: 'Fun', pct: 30, prev: 100, curr: 130 },
    { categoryId: 'c4', categoryName: 'Travel', pct: 40, prev: 100, curr: 140 },
  ];
  const result = buildRecommendations({ spendingInsights });
  const increases = result.filter((r) => r.id.startsWith('spending_increase_'));
  assert.equal(increases.length, 2);
  assert.ok(!result.some((r) => r.id === 'spending_increase_c2'));
});

test('buildRecommendations includes at most 1 large-expense recommendation', () => {
  const largeExpenses = [
    { transactionId: 't1', vendor: 'Store A', amount: 5000, date: '2026-01-01' },
    { transactionId: 't2', vendor: 'Store B', amount: 6000, date: '2026-01-02' },
  ];
  const result = buildRecommendations({ largeExpenses });
  assert.equal(result.filter((r) => r.id.startsWith('large_expense_')).length, 1);
  assert.equal(result[0].id, 'large_expense_t1');
});

test('buildRecommendations includes a low_balance_alert recommendation when lowBalanceAlert is truthy', () => {
  const lowBalanceAlert = { worstPoint: { days: 10, projected: -200, billsDue: 500 } };
  const result = buildRecommendations({ lowBalanceAlert });
  const item = result.find((r) => r.id === 'low_balance_alert');
  assert.ok(item);
  assert.match(item.body, /10-day/);
});

test('buildRecommendations omits low_balance_alert when lowBalanceAlert is null', () => {
  const result = buildRecommendations({ lowBalanceAlert: null });
  assert.ok(!result.some((r) => r.id === 'low_balance_alert'));
});

test('buildRecommendations includes at most the first 2 goalForecasts recommendations', () => {
  const goalForecasts = [
    { goalId: 'g1', goalName: 'Vacation', shortfall: 100, deadline: '2026-12-01' },
    { goalId: 'g2', goalName: 'Car', shortfall: 200, deadline: '2026-12-01' },
    { goalId: 'g3', goalName: 'House', shortfall: 300, deadline: '2026-12-01' },
  ];
  const result = buildRecommendations({ goalForecasts });
  assert.equal(result.filter((r) => r.id.startsWith('goal_contribution_')).length, 2);
});

test('buildRecommendations includes a smart_savings recommendation only when smartSavings has data', () => {
  const withData = buildRecommendations({ smartSavings: { amount: 500, sourceAccountId: 'a1', targetAccountId: 'a2' } });
  assert.ok(withData.some((r) => r.id === 'smart_savings'));
  const insufficient = buildRecommendations({ smartSavings: { insufficientData: true } });
  assert.ok(!insufficient.some((r) => r.id === 'smart_savings'));
  const none = buildRecommendations({ smartSavings: null });
  assert.ok(!none.some((r) => r.id === 'smart_savings'));
});

test('buildRecommendations sorts by priority ascending and caps the final list at 8', () => {
  const health = { breakdown: [{ name: 'credit', improve: { type: 'credit_utilization', suggestedPaydown: 100 } }] }; // priority 1
  const smartSavings = { amount: 500, sourceAccountId: 'a1', targetAccountId: 'a2' }; // priority 5
  const goalForecasts = Array.from({ length: 2 }, (_, i) => ({ goalId: `g${i}`, goalName: `Goal ${i}`, shortfall: 10, deadline: '2026-01-01' })); // priority 3
  const budgetPredictions = Array.from({ length: 2 }, (_, i) => ({ budgetId: `b${i}`, categoryName: `Cat ${i}`, projected: 100, limit: 90 })); // priority 1
  const unusedBudgets = Array.from({ length: 2 }, (_, i) => ({ budgetId: `u${i}`, categoryName: `Cat ${i}`, avgPctUsed: 1, periodsChecked: 3 })); // priority 4
  const largeExpenses = [{ transactionId: 't1', vendor: 'Store', amount: 100, date: '2026-01-01' }]; // priority 4
  const result = buildRecommendations({ health, smartSavings, goalForecasts, budgetPredictions, unusedBudgets, largeExpenses });
  assert.ok(result.length <= 8);
  for (let i = 1; i < result.length; i++) {
    assert.ok(result[i].priority >= result[i - 1].priority, 'expected ascending priority order');
  }
});
