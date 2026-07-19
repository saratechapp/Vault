const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeDailySummary, computeMonthlyAIReport, computeWeeklySummary } = require('../financialInsightsService');

function baseUserData(overrides = {}) {
  return {
    transactions: [],
    budgets: [],
    categories: [],
    bills: [],
    goals: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeDailySummary
// ---------------------------------------------------------------------------

test('computeDailySummary always includes an available_balance item first, net of this month\'s pending bills', () => {
  const today = new Date();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const userData = baseUserData({
    bills: [{ id: 'b1', name: 'Rent', status: 'pending', type: 'expense', amount: -1000, dueDate: endOfMonth.toISOString().slice(0, 10) }],
  });
  const accounts = [{ id: 'acc-1', type: 'bank', balance: 5000 }];
  const items = computeDailySummary(userData, accounts, {}, null, [], [], []);
  assert.equal(items[0].id, 'available_balance');
  assert.equal(items[0].amount, 4000);
  assert.equal(items[0].citation.billsCount, 1);
});

test('computeDailySummary excludes credit accounts from the available balance', () => {
  const userData = baseUserData();
  const accounts = [{ id: 'acc-1', type: 'bank', balance: 1000 }, { id: 'acc-2', type: 'credit', balance: 5000 }];
  const items = computeDailySummary(userData, accounts, {}, null, [], [], []);
  assert.equal(items[0].amount, 1000);
});

test('computeDailySummary flags overdue bills with danger tone, ahead of due-soon bills', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = new Date(today);
  overdue.setDate(overdue.getDate() - 3);
  const dueSoon = new Date(today);
  dueSoon.setDate(dueSoon.getDate() + 1);
  const userData = baseUserData({
    bills: [
      { id: 'b1', name: 'Overdue Bill', status: 'pending', type: 'expense', amount: -200, dueDate: overdue.toISOString().slice(0, 10) },
      { id: 'b2', name: 'Due Soon Bill', status: 'pending', type: 'expense', amount: -100, dueDate: dueSoon.toISOString().slice(0, 10) },
    ],
  });
  const accounts = [{ id: 'acc-1', type: 'bank', balance: 5000 }];
  const items = computeDailySummary(userData, accounts, {}, null, [], [], []);
  const overdueItem = items.find((i) => i.id === 'bill_overdue');
  assert.ok(overdueItem, 'expected a bill_overdue item');
  assert.equal(overdueItem.tone, 'danger');
  assert.equal(overdueItem.count, 1);
  assert.ok(!items.some((i) => i.id === 'bill_due'), 'overdue should take priority over due-soon');
});

test('computeDailySummary flags a budget that has crossed 75% usage as budget_hot, with danger tone at/over 100%', () => {
  const today = new Date().toISOString().slice(0, 10);
  const categories = [{ id: 'cat-1', name: 'Food', parentId: null }];
  const userData = baseUserData({
    categories,
    budgets: [{ id: 'budget-1', categoryId: 'cat-1', limit: 100, period: 'monthly' }],
    transactions: [{ id: 't1', type: 'expense', categoryId: 'cat-1', amount: -120, date: today, vendor: 'Store' }],
  });
  const accounts = [{ id: 'acc-1', type: 'bank', balance: 5000 }];
  const items = computeDailySummary(userData, accounts, {}, null, [], [], []);
  const hot = items.find((i) => i.id === 'budget_hot');
  assert.ok(hot);
  assert.equal(hot.tone, 'danger');
  assert.equal(hot.categoryName, 'Food');
});

test('computeDailySummary surfaces a spend_trend item only when the month-over-month delta is at least 5%', () => {
  const userData = baseUserData();
  const accounts = [{ id: 'acc-1', type: 'bank', balance: 1000 }];
  const noTrend = computeDailySummary(userData, accounts, { monthlyExpenseDelta: 2 }, null, [], [], []);
  assert.ok(!noTrend.some((i) => i.id === 'spend_trend'));
  const withTrend = computeDailySummary(userData, accounts, { monthlyExpenseDelta: 20, monthlyExpense: 500 }, null, [], [], []);
  const trendItem = withTrend.find((i) => i.id === 'spend_trend');
  assert.ok(trendItem);
  assert.equal(trendItem.direction, 'more');
  assert.equal(trendItem.pct, 20);
});

test('computeDailySummary surfaces smart_savings_insufficient_data when smartSavings flags it', () => {
  const userData = baseUserData();
  const accounts = [{ id: 'acc-1', type: 'bank', balance: 1000 }];
  const items = computeDailySummary(userData, accounts, {}, { insufficientData: true }, [], [], []);
  assert.ok(items.some((i) => i.id === 'smart_savings_insufficient_data'));
});

test('computeDailySummary surfaces a smart_savings item with a prefill_transfer action when source/target accounts are known', () => {
  const userData = baseUserData();
  const accounts = [{ id: 'acc-1', type: 'bank', balance: 1000 }];
  const smartSavings = { amount: 300, citation: {}, sourceAccountId: 'acc-1', targetAccountId: 'acc-2' };
  const items = computeDailySummary(userData, accounts, {}, smartSavings, [], [], []);
  const item = items.find((i) => i.id === 'smart_savings');
  assert.ok(item);
  assert.equal(item.action.kind, 'prefill_transfer');
  assert.equal(item.action.prefill.amount, 300);
});

test('computeDailySummary reports unusual_duplicates when duplicates are present, ahead of a plain anomaly', () => {
  const userData = baseUserData();
  const accounts = [{ id: 'acc-1', type: 'bank', balance: 1000 }];
  const duplicates = [{ id: 'dup1', vendor: 'Store', amount: 50 }];
  const anomalies = [{ transactionId: 't1', vendor: 'Big', amount: 5000, multiple: 5, date: '2026-01-01', medianAmount: 1000 }];
  const items = computeDailySummary(userData, accounts, {}, null, [], duplicates, anomalies);
  assert.ok(items.some((i) => i.id === 'unusual_duplicates'));
  assert.ok(!items.some((i) => i.id === 'unusual_transaction'));
});

test('computeDailySummary falls back to no_unusual when nothing else warrants a danger/warning item', () => {
  const userData = baseUserData();
  const accounts = [{ id: 'acc-1', type: 'bank', balance: 1000 }];
  const items = computeDailySummary(userData, accounts, {}, null, [], [], []);
  assert.ok(items.some((i) => i.id === 'no_unusual'));
});

test('computeDailySummary caps the result at 6 items', () => {
  const today = new Date().toISOString().slice(0, 10);
  const categories = [{ id: 'cat-1', name: 'Food', parentId: null }];
  const userData = baseUserData({
    categories,
    budgets: [{ id: 'budget-1', categoryId: 'cat-1', limit: 100, period: 'monthly' }],
    transactions: [{ id: 't1', type: 'expense', categoryId: 'cat-1', amount: -120, date: today, vendor: 'Store' }],
    bills: [{ id: 'b1', name: 'Overdue', status: 'pending', type: 'expense', amount: -50, dueDate: '2020-01-01' }],
  });
  const accounts = [{ id: 'acc-1', type: 'bank', balance: 1000 }];
  const smartSavings = { amount: 300, citation: {} };
  const duplicates = [{ id: 'dup1', vendor: 'Store', amount: 50 }];
  const items = computeDailySummary(userData, accounts, { monthlyExpenseDelta: 20, monthlyExpense: 500 }, smartSavings, [], duplicates, []);
  assert.ok(items.length <= 6);
});

// ---------------------------------------------------------------------------
// computeMonthlyAIReport
// ---------------------------------------------------------------------------

test('computeMonthlyAIReport computes income/expense/savings/savingsRate for the requested month', () => {
  const categories = [{ id: 'cat-1', name: 'Salary', parentId: null }, { id: 'cat-2', name: 'Food', parentId: null }];
  const userData = baseUserData({
    categories,
    transactions: [
      { type: 'income', categoryId: 'cat-1', amount: 1000, date: '2026-03-05' },
      { type: 'expense', categoryId: 'cat-2', amount: -400, date: '2026-03-10' },
      { type: 'expense', categoryId: 'cat-2', amount: -999, date: '2026-04-01' }, // different month, excluded
    ],
  });
  const report = computeMonthlyAIReport(userData, [], 2026, 2); // March
  assert.equal(report.month, '2026-03');
  assert.equal(report.income, 1000);
  assert.equal(report.expense, 400);
  assert.equal(report.savings, 600);
  assert.equal(report.savingsRate, 60);
  assert.equal(report.largestCategory.categoryName, 'Food');
  assert.equal(report.largestCategory.amount, 400);
});

test('computeMonthlyAIReport reports savingsRate 0 when there was no income that month', () => {
  const userData = baseUserData();
  const report = computeMonthlyAIReport(userData, [], 2026, 2);
  assert.equal(report.income, 0);
  assert.equal(report.savingsRate, 0);
  assert.equal(report.largestCategory, null);
});

test('computeMonthlyAIReport lists a budget that stayed under its limit as an under_budget achievement', () => {
  const categories = [{ id: 'cat-1', name: 'Food', parentId: null }];
  const userData = baseUserData({
    categories,
    budgets: [{ id: 'budget-1', categoryId: 'cat-1', limit: 1000, period: 'monthly' }],
    transactions: [{ type: 'expense', categoryId: 'cat-1', amount: -100, date: new Date().toISOString().slice(0, 10) }],
  });
  const report = computeMonthlyAIReport(userData, [], new Date().getFullYear(), new Date().getMonth());
  const achievement = report.achievements.find((a) => a.type === 'under_budget');
  assert.ok(achievement);
  assert.equal(achievement.categoryName, 'Food');
  assert.equal(achievement.spent, 100);
});

test('computeMonthlyAIReport includes a smart_savings recommendation when there is surplus liquid cash and no committed budgets/bills concerns', () => {
  const userData = baseUserData({
    bills: [{ id: 'b1', name: 'Rent', status: 'pending', type: 'expense', amount: -100, dueDate: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10) }],
  });
  const accounts = [{ id: 'acc-1', type: 'bank', balance: 10000 }];
  const report = computeMonthlyAIReport(userData, accounts, new Date().getFullYear(), new Date().getMonth());
  assert.ok(report.recommendations.some((r) => r.type === 'smart_savings'));
});

