const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkNotif, computeGeneratedRows, generateNotificationsFor } = require('../notificationEngine');

function baseUserData(overrides = {}) {
  return {
    bills: [],
    budgets: [],
    goals: [],
    categories: [],
    transactions: [],
    notifications: [],
    ...overrides,
  };
}

test('mkNotif builds a stable id from kind + sourceId when sourceId is provided', () => {
  const n = mkNotif('bill_soon', 'bill-123', 'warning', 'bill', 'Title', 'Body');
  assert.equal(n.id, 'gen_bill_soon_bill-123');
  assert.equal(n.type, 'bill');
  assert.equal(n.tone, 'warning');
  assert.equal(n.title, 'Title');
  assert.equal(n.body, 'Body');
  assert.ok(n.createdAt);
});

test('mkNotif builds a bare kind-only id when sourceId is falsy/empty', () => {
  const n = mkNotif('insight_inactive', '', 'info', 'insight', 'Title', 'Body');
  assert.equal(n.id, 'gen_insight_inactive');
});

test('computeGeneratedRows flags an overdue pending bill with danger tone', () => {
  const overdue = new Date();
  overdue.setDate(overdue.getDate() - 5);
  const userData = baseUserData({
    bills: [{ id: 'b1', name: 'Rent', status: 'pending', amount: 1000, dueDate: overdue.toISOString().slice(0, 10) }],
  });
  const rows = computeGeneratedRows(userData, [], []);
  const item = rows.find((r) => r.id === 'gen_bill_overdue_b1');
  assert.ok(item);
  assert.equal(item.tone, 'danger');
});

test('computeGeneratedRows flags a bill due within 5 days with warning tone', () => {
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);
  const userData = baseUserData({
    bills: [{ id: 'b1', name: 'Internet', status: 'pending', amount: 50, dueDate: soon.toISOString().slice(0, 10) }],
  });
  const rows = computeGeneratedRows(userData, [], []);
  const item = rows.find((r) => r.id === 'gen_bill_soon_b1');
  assert.ok(item);
  assert.equal(item.tone, 'warning');
});

test('computeGeneratedRows does not flag a paid bill or one due far in the future', () => {
  const farFuture = new Date();
  farFuture.setDate(farFuture.getDate() + 60);
  const userData = baseUserData({
    bills: [
      { id: 'b1', name: 'Paid', status: 'paid', amount: 50, dueDate: '2020-01-01' },
      { id: 'b2', name: 'Far off', status: 'pending', amount: 50, dueDate: farFuture.toISOString().slice(0, 10) },
    ],
  });
  const rows = computeGeneratedRows(userData, [], []);
  assert.ok(!rows.some((r) => r.id.startsWith('gen_bill_overdue')));
  assert.ok(!rows.some((r) => r.id.startsWith('gen_bill_soon')));
});

test('computeGeneratedRows flags a budget at/over its limit as budget_over (danger)', () => {
  const today = new Date().toISOString().slice(0, 10);
  const categories = [{ id: 'cat-1', name: 'Food', parentId: null }];
  const userData = baseUserData({
    categories,
    budgets: [{ id: 'budget-1', categoryId: 'cat-1', limit: 100, period: 'monthly' }],
    transactions: [{ type: 'expense', categoryId: 'cat-1', amount: -150, date: today }],
  });
  const rows = computeGeneratedRows(userData, [], []);
  const item = rows.find((r) => r.id === 'gen_budget_over_budget-1');
  assert.ok(item);
  assert.equal(item.tone, 'danger');
});

test('computeGeneratedRows flags a budget crossing its alert threshold (default 80%) as budget_alert (warning)', () => {
  const today = new Date().toISOString().slice(0, 10);
  const categories = [{ id: 'cat-1', name: 'Food', parentId: null }];
  const userData = baseUserData({
    categories,
    budgets: [{ id: 'budget-1', categoryId: 'cat-1', limit: 100, period: 'monthly' }],
    transactions: [{ type: 'expense', categoryId: 'cat-1', amount: -85, date: today }],
  });
  const rows = computeGeneratedRows(userData, [], []);
  const item = rows.find((r) => r.id === 'gen_budget_alert_budget-1');
  assert.ok(item);
  assert.equal(item.tone, 'warning');
});

test('computeGeneratedRows respects a custom alertAt threshold on the budget', () => {
  const today = new Date().toISOString().slice(0, 10);
  const categories = [{ id: 'cat-1', name: 'Food', parentId: null }];
  const userData = baseUserData({
    categories,
    budgets: [{ id: 'budget-1', categoryId: 'cat-1', limit: 100, period: 'monthly', alertAt: 50 }],
    transactions: [{ type: 'expense', categoryId: 'cat-1', amount: -60, date: today }],
  });
  const rows = computeGeneratedRows(userData, [], []);
  assert.ok(rows.some((r) => r.id === 'gen_budget_alert_budget-1'));
});

test('computeGeneratedRows flags a completed goal as goal_done (success)', () => {
  const userData = baseUserData({ goals: [{ id: 'goal-1', name: 'Vacation', target: 1000, saved: 1000 }] });
  const rows = computeGeneratedRows(userData, [], []);
  const item = rows.find((r) => r.id === 'gen_goal_done_goal-1');
  assert.ok(item);
  assert.equal(item.tone, 'success');
});

