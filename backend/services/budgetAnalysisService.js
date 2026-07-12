const { budgetWindow, computeBudgetSpent, categorySpendForMonth, round1 } = require('./shared');

// Pace-based budget warning, distinct from the threshold alert already in
// generateNotificationsFor: this projects "at today's rate, where will you
// land by period end" so a budget that's fine today but on track to blow
// through gets flagged *before* it actually goes over (the doc's "warn me
// before exceeding my budget"). Budgets already at/over their limit are
// left to the existing over-budget notification instead of being repeated
// here.
function computeBudgetPredictions(userData) {
  const now = new Date();
  const predictions = [];
  userData.budgets.forEach((b) => {
    if (!(b.limit > 0)) return;
    const { start, end } = budgetWindow(b);
    const spent = computeBudgetSpent(b, userData.transactions, userData.categories);
    if (spent >= b.limit) return;
    const totalMs = end - start;
    const elapsedMs = Math.min(Math.max(now - start, 0), totalMs);
    const elapsedFraction = totalMs > 0 ? elapsedMs / totalMs : 1;
    if (elapsedFraction < 0.15) return; // too early in the period to project reliably
    const projected = spent / elapsedFraction;
    if (projected <= b.limit * 1.05) return; // on pace, nothing to warn about
    const cat = userData.categories.find((c) => c.id === b.categoryId);
    predictions.push({
      budgetId: b.id,
      categoryId: b.categoryId,
      categoryName: cat?.name || 'Budget',
      limit: b.limit,
      spent: Math.round(spent),
      projected: Math.round(projected),
      period: b.period,
    });
  });
  return predictions.sort((a, b) => b.projected / b.limit - a.projected / a.limit);
}

// Same category-matching rule budgetTransactionsInWindow uses (self +
// immediate sub-categories), but against an explicit window instead of the
// budget's *current* period — needed to look back at past periods.
function spentInWindow(budget, transactions, categories, start, end) {
  const catIds = new Set([budget.categoryId, ...categories.filter((c) => c.parentId === budget.categoryId).map((c) => c.id)]);
  return transactions
    .filter((t) => t.type === 'expense' && catIds.has(t.categoryId))
    .filter((t) => {
      const d = new Date(t.date);
      return d >= start && d <= end;
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

// The window N whole periods before the budget's *current* period — mirrors
// budgetWindow()'s own period math, just offset. Only meaningful for
// recurring periods (monthly/weekly/yearly): a 'custom' budget has a single
// fixed date range, not a repeating cadence, so there's no "previous period"
// to look back at.
function shiftedBudgetWindow(budget, periodsAgo) {
  if (budget.period === 'custom') return null;
  const now = new Date();
  if (budget.period === 'weekly') {
    const { start: currentStart } = budgetWindow(budget);
    const start = new Date(currentStart);
    start.setDate(start.getDate() - periodsAgo * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (budget.period === 'yearly') {
    const year = now.getFullYear() - periodsAgo;
    return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59) };
  }
  const monthIndex = now.getMonth() - periodsAgo;
  return { start: new Date(now.getFullYear(), monthIndex, 1), end: new Date(now.getFullYear(), monthIndex + 1, 0, 23, 59, 59) };
}

// Flags budgets that have gone essentially untouched for several periods
// running — worth surfacing distinctly from "on pace"/"over budget": money
// reserved for a category nobody's spending in could be reallocated
// elsewhere. Only evaluated for recurring periods (see shiftedBudgetWindow)
// and only once there are enough *complete* past periods to judge from, so a
// budget created last week isn't immediately flagged as unused.
function computeUnusedBudgets(userData, { periods = 3, thresholdPct = 5 } = {}) {
  const unused = [];
  userData.budgets.forEach((b) => {
    if (!(b.limit > 0) || b.period === 'custom') return;
    const pctUsedByPeriod = [];
    for (let i = 1; i <= periods; i++) {
      const window = shiftedBudgetWindow(b, i);
      if (!window) return;
      const spent = spentInWindow(b, userData.transactions, userData.categories, window.start, window.end);
      pctUsedByPeriod.push((spent / b.limit) * 100);
    }
    if (pctUsedByPeriod.every((pct) => pct <= thresholdPct)) {
      const cat = userData.categories.find((c) => c.id === b.categoryId);
      unused.push({
        budgetId: b.id,
        categoryId: b.categoryId,
        categoryName: cat?.name || 'Budget',
        limit: b.limit,
        period: b.period,
        periodsChecked: periods,
        avgPctUsed: round1(pctUsedByPeriod.reduce((s, v) => s + v, 0) / pctUsedByPeriod.length),
      });
    }
  });
  return unused;
}

// Trailing-3-month average actual spend per budgeted category, compared
// against the budget's own limit — a limit set once at budget-creation time
// can drift out of sync with how the category actually gets used. Only
// suggests a change when the gap is large enough to be worth acting on
// (>= thresholdPct in either direction), and always as a suggestion the user
// applies themselves (PATCH /api/budgets/:id), never an automatic change.
function recommendBudgetAdjustments(userData, { months = 3, thresholdPct = 20 } = {}) {
  const now = new Date();
  const topLevelIdOf = new Map(userData.categories.map((c) => [c.id, c.parentId || c.id]));
  const recommendations = [];
  userData.budgets.forEach((b) => {
    if (!(b.limit > 0)) return;
    const targetTopId = topLevelIdOf.get(b.categoryId) || b.categoryId;
    let total = 0;
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthMap = categorySpendForMonth(userData.transactions, userData.categories, d.getFullYear(), d.getMonth());
      total += monthMap.get(targetTopId) || 0;
    }
    const avgSpend = total / months;
    const deltaPct = ((avgSpend - b.limit) / b.limit) * 100;
    if (Math.abs(deltaPct) < thresholdPct) return;
    const cat = userData.categories.find((c) => c.id === b.categoryId);
    recommendations.push({
      budgetId: b.id,
      categoryId: b.categoryId,
      categoryName: cat?.name || 'Budget',
      currentLimit: b.limit,
      avgSpend: Math.round(avgSpend),
      suggestedLimit: Math.round(avgSpend / 100) * 100,
      direction: avgSpend > b.limit ? 'increase' : 'decrease',
    });
  });
  return recommendations.sort((a, b) => Math.abs(b.avgSpend - b.currentLimit) - Math.abs(a.avgSpend - a.currentLimit));
}

module.exports = {
  computeBudgetPredictions,
  computeUnusedBudgets,
  recommendBudgetAdjustments,
};