test('computeMonthlyAIReport caps achievements and recommendations at 5 entries each', () => {
  const categories = Array.from({ length: 8 }, (_, i) => ({ id: `cat-${i}`, name: `Cat ${i}`, parentId: null }));
  const budgets = categories.map((c, i) => ({ id: `budget-${i}`, categoryId: c.id, limit: 1000, period: 'monthly' }));
  const userData = baseUserData({ categories, budgets, transactions: [] });
  const report = computeMonthlyAIReport(userData, [], new Date().getFullYear(), new Date().getMonth());
  assert.ok(report.achievements.length <= 5);
  assert.ok(report.recommendations.length <= 5);
});

// ---------------------------------------------------------------------------
// computeWeeklySummary
// ---------------------------------------------------------------------------

test('computeWeeklySummary always includes a week_spend_trend item comparing this week to last week', () => {
  const userData = baseUserData();
  const items = computeWeeklySummary(userData, []);
  const trend = items.find((i) => i.id === 'week_spend_trend');
  assert.ok(trend);
  assert.equal(trend.thisWeekExpense, 0);
  assert.equal(trend.lastWeekExpense, 0);
});

test('computeWeeklySummary reports positive tone when this week\'s spend is down vs. last week', () => {
  const now = new Date();
  const day = now.getDay();
  const mondayOfThisWeek = new Date(now);
  mondayOfThisWeek.setHours(0, 0, 0, 0);
  mondayOfThisWeek.setDate(mondayOfThisWeek.getDate() + ((day === 0 ? -6 : 1) - day));
  const lastWeekTxnDate = new Date(mondayOfThisWeek);
  lastWeekTxnDate.setDate(lastWeekTxnDate.getDate() - 3); // squarely inside last week
  const userData = baseUserData({
    transactions: [{ type: 'expense', amount: -500, date: lastWeekTxnDate.toISOString().slice(0, 10) }],
  });
  const items = computeWeeklySummary(userData, []);
  const trend = items.find((i) => i.id === 'week_spend_trend');
  assert.equal(trend.thisWeekExpense, 0);
  assert.equal(trend.lastWeekExpense, 500);
  assert.equal(trend.tone, 'positive');
});

