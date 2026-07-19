const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeLedger,
  computeAccounts,
  computeCategories,
  buildSpendingTrend,
  buildTagTrend,
  buildCategorySpend,
  buildMetrics,
} = require('../metricsService');

test('computeLedger sums inflow/outflow and derives balance from opening + inflow - outflow', () => {
  const transactions = [
    { id: 't1', date: '2026-01-01', amount: 100 },
    { id: 't2', date: '2026-01-02', amount: -40 },
  ];
  const result = computeLedger(transactions, 500, (t) => t.amount);
  assert.equal(result.inflow, 100);
  assert.equal(result.outflow, 40);
  assert.equal(result.balance, 560);
  assert.equal(result.txnCount, 2);
});

test('computeLedger ignores transactions where contributionFn returns null/undefined', () => {
  const transactions = [
    { id: 't1', date: '2026-01-01', amount: 100 },
    { id: 't2', date: '2026-01-02', amount: -40 },
  ];
  const result = computeLedger(transactions, 0, (t) => (t.id === 't1' ? t.amount : null));
  assert.equal(result.txnCount, 1);
  assert.equal(result.balance, 100);
});

test('computeLedger tracks the most recent applicable transaction for previousBalance/lastTransactionAmount', () => {
  const transactions = [
    { id: 't1', date: '2026-01-01', amount: 100 },
    { id: 't2', date: '2026-01-10', amount: -40 },
  ];
  const result = computeLedger(transactions, 0, (t) => t.amount);
  assert.equal(result.lastTransactionAmount, -40);
  assert.equal(result.lastTransactionDate, '2026-01-10');
  assert.equal(result.previousBalance, result.balance - (-40));
});

test('computeLedger with no applicable transactions returns opening balance and null last-transaction fields', () => {
  const result = computeLedger([], 250, () => null);
  assert.equal(result.balance, 250);
  assert.equal(result.txnCount, 0);
  assert.equal(result.lastTransactionAmount, 0);
  assert.equal(result.lastTransactionDate, null);
  assert.equal(result.previousBalance, 250);
});

test('computeAccounts computes a direct (non-transfer) account balance from its own transactions', () => {
  const userData = {
    accounts: [{ id: 'acc-1', name: 'Checking', openingBalance: 1000 }],
    transactions: [
      { id: 't1', type: 'income', accountId: 'acc-1', amount: 200, date: '2026-01-05' },
      { id: 't2', type: 'expense', accountId: 'acc-1', amount: -50, date: '2026-01-06' },
    ],
  };
  const [acc] = computeAccounts(userData);
  assert.equal(acc.balance, 1150);
  assert.equal(acc.inflow, 200);
  assert.equal(acc.outflow, 50);
});

test('computeAccounts treats a transfer out as a negative contribution and transfer in as positive', () => {
  const userData = {
    accounts: [
      { id: 'acc-1', name: 'Checking', openingBalance: 1000 },
      { id: 'acc-2', name: 'Savings', openingBalance: 0 },
    ],
    transactions: [
      { id: 't1', type: 'transfer', fromAccountId: 'acc-1', toAccountId: 'acc-2', amount: 300, date: '2026-01-05' },
    ],
  };
  const [checking, savings] = computeAccounts(userData);
  assert.equal(checking.balance, 700);
  assert.equal(savings.balance, 300);
});

test('computeAccounts monthNet reflects only this calendar month\'s net movement', () => {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 5).toISOString().slice(0, 10);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 5).toISOString().slice(0, 10);
  const userData = {
    accounts: [{ id: 'acc-1', name: 'Checking', openingBalance: 0 }],
    transactions: [
      { id: 't1', type: 'income', accountId: 'acc-1', amount: 200, date: thisMonth },
      { id: 't2', type: 'income', accountId: 'acc-1', amount: 999, date: lastMonth },
    ],
  };
  const [acc] = computeAccounts(userData);
  assert.equal(acc.monthNet, 200);
});

test('computeCategories rolls up a sub-category\'s spend into its parent, using absolute amounts', () => {
  const userData = {
    categories: [
      { id: 'parent', name: 'Food', parentId: null },
      { id: 'child', name: 'Groceries', parentId: 'parent' },
    ],
    transactions: [
      { categoryId: 'parent', amount: -20, date: '2026-01-01' },
      { categoryId: 'child', amount: -30, date: '2026-01-02' },
    ],
  };
  const [parent, child] = computeCategories(userData);
  assert.equal(parent.balance, 50);
  assert.equal(child.balance, 30);
});

test('computeCategories counts both income and expense transactions toward the category total (magnitude only)', () => {
  const userData = {
    categories: [{ id: 'cat-1', name: 'Salary', parentId: null }],
    transactions: [
      { categoryId: 'cat-1', amount: 1000, date: '2026-01-01' },
      { categoryId: 'cat-1', amount: -50, date: '2026-01-02' },
    ],
  };
  const [cat] = computeCategories(userData);
  assert.equal(cat.balance, 1050);
});

test('buildSpendingTrend buckets income/expense by month and tags savings/investment-labeled transactions', () => {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString().slice(0, 10);
  const transactions = [
    { type: 'income', amount: 1000, date: thisMonth, labels: [] },
    { type: 'expense', amount: -200, date: thisMonth, labels: [] },
    { type: 'income', amount: 500, date: thisMonth, labels: ['savings'] },
  ];
  const trend = buildSpendingTrend(transactions, 3, []);
  assert.equal(trend.length, 3);
  const curr = trend[trend.length - 1];
  assert.equal(curr.income, 1500);
  assert.equal(curr.expense, 200);
  assert.equal(curr.savings, 500);
});

