const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildNetWorthTrend } = require('../src/services/metricsService');

function monthsAgo(n, day = 15) {
  const d = new Date();
  d.setMonth(d.getMonth() - n, day);
  return d.toISOString();
}

test('buildNetWorthTrend reconstructs assets from the account ledger as of each month-end cutoff', () => {
  const userData = {
    accounts: [{ id: 'acc-1', openingBalance: 1000 }],
    debts: [],
    transactions: [
      { type: 'income', accountId: 'acc-1', amount: 500, date: monthsAgo(2) },
      { type: 'expense', accountId: 'acc-1', amount: -200, date: monthsAgo(1) },
      { type: 'income', accountId: 'acc-1', amount: 300, date: monthsAgo(0) },
    ],
  };

  const trend = buildNetWorthTrend(userData, 3);
  assert.equal(trend.length, 3);
  // Oldest bucket (2 months ago): only the +500 income has landed.
  assert.equal(trend[0].assets, 1500);
  // Middle bucket (1 month ago): +500 income, -200 expense.
  assert.equal(trend[1].assets, 1300);
  // Most recent bucket (this month): all three transactions applied.
  assert.equal(trend[2].assets, 1600);
  assert.equal(trend[2].netWorth, trend[2].assets);
});

test('buildNetWorthTrend reconstructs liabilities backward from debt-payment transactions', () => {
  const userData = {
    accounts: [],
    debts: [{ id: 'debt-1', balance: 800 }],
    transactions: [
      // Two payments already applied to reach the current balance of 800.
      { type: 'expense', sourceDebtId: 'debt-1', amount: -100, date: monthsAgo(1) },
      { type: 'expense', sourceDebtId: 'debt-1', amount: -100, date: monthsAgo(0) },
    ],
  };

  const trend = buildNetWorthTrend(userData, 3);
  // Oldest bucket: neither payment had happened yet, so the debt was still 800 + 100 + 100.
  assert.equal(trend[0].liabilities, 1000);
  // Middle bucket: the 1-month-ago payment has happened, the most recent one hasn't.
  assert.equal(trend[1].liabilities, 900);
  // Most recent bucket: both payments applied, matches the live balance.
  assert.equal(trend[2].liabilities, 800);
  assert.equal(trend[2].netWorth, -800);
});

test('buildNetWorthTrend defaults to 12 months and handles no accounts/debts', () => {
  const trend = buildNetWorthTrend({ accounts: [], debts: [], transactions: [] });
  assert.equal(trend.length, 12);
  trend.forEach((b) => {
    assert.equal(b.assets, 0);
    assert.equal(b.liabilities, 0);
    assert.equal(b.netWorth, 0);
    assert.ok(typeof b.month === 'string' && b.month.length > 0);
  });
});
