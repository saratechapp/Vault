const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeLowBalanceAlert } = require('../forecastService');
const { iso, addDaysFromToday } = require('../shared');

test('computeLowBalanceAlert flags a bill due before the 7-day projected balance can cover it', () => {
  const accounts = [{ id: 'a1', balance: 100 }];
  const userData = {
    transactions: [], // no spending history → flat forecast, balance stays ~100
    bills: [{ status: 'pending', dueDate: iso(addDaysFromToday(3)), amount: -500, type: 'expense' }],
  };
  const result = computeLowBalanceAlert(userData, accounts);
  assert.ok(result, 'expected a low-balance alert');
  const sevenDay = result.points.find((p) => p.days === 7);
  assert.equal(sevenDay.billsDue, 500);
  assert.equal(sevenDay.belowCommittedBills, true);
  assert.equal(sevenDay.belowZero, false); // balance itself never goes negative — only below committed bills
});

test('computeLowBalanceAlert returns null when balance comfortably covers everything due', () => {
  const accounts = [{ id: 'a1', balance: 100000 }];
  const userData = {
    transactions: [],
    bills: [{ status: 'pending', dueDate: iso(addDaysFromToday(3)), amount: -500, type: 'expense' }],
  };
  assert.equal(computeLowBalanceAlert(userData, accounts), null);
});

test('computeLowBalanceAlert flags a genuinely negative projected balance', () => {
  const accounts = [{ id: 'a1', balance: -50 }];
  const userData = { transactions: [], bills: [] };
  const result = computeLowBalanceAlert(userData, accounts);
  assert.ok(result);
  assert.ok(result.points.every((p) => p.belowZero));
});
