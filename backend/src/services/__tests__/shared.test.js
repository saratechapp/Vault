const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  iso,
  sortTransactionsRecentFirst,
  addDaysFromToday,
  round1,
  numOr,
  signAmount,
  categoryIdByName,
  isCategorizedSpend,
  startOfWeek,
  budgetWindow,
  budgetTransactionsInWindow,
  computeBudgetSpent,
  categorySpendForMonth,
} = require('../shared');

test('iso formats a Date as a YYYY-MM-DD string', () => {
  const d = new Date(Date.UTC(2026, 0, 15, 12, 30, 0));
  assert.equal(iso(d), '2026-01-15');
});

test('sortTransactionsRecentFirst orders by date descending', () => {
  const list = [
    { id: 'a', date: '2026-01-01' },
    { id: 'b', date: '2026-03-01' },
    { id: 'c', date: '2026-02-01' },
  ];
  const result = sortTransactionsRecentFirst(list);
  assert.deepEqual(result.map((t) => t.id), ['b', 'c', 'a']);
});

test('sortTransactionsRecentFirst breaks ties on equal dates by putting the later array entry first', () => {
  // The comparator's tiebreaker is `bi - ai` (original-index descending), so
  // among same-date entries the one that appeared later in the input array
  // sorts first — verify that documented behavior explicitly.
  const list = [
    { id: 'first', date: '2026-01-01' },
    { id: 'second', date: '2026-01-01' },
    { id: 'third', date: '2026-01-01' },
  ];
  const result = sortTransactionsRecentFirst(list);
  assert.deepEqual(result.map((t) => t.id), ['third', 'second', 'first']);
});

test('addDaysFromToday returns a Date offset from now by n days', () => {
  const before = new Date();
  const result = addDaysFromToday(5);
  const diffDays = Math.round((result - before) / 86400000);
  assert.equal(diffDays, 5);
});

test('addDaysFromToday supports negative offsets (days in the past)', () => {
  const before = new Date();
  const result = addDaysFromToday(-3);
  const diffDays = Math.round((result - before) / 86400000);
  assert.equal(diffDays, -3);
});

test('round1 rounds to one decimal place', () => {
  assert.equal(round1(1.234), 1.2);
  assert.equal(round1(1.25), 1.3);
  assert.equal(round1(1.05), 1.1);
  assert.equal(round1(-1.25), -1.2);
});

test('numOr coerces a numeric-looking value and falls back to 0 by default', () => {
  assert.equal(numOr('42'), 42);
  assert.equal(numOr(42), 42);
  assert.equal(numOr(undefined), 0);
  assert.equal(numOr(null), 0);
  assert.equal(numOr(''), 0);
  assert.equal(numOr('not-a-number'), 0);
});

test('numOr uses a custom fallback when provided', () => {
  assert.equal(numOr(undefined, 99), 99);
  assert.equal(numOr('bad', 99), 99);
});

test('signAmount stores expenses as negative', () => {
  assert.equal(signAmount('expense', 100), -100);
  assert.equal(signAmount('expense', -100), -100);
});

test('signAmount stores income as positive', () => {
  assert.equal(signAmount('income', 100), 100);
  assert.equal(signAmount('income', -100), 100);
});

test('signAmount stores transfers as positive', () => {
  assert.equal(signAmount('transfer', 100), 100);
  assert.equal(signAmount('transfer', -100), 100);
});

test('categoryIdByName resolves an id by exact category name', () => {
  const categories = [{ id: 'cat-1', name: 'Transfer' }, { id: 'cat-2', name: 'Subscriptions' }];
  assert.equal(categoryIdByName(categories, 'Transfer'), 'cat-1');
  assert.equal(categoryIdByName(categories, 'Subscriptions'), 'cat-2');
});

test('categoryIdByName returns null when no category matches', () => {
  const categories = [{ id: 'cat-1', name: 'Transfer' }];
  assert.equal(categoryIdByName(categories, 'Nonexistent'), null);
});

test('startOfWeek returns the Monday of the given date\'s week, at midnight', () => {
  // Wednesday, 2026-01-14 (a known midweek date).
  const wed = new Date(2026, 0, 14, 15, 30, 0);
  const start = startOfWeek(wed);
  assert.equal(start.getDay(), 1); // Monday
  assert.equal(start.getFullYear(), 2026);
  assert.equal(start.getMonth(), 0);
  assert.equal(start.getDate(), 12);
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(start.getSeconds(), 0);
});

test('startOfWeek treats Sunday as the end of the week (rolls back to the preceding Monday)', () => {
  // Sunday, 2026-01-18.
  const sun = new Date(2026, 0, 18, 8, 0, 0);
  const start = startOfWeek(sun);
  assert.equal(start.getDay(), 1);
  assert.equal(start.getDate(), 12);
});

