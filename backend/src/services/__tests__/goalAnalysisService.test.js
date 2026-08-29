const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeGoalCompletionForecast, computeRequiredMonthlyContribution } = require('../goalAnalysisService');

function monthDate(monthsAgo, day = 10) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo, day).toISOString().slice(0, 10);
}

test('computeGoalCompletionForecast projects a completion date from the trailing average pace', () => {
  const goal = { id: 'g1', name: 'Vacation', target: 12000, saved: 3000 };
  const userData = {
    goals: [goal],
    transactions: [
      { goalId: 'g1', amount: 1000, date: monthDate(0) },
      { goalId: 'g1', amount: 1000, date: monthDate(1) },
      { goalId: 'g1', amount: 1000, date: monthDate(2) },
    ],
  };
  const result = computeGoalCompletionForecast(userData, { months: 3 });
  assert.equal(result.length, 1);
  // avgMonthlyContribution = 1000, remaining = 9000 → 9 months to complete.
  assert.equal(result[0].avgMonthlyContribution, 1000);
  assert.equal(result[0].remaining, 9000);
  assert.equal(result[0].monthsToComplete, 9);
});

test('computeGoalCompletionForecast reports insufficientData when there is no contribution pace to project from', () => {
  const goal = { id: 'g1', name: 'Vacation', target: 12000, saved: 3000 };
  const userData = { goals: [goal], transactions: [] };
  const result = computeGoalCompletionForecast(userData);
  assert.deepEqual(result, [{ goalId: 'g1', goalName: 'Vacation', insufficientData: true }]);
});

test('computeGoalCompletionForecast skips goals that are already fully funded', () => {
  const userData = { goals: [{ id: 'g1', name: 'Done', target: 1000, saved: 1000 }], transactions: [] };
  assert.deepEqual(computeGoalCompletionForecast(userData), []);
});

test('computeRequiredMonthlyContribution flags a goal contributing less than its deadline needs', () => {
  const in90Days = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const userData = {
    goals: [{ id: 'g1', name: 'Emergency Fund', target: 10000, saved: 1000, deadline: in90Days, monthlyContribution: 500 }],
  };
  const result = computeRequiredMonthlyContribution(userData);
  assert.equal(result.length, 1);
  // remaining 9000 over ~3 months (90/30) needs ~3000/month, vs. 500
  // committed. A tolerance (not an exact 3000) because daysLeft depends on
  // the fractional time-of-day between "now" (deadline construction) and
  // whenever the assertion actually runs, same as production.
  assert.ok(Math.abs(result[0].requiredMonthlyContribution - 3000) < 100, `expected ~3000, got ${result[0].requiredMonthlyContribution}`);
  assert.equal(result[0].currentMonthlyContribution, 500);
  assert.equal(result[0].shortfall, result[0].requiredMonthlyContribution - 500);
});

test('computeRequiredMonthlyContribution says nothing when already contributing enough', () => {
  const in90Days = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const userData = {
    goals: [{ id: 'g1', name: 'Emergency Fund', target: 10000, saved: 1000, deadline: in90Days, monthlyContribution: 5000 }],
  };
  assert.deepEqual(computeRequiredMonthlyContribution(userData), []);
});

test('computeRequiredMonthlyContribution ignores goals with no deadline or already met', () => {
  const userData = {
    goals: [
      { id: 'g1', name: 'No deadline', target: 10000, saved: 1000, deadline: null, monthlyContribution: 0 },
      { id: 'g2', name: 'Already there', target: 10000, saved: 10000, deadline: '2099-01-01', monthlyContribution: 0 },
    ],
  };
  assert.deepEqual(computeRequiredMonthlyContribution(userData), []);
});
