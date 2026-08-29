const { computeBudgetSpent, sortTransactionsRecentFirst } = require('./shared');
const { computeDuplicateAlerts, computeRecurringPatterns } = require('./spendingAnalysisService');
const { computeCreditUtilization } = require('./healthScoreEngine');

function mkNotif(kind, sourceId, tone, type, title, body) {
  const id = sourceId ? `gen_${kind}_${sourceId}` : `gen_${kind}`;
  return { id, type, tone, title, body, createdAt: new Date().toISOString() };
}
// Feedback lives outside the db.js/fetchAll entity pattern (it's managed via
// adminDb, cross-user by design), so the caller passes in just the small
// bits needed here rather than this module reaching into adminDb itself.
// `tickets`: [{ id, subject, status, userLastReadAt, latestMessage: { senderType, createdAt } | null }]
function computeFeedbackNotifications(tickets) {
  const items = [];
  (tickets || []).forEach((t) => {
    if (t.status === 'resolved') {
      items.push({ ...mkNotif('feedback_resolved', t.id, 'success', 'feedback', 'Issue resolved — review the fix', `"${t.subject}" has been marked resolved. Let us know if everything looks right.`), feedbackId: t.id });
      return;
    }
    const lm = t.latestMessage;
    if (lm && lm.senderType === 'admin' && (!t.userLastReadAt || new Date(lm.createdAt) > new Date(t.userLastReadAt))) {
      items.push({ ...mkNotif('feedback_reply', t.id, 'info', 'feedback', `Support replied to "${t.subject}"`, 'Open the conversation to see the reply.'), feedbackId: t.id });
    }
  });
  return items;
}
// Admin-side counterpart, surfaced in the admin topbar's notification bell
// rather than merged into the consumer computeGeneratedRows pipeline — there's
// no per-admin notification_overlay to merge against (see adminLastReadAt,
// a single shared column, not a per-admin table), so this stays a plain
// function the admin notifications route calls directly.
//
// Uniformly read-gated: a ticket's "most recent event" (its latest visible
// message, or its own creation if nobody's replied yet) has to be newer than
// adminLastReadAt, *and* not itself authored by an admin (so replying to
// your own ticket doesn't re-notify you). Opening the ticket always clears
// it — simpler mental model than singling out "new"/"reopened" as
// permanently-visible action-needed banners.
// `tickets`: [{ id, subject, status, priority, createdAt, adminLastReadAt, latestMessage: { senderType, createdAt } | null }]
function computeAdminFeedbackNotifications(tickets) {
  const items = [];
  (tickets || []).forEach((t) => {
    const lm = t.latestMessage;
    const eventTime = lm ? lm.createdAt : t.createdAt;
    // A status-change system message (e.g. "Status changed to testing.")
    // carries adminSenderId when *staff* triggered it and userSenderId when
    // the *user* did (confirm/reopen) — only the latter should notify.
    const isAdminAuthored = lm ? (lm.senderType === 'admin' || (lm.senderType === 'system' && !!lm.adminSenderId)) : false;
    if (isAdminAuthored) return;
    if (t.adminLastReadAt && new Date(eventTime) <= new Date(t.adminLastReadAt)) return;

    if (t.status === 'reopened') {
      items.push({ ...mkNotif('admin_feedback_reopened', t.id, 'danger', 'feedback', `"${t.subject}" was reopened`, 'The user says the issue is still occurring.'), feedbackId: t.id });
    } else if (!lm) {
      items.push({ ...mkNotif('admin_feedback_new', t.id, t.priority === 'urgent' ? 'danger' : 'warning', 'feedback', `New feedback: "${t.subject}"`, 'No one has replied yet.'), feedbackId: t.id });
    } else {
      items.push({ ...mkNotif('admin_feedback_reply', t.id, 'info', 'feedback', `New reply on "${t.subject}"`, 'Open the ticket to see what they said.'), feedbackId: t.id });
    }
  });
  return items;
}
function computeGeneratedRows(userData, accounts, feedbackTickets) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items = [];
  (userData.bills || []).forEach((bill) => {
    if (bill.status !== 'pending') return;
    const due = new Date(bill.dueDate);
    const diffDays = Math.round((due - today) / 86400000);
    if (diffDays < 0) {
      items.push(mkNotif('bill_overdue', bill.id, 'danger', 'bill', `${bill.name} is overdue`, `${bill.amount.toFixed(2)} was due ${Math.abs(diffDays)} day(s) ago.`));
    } else if (diffDays <= 5) {
      const title = diffDays === 0 ? `${bill.name} is due today` : `${bill.name} due in ${diffDays} day(s)`;
      items.push(mkNotif('bill_soon', bill.id, 'warning', 'bill', title, `${bill.amount.toFixed(2)} on ${bill.dueDate}.`));
    }
  });
  (userData.budgets || []).forEach((budget) => {
    const spent = computeBudgetSpent(budget, userData.transactions, userData.categories);
    const cat = userData.categories.find((c) => c.id === budget.categoryId);
    const name = cat ? cat.name : 'Budget';
    if (spent >= budget.limit) {
      items.push(mkNotif('budget_over', budget.id, 'danger', 'budget', `Over budget: ${name}`, `You've spent ${spent.toFixed(2)} of your ${budget.limit.toFixed(2)} ${budget.period} budget.`));
    } else if (budget.limit > 0 && (spent / budget.limit) * 100 >= (budget.alertAt || 80)) {
      items.push(mkNotif('budget_alert', budget.id, 'warning', 'budget', `Budget alert: ${name}`, `You've used ${Math.round((spent / budget.limit) * 100)}% of your ${budget.limit.toFixed(2)} ${budget.period} budget.`));
    }
  });
  (userData.goals || []).forEach((goal) => {
    const pct = goal.target > 0 ? (goal.saved / goal.target) * 100 : 0;
    if (goal.saved >= goal.target) {
      items.push(mkNotif('goal_done', goal.id, 'success', 'goal', `Goal reached: ${goal.name}`, `You've saved the full ${goal.target}. Time to celebrate!`));
    } else if (pct >= 75) {
      items.push(mkNotif('goal_milestone_75', goal.id, 'success', 'goal', `${goal.name} is 75% funded`, `You've saved ${Math.round(goal.saved)} of ${goal.target} so far.`));
    } else if (pct >= 50) {
      items.push(mkNotif('goal_milestone_50', goal.id, 'info', 'goal', `${goal.name} is halfway there`, `You've saved ${Math.round(goal.saved)} of ${goal.target} so far.`));
    }
  });
  const latestTxn = sortTransactionsRecentFirst(userData.transactions || [])[0];
  if (latestTxn) {
    const days = Math.round((today - new Date(latestTxn.date)) / 86400000);
    if (days >= 7) {
      items.push(mkNotif('insight_inactive', '', 'info', 'insight', 'Log your recent expenses', `It's been ${days} days since your last transaction. Keeping your log current helps reports stay accurate.`));
    }
  }
  // New: duplicate transactions surfaced in the notification bell/list, not
  // just the dashboard's daily-summary card (computeDailySummary already
  // showed these, but /api/notifications never did).
  const duplicates = computeDuplicateAlerts(userData.transactions || []);
  if (duplicates.length) {
    const first = duplicates[0];
    items.push(mkNotif(
      'duplicate_detected', first.id, 'warning', 'insight',
      duplicates.length === 1 ? 'Possible duplicate transaction' : `${duplicates.length} possible duplicate transactions`,
      `${first.vendor} for ${first.amount.toFixed(2)} appears twice within a few days.`
    ));
  }
  // New: a recurring/subscription payment whose latest amount moved
  // noticeably from its own trailing average.
  computeRecurringPatterns(userData.transactions || [], userData.categories || [])
    .filter((p) => p.isSubscription && p.priceChange)
    .forEach((p) => {
      const direction = p.priceChange.changePct > 0 ? 'increased' : 'decreased';
      items.push(mkNotif(
        'subscription_price_change', `${p.vendor}_${p.lastDate}`, 'info', 'insight',
        `${p.vendor} price ${direction}`,
        `${p.vendor} changed from ${p.priceChange.from.toFixed ? p.priceChange.from.toFixed(2) : p.priceChange.from} to ${p.priceChange.to.toFixed ? p.priceChange.to.toFixed(2) : p.priceChange.to}.`
      ));
    });
  // New: credit utilization crossing a concerning threshold — reuses
  // HealthScoreEngine's own computeCreditUtilization so this can't drift
  // out of sync with the health-score factor it mirrors.
  const utilization = accounts ? computeCreditUtilization(accounts) : null;
  if (utilization && utilization.utilizationPct >= 40) {
    items.push(mkNotif(
      'credit_utilization_high', '', utilization.utilizationPct >= 70 ? 'danger' : 'warning', 'insight',
      'Credit utilization is high',
      `You're using ${Math.round(utilization.utilizationPct)}% of your total credit limit.`
    ));
  }
  items.push(...computeFeedbackNotifications(feedbackTickets));
  const toneRank = { danger: 0, warning: 1, success: 2, info: 3 };
  items.sort((a, b) => toneRank[a.tone] - toneRank[b.tone]);
  const overlay = new Map((userData.notifications || []).map((n) => [n.id, n]));
  return items.map((n) => {
    const stored = overlay.get(n.id);
    return { ...n, read: !!stored?.read, dismissed: !!stored?.dismissed };
  });
}
function generateNotificationsFor(userData, accounts, feedbackTickets, { includeDismissed = false } = {}) {
  const generated = computeGeneratedRows(userData, accounts, feedbackTickets);
  const legacy = (userData.notifications || []).filter((n) => !n.id.startsWith('gen_') && !n.dismissed);
  const all = [...generated, ...legacy];
  return includeDismissed ? all : all.filter((n) => !n.dismissed);
}

module.exports = {
  mkNotif,
  computeFeedbackNotifications,
  computeAdminFeedbackNotifications,
  computeGeneratedRows,
  generateNotificationsFor,
};