test('startOfWeek is a no-op (same day, midnight) when given a Monday', () => {
  const mon = new Date(2026, 0, 12, 9, 0, 0);
  const start = startOfWeek(mon);
  assert.equal(start.getDate(), 12);
  assert.equal(start.getHours(), 0);
});

test('budgetWindow custom branch uses the budget\'s own startDate/endDate', () => {
  const budget = { period: 'custom', startDate: '2026-01-01', endDate: '2026-01-31' };
  const { start, end } = budgetWindow(budget);
  assert.equal(iso(start), '2026-01-01');
  assert.equal(iso(end), '2026-01-31');
});

test('budgetWindow custom branch without an endDate runs through "now"', () => {
  const budget = { period: 'custom', startDate: '2026-01-01' };
  const before = new Date();
  const { start, end } = budgetWindow(budget);
  assert.equal(iso(start), '2026-01-01');
  assert.ok(end <= new Date() && end >= before - 1000);
});

test('budgetWindow weekly branch spans Monday through Sunday (end-of-day) of the current week', () => {
  const budget = { period: 'weekly' };
  const { start, end } = budgetWindow(budget);
  assert.equal(start.getDay(), 1);
  assert.equal(end.getDay(), 0); // Sunday
  // Calendar-day span (ignoring end's end-of-day time) is 6 days, Mon..Sun.
  const diffCalendarDays = Math.round((new Date(end.getFullYear(), end.getMonth(), end.getDate()) - start) / 86400000);
  assert.equal(diffCalendarDays, 6);
  assert.equal(end.getHours(), 23);
  assert.equal(end.getMinutes(), 59);
  assert.equal(end.getSeconds(), 59);
});

test('budgetWindow yearly branch spans Jan 1 through Dec 31 of the current year', () => {
  const budget = { period: 'yearly' };
  const now = new Date();
  const { start, end } = budgetWindow(budget);
  assert.equal(start.getFullYear(), now.getFullYear());
  assert.equal(start.getMonth(), 0);
  assert.equal(start.getDate(), 1);
  assert.equal(end.getFullYear(), now.getFullYear());
  assert.equal(end.getMonth(), 11);
  assert.equal(end.getDate(), 31);
});

test('budgetWindow monthly branch (default) spans the first through last day of the current month', () => {
  const budget = { period: 'monthly' };
  const now = new Date();
  const { start, end } = budgetWindow(budget);
  assert.equal(start.getFullYear(), now.getFullYear());
  assert.equal(start.getMonth(), now.getMonth());
  assert.equal(start.getDate(), 1);
  assert.equal(end.getMonth(), now.getMonth());
  const expectedLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  assert.equal(end.getDate(), expectedLastDay);
});

test('budgetWindow falls back to monthly for an unrecognized/missing period', () => {
  const budget = {};
  const now = new Date();
  const { start } = budgetWindow(budget);
  assert.equal(start.getMonth(), now.getMonth());
  assert.equal(start.getDate(), 1);
});

test('budgetTransactionsInWindow includes only expense transactions in-window for the budget\'s category', () => {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 10);
  const categories = [{ id: 'cat-1', name: 'Food', parentId: null }];
  const budget = { id: 'budget-1', categoryId: 'cat-1', period: 'monthly' };
  const transactions = [
    { id: 't1', type: 'expense', categoryId: 'cat-1', amount: -100, date: thisMonth },
    { id: 't2', type: 'income', categoryId: 'cat-1', amount: 100, date: thisMonth },
    { id: 't3', type: 'expense', categoryId: 'other-cat', amount: -50, date: thisMonth },
  ];
  const result = budgetTransactionsInWindow(budget, transactions, categories);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 't1');
});

test('budgetTransactionsInWindow rolls up a sub-category\'s transactions into the parent budget', () => {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 10);
  const categories = [
    { id: 'parent', name: 'Food', parentId: null },
    { id: 'child', name: 'Groceries', parentId: 'parent' },
  ];
  const budget = { id: 'budget-1', categoryId: 'parent', period: 'monthly' };
  const transactions = [
    { id: 't1', type: 'expense', categoryId: 'child', amount: -75, date: thisMonth },
  ];
  const result = budgetTransactionsInWindow(budget, transactions, categories);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 't1');
});

test('budgetTransactionsInWindow excludes transactions outside the window', () => {
  const categories = [{ id: 'cat-1', name: 'Food', parentId: null }];
  const budget = { id: 'budget-1', categoryId: 'cat-1', period: 'monthly' };
  const now = new Date();
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 10).toISOString().slice(0, 10);
  const transactions = [
    { id: 't1', type: 'expense', categoryId: 'cat-1', amount: -100, date: twoMonthsAgo },
  ];
  const result = budgetTransactionsInWindow(budget, transactions, categories);
  assert.equal(result.length, 0);
});