test('computeGeneratedRows flags a goal at 75%+ funded as goal_milestone_75, and 50%+ as goal_milestone_50', () => {
  const userData = baseUserData({
    goals: [
      { id: 'goal-1', name: 'Vacation', target: 1000, saved: 800 },
      { id: 'goal-2', name: 'Car', target: 1000, saved: 550 },
    ],
  });
  const rows = computeGeneratedRows(userData, [], []);
  assert.ok(rows.some((r) => r.id === 'gen_goal_milestone_75_goal-1'));
  assert.ok(rows.some((r) => r.id === 'gen_goal_milestone_50_goal-2'));
});

test('computeGeneratedRows surfaces insight_inactive when the last transaction is 7+ days old', () => {
  const old = new Date();
  old.setDate(old.getDate() - 10);
  const userData = baseUserData({
    transactions: [{ id: 't1', type: 'expense', amount: -10, date: old.toISOString().slice(0, 10) }],
  });
  const rows = computeGeneratedRows(userData, [], []);
  assert.ok(rows.some((r) => r.id === 'gen_insight_inactive'));
});

test('computeGeneratedRows does not surface insight_inactive when a transaction happened recently', () => {
  const recent = new Date().toISOString().slice(0, 10);
  const userData = baseUserData({
    transactions: [{ id: 't1', type: 'expense', amount: -10, date: recent }],
  });
  const rows = computeGeneratedRows(userData, [], []);
  assert.ok(!rows.some((r) => r.id === 'gen_insight_inactive'));
});

test('computeGeneratedRows surfaces credit_utilization_high when utilization crosses 40%, danger at 70%+', () => {
  const accounts = [{ id: 'cc-1', type: 'credit', balance: -8000, creditLimit: 10000 }];
  const rows = computeGeneratedRows(baseUserData(), accounts, []);
  const item = rows.find((r) => r.id === 'gen_credit_utilization_high');
  assert.ok(item);
  assert.equal(item.tone, 'danger');
});

test('computeGeneratedRows merges in feedback notifications for resolved/replied tickets', () => {
  const tickets = [{ id: 'tix-1', subject: 'Bug report', status: 'resolved' }];
  const rows = computeGeneratedRows(baseUserData(), [], tickets);
  assert.ok(rows.some((r) => r.id === 'gen_feedback_resolved_tix-1'));
});

test('computeGeneratedRows sorts items by tone urgency: danger, warning, success, info', () => {
  const overdue = new Date();
  overdue.setDate(overdue.getDate() - 1);
  const userData = baseUserData({
    goals: [{ id: 'goal-1', name: 'Vacation', target: 1000, saved: 1000 }], // success
    bills: [{ id: 'b1', name: 'Rent', status: 'pending', amount: 100, dueDate: overdue.toISOString().slice(0, 10) }], // danger
  });
  const rows = computeGeneratedRows(userData, [], []);
  const tones = rows.map((r) => r.tone);
  const toneRank = { danger: 0, warning: 1, success: 2, info: 3 };
  for (let i = 1; i < tones.length; i++) {
    assert.ok(toneRank[tones[i]] >= toneRank[tones[i - 1]], `expected sorted tone order, got ${tones.join(',')}`);
  }
});

test('computeGeneratedRows marks read/dismissed from the stored notifications overlay by id', () => {
  const overdue = new Date();
  overdue.setDate(overdue.getDate() - 1);
  const userData = baseUserData({
    bills: [{ id: 'b1', name: 'Rent', status: 'pending', amount: 100, dueDate: overdue.toISOString().slice(0, 10) }],
    notifications: [{ id: 'gen_bill_overdue_b1', read: true, dismissed: false }],
  });
  const rows = computeGeneratedRows(userData, [], []);
  const item = rows.find((r) => r.id === 'gen_bill_overdue_b1');
  assert.equal(item.read, true);
  assert.equal(item.dismissed, false);
});

test('generateNotificationsFor excludes dismissed notifications by default', () => {
  const overdue = new Date();
  overdue.setDate(overdue.getDate() - 1);
  const userData = baseUserData({
    bills: [{ id: 'b1', name: 'Rent', status: 'pending', amount: 100, dueDate: overdue.toISOString().slice(0, 10) }],
    notifications: [{ id: 'gen_bill_overdue_b1', read: false, dismissed: true }],
  });
  const result = generateNotificationsFor(userData, [], []);
  assert.ok(!result.some((r) => r.id === 'gen_bill_overdue_b1'));
});

test('generateNotificationsFor includes dismissed notifications when includeDismissed is true', () => {
  const overdue = new Date();
  overdue.setDate(overdue.getDate() - 1);
  const userData = baseUserData({
    bills: [{ id: 'b1', name: 'Rent', status: 'pending', amount: 100, dueDate: overdue.toISOString().slice(0, 10) }],
    notifications: [{ id: 'gen_bill_overdue_b1', read: false, dismissed: true }],
  });
  const result = generateNotificationsFor(userData, [], [], { includeDismissed: true });
  assert.ok(result.some((r) => r.id === 'gen_bill_overdue_b1'));
});

test('generateNotificationsFor includes legacy (non-generated, non-dismissed) stored notifications', () => {
  const userData = baseUserData({
    notifications: [{ id: 'legacy-1', type: 'custom', tone: 'info', title: 'Legacy', body: 'A legacy notification', dismissed: false }],
  });
  const result = generateNotificationsFor(userData, [], []);
  assert.ok(result.some((r) => r.id === 'legacy-1'));
});