test('computeWeeklySummary surfaces week_bills_due for bills due in the next 7 days', () => {
  const dueSoon = new Date();
  dueSoon.setDate(dueSoon.getDate() + 2);
  const userData = baseUserData({
    bills: [{ id: 'b1', name: 'Internet', status: 'pending', amount: -50, dueDate: dueSoon.toISOString().slice(0, 10), type: 'expense' }],
  });
  const items = computeWeeklySummary(userData, []);
  const billsItem = items.find((i) => i.id === 'week_bills_due');
  assert.ok(billsItem);
  assert.equal(billsItem.count, 1);
  assert.equal(billsItem.totalAmount, 50);
});

test('computeWeeklySummary surfaces week_largest_expense for the biggest expense so far this week', () => {
  const now = new Date();
  const userData = baseUserData({
    transactions: [{ id: 't1', vendor: 'Big Store', type: 'expense', amount: -777, date: now.toISOString().slice(0, 10) }],
  });
  const items = computeWeeklySummary(userData, []);
  const largest = items.find((i) => i.id === 'week_largest_expense');
  assert.ok(largest);
  assert.equal(largest.amount, 777);
  assert.equal(largest.vendor, 'Big Store');
});

test('computeWeeklySummary caps the result at 6 items', () => {
  const items = computeWeeklySummary(baseUserData(), []);
  assert.ok(items.length <= 6);
});