test('budgetTransactionsInWindow includes an in-window transfer categorized for this budget, not one left as the generic "Transfer" category', () => {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString().slice(0, 10);
  const categories = [
    { id: 'insurance', name: 'Insurance', parentId: null },
    { id: 'transfer-cat', name: 'Transfer', parentId: null },
  ];
  const budget = { id: 'budget-1', categoryId: 'insurance', period: 'monthly' };
  const transactions = [
    { id: 't1', type: 'transfer', categoryId: 'insurance', amount: 4000, date: thisMonth, fromAccountId: 'a', toAccountId: 'b' },
    { id: 't2', type: 'transfer', categoryId: 'transfer-cat', amount: 500, date: thisMonth, fromAccountId: 'a', toAccountId: 'c' },
  ];
  const result = budgetTransactionsInWindow(budget, transactions, categories);
  assert.deepEqual(result.map((t) => t.id), ['t1']);
});

test('computeBudgetSpent sums the absolute value of in-window expense transactions', () => {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 10);
  const categories = [{ id: 'cat-1', name: 'Food', parentId: null }];
  const budget = { id: 'budget-1', categoryId: 'cat-1', period: 'monthly' };
  const transactions = [
    { id: 't1', type: 'expense', categoryId: 'cat-1', amount: -100, date: thisMonth },
    { id: 't2', type: 'expense', categoryId: 'cat-1', amount: -50, date: thisMonth },
  ];
  assert.equal(computeBudgetSpent(budget, transactions, categories), 150);
});

test('computeBudgetSpent returns 0 when there is no matching spend', () => {
  const categories = [{ id: 'cat-1', name: 'Food', parentId: null }];
  const budget = { id: 'budget-1', categoryId: 'cat-1', period: 'monthly' };
  assert.equal(computeBudgetSpent(budget, [], categories), 0);
});

test('categorySpendForMonth totals expenses by top-level category for the given year/month, rolling up sub-categories', () => {
  const categories = [
    { id: 'parent', name: 'Food', parentId: null },
    { id: 'child', name: 'Groceries', parentId: 'parent' },
    { id: 'other', name: 'Rent', parentId: null },
  ];
  const transactions = [
    { type: 'expense', categoryId: 'parent', amount: -20, date: '2026-03-05' },
    { type: 'expense', categoryId: 'child', amount: -30, date: '2026-03-10' },
    { type: 'expense', categoryId: 'other', amount: -100, date: '2026-03-15' },
    { type: 'income', categoryId: 'parent', amount: 500, date: '2026-03-15' }, // not expense: ignored
    { type: 'expense', categoryId: 'parent', amount: -999, date: '2026-04-01' }, // different month: ignored
  ];
  const map = categorySpendForMonth(transactions, categories, 2026, 2); // March = month index 2
  assert.equal(map.get('parent'), 50);
  assert.equal(map.get('other'), 100);
  assert.equal(map.has('child'), false);
});

test('categorySpendForMonth returns an empty map when nothing falls in the given month', () => {
  const categories = [{ id: 'cat-1', name: 'Food', parentId: null }];
  const transactions = [{ type: 'expense', categoryId: 'cat-1', amount: -20, date: '2026-01-05' }];
  const map = categorySpendForMonth(transactions, categories, 2026, 5);
  assert.equal(map.size, 0);
});

test('isCategorizedSpend counts a plain expense regardless of category', () => {
  assert.equal(isCategorizedSpend({ type: 'expense', categoryId: null }, 'transfer-cat'), true);
  assert.equal(isCategorizedSpend({ type: 'expense', categoryId: 'food' }, 'transfer-cat'), true);
});

test('isCategorizedSpend counts a transfer only when it carries a category other than the generic "Transfer" one', () => {
  assert.equal(isCategorizedSpend({ type: 'transfer', categoryId: 'health-insurance' }, 'transfer-cat'), true);
  assert.equal(isCategorizedSpend({ type: 'transfer', categoryId: 'transfer-cat' }, 'transfer-cat'), false);
  assert.equal(isCategorizedSpend({ type: 'transfer', categoryId: null }, 'transfer-cat'), false);
});

test('isCategorizedSpend excludes income', () => {
  assert.equal(isCategorizedSpend({ type: 'income', categoryId: 'salary' }, 'transfer-cat'), false);
});

test('categorySpendForMonth includes a transfer-type bill payment tagged with a real category, but not one left as a plain "Transfer"', () => {
  const categories = [
    { id: 'insurance', name: 'Insurance', parentId: null },
    { id: 'transfer-cat', name: 'Transfer', parentId: null },
  ];
  const transactions = [
    { type: 'transfer', categoryId: 'insurance', amount: 4000, date: '2026-08-08', fromAccountId: 'a', toAccountId: 'b' },
    { type: 'transfer', categoryId: 'transfer-cat', amount: 500, date: '2026-08-08', fromAccountId: 'a', toAccountId: 'c' },
  ];
  const map = categorySpendForMonth(transactions, categories, 2026, 7); // August = month index 7
  assert.equal(map.get('insurance'), 4000);
  assert.equal(map.has('transfer-cat'), false);
});
