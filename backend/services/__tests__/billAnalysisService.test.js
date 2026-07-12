const { test } = require('node:test');
const assert = require('node:assert/strict');
const { upcomingBills, computeBillPaymentHistory } = require('../billAnalysisService');
const { iso, addDaysFromToday } = require('../shared');

function userDataWithBills(bills) {
  return { bills };
}

test('upcomingBills only returns pending bills due within the window, sorted soonest-first', () => {
  const userData = userDataWithBills([
    { id: 'b1', name: 'Overdue rent', status: 'pending', dueDate: iso(addDaysFromToday(-2)), amount: -1000, type: 'expense' },
    { id: 'b2', name: 'Due in 5 days', status: 'pending', dueDate: iso(addDaysFromToday(5)), amount: -200, type: 'expense' },
    { id: 'b3', name: 'Due in 20 days', status: 'pending', dueDate: iso(addDaysFromToday(20)), amount: -50, type: 'expense' },
    { id: 'b4', name: 'Out of window', status: 'pending', dueDate: iso(addDaysFromToday(40)), amount: -999, type: 'expense' },
    { id: 'b5', name: 'Already paid', status: 'paid', dueDate: iso(addDaysFromToday(3)), amount: -75, type: 'expense' },
  ]);
  const result = upcomingBills(userData, { days: 30 });
  assert.deepEqual(result.map((b) => b.id), ['b2', 'b3']);
  assert.equal(result[0].amount, 200); // amounts come back as absolute values
});

test('computeBillPaymentHistory reports insufficientData below the minimum payment count', () => {
  const userData = {
    billPayments: [
      { paidDate: iso(addDaysFromToday(-1)), wasLate: false },
      { paidDate: iso(addDaysFromToday(-10)), wasLate: true },
    ],
  };
  assert.deepEqual(computeBillPaymentHistory(userData, { minPayments: 3 }), { insufficientData: true });
});

test('computeBillPaymentHistory computes on-time rate once enough history exists', () => {
  const userData = {
    billPayments: [
      { paidDate: iso(addDaysFromToday(-1)), wasLate: false },
      { paidDate: iso(addDaysFromToday(-10)), wasLate: false },
      { paidDate: iso(addDaysFromToday(-20)), wasLate: true },
      { paidDate: iso(addDaysFromToday(-200)), wasLate: true }, // outside the 6-month window — excluded
    ],
  };
  const result = computeBillPaymentHistory(userData, { months: 6, minPayments: 3 });
  assert.deepEqual(result, { totalPayments: 3, onTimeCount: 2, lateCount: 1, onTimeRate: 66.7 });
});