test('buildSpendingTrend counts a transfer into a savings-type account as savings, and out of one as negative savings', () => {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString().slice(0, 10);
  const accounts = [{ id: 'sav-1', type: 'savings' }, { id: 'chk-1', type: 'checking' }];
  const transactions = [
    { type: 'transfer', amount: 300, fromAccountId: 'chk-1', toAccountId: 'sav-1', date: thisMonth, labels: [] },
  ];
  const trend = buildSpendingTrend(transactions, 1, accounts);
  assert.equal(trend[0].savings, 300);
});

test('buildSpendingTrend ignores transactions outside the requested month window', () => {
  const now = new Date();
  const farBack = new Date(now.getFullYear(), now.getMonth() - 10, 10).toISOString().slice(0, 10);
  const transactions = [{ type: 'income', amount: 1000, date: farBack, labels: [] }];
  const trend = buildSpendingTrend(transactions, 2, []);
  const total = trend.reduce((s, b) => s + b.income, 0);
  assert.equal(total, 0);
});

test('buildTagTrend sums transaction amounts under whichever quick-tag labels are present, per month', () => {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString().slice(0, 10);
  const transactions = [
    { amount: -100, date: thisMonth, labels: ['Expenditure'] },
    { amount: 200, date: thisMonth, labels: ['Income'] },
    { amount: -50, date: thisMonth, labels: ['Protection', 'Investment'] },
    { amount: -10, date: thisMonth, labels: ['NotATag'] },
  ];
  const trend = buildTagTrend(transactions, 1);
  const curr = trend[0];
  assert.equal(curr.expenditure, 100);
  assert.equal(curr.income, 200);
  assert.equal(curr.protection, 50);
  assert.equal(curr.investment, 50);
});

test('buildCategorySpend rolls sub-category expenses up to the top-level category for the current month only', () => {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString().slice(0, 10);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 10).toISOString().slice(0, 10);
  const categories = [
    { id: 'parent', name: 'Food', parentId: null },
    { id: 'child', name: 'Groceries', parentId: 'parent' },
  ];
  const transactions = [
    { type: 'expense', categoryId: 'parent', amount: -20, date: thisMonth },
    { type: 'expense', categoryId: 'child', amount: -30, date: thisMonth },
    { type: 'expense', categoryId: 'parent', amount: -999, date: lastMonth },
    { type: 'income', categoryId: 'parent', amount: 500, date: thisMonth },
  ];
  const result = buildCategorySpend(transactions, categories);
  assert.equal(result.length, 1);
  assert.equal(result[0].categoryId, 'parent');
  assert.equal(result[0].amount, 50);
});

test('buildCategorySpend buckets transactions with no resolvable category under a synthetic "Other" (null) bucket', () => {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString().slice(0, 10);
  const transactions = [{ type: 'expense', categoryId: 'deleted-cat', amount: -15, date: thisMonth }];
  const result = buildCategorySpend(transactions, []);
  assert.equal(result.length, 1);
  assert.equal(result[0].categoryId, null);
  assert.equal(result[0].amount, 15);
});

test('buildCategorySpend sorts results by amount descending', () => {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString().slice(0, 10);
  const categories = [{ id: 'small', name: 'Small', parentId: null }, { id: 'big', name: 'Big', parentId: null }];
  const transactions = [
    { type: 'expense', categoryId: 'small', amount: -10, date: thisMonth },
    { type: 'expense', categoryId: 'big', amount: -100, date: thisMonth },
  ];
  const result = buildCategorySpend(transactions, categories);
  assert.deepEqual(result.map((r) => r.categoryId), ['big', 'small']);
});

test('buildMetrics computes savingsRate, deltas vs. the prior month, and netWorth from accounts minus debts', () => {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString().slice(0, 10);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 10).toISOString().slice(0, 10);
  const userData = {
    transactions: [
      { type: 'income', amount: 1000, date: thisMonth, labels: [] },
      { type: 'expense', amount: -400, date: thisMonth, labels: [] },
      { type: 'income', amount: 500, date: lastMonth, labels: [] },
      { type: 'expense', amount: -500, date: lastMonth, labels: [] },
    ],
    debts: [{ balance: 200 }],
  };
  const accounts = [{ balance: 1000 }, { balance: 500 }];
  const metrics = buildMetrics(userData, accounts);
  assert.equal(metrics.monthlyIncome, 1000);
  assert.equal(metrics.monthlyExpense, 400);
  assert.equal(metrics.savingsRate, 60);
  assert.equal(metrics.monthlyIncomeDelta, 100); // 1000 vs 500 prior = +100%
  assert.equal(metrics.monthlyExpenseDelta, -20); // 400 vs 500 prior = -20%
  assert.equal(metrics.totalBalance, 1500);
  assert.equal(metrics.netWorth, 1300);
});

test('buildMetrics reports 0% savingsRate and 0 deltas when there is no income this month', () => {
  const userData = { transactions: [], debts: [] };
  const metrics = buildMetrics(userData, []);
  assert.equal(metrics.savingsRate, 0);
  assert.equal(metrics.monthlyIncomeDelta, 0);
  assert.equal(metrics.monthlyExpenseDelta, 0);
  assert.equal(metrics.netWorth, 0);
});
