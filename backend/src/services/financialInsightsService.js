const { iso, round1, startOfWeek, budgetTransactionsInWindow, computeBudgetSpent, categorySpendForMonth } = require('./shared');
const { computeSpendingInsights, largestRecentExpense } = require('./spendingAnalysisService');
const { computeBudgetPredictions } = require('./budgetAnalysisService');
const { computeSmartSavings } = require('./forecastService');
const { upcomingBills } = require('./billAnalysisService');

// Assembles the "what matters today" list for the dashboard — a handful of
// plain-data items (never more than 6, matching the doc's example length),
// ranked by urgency: overdue/due-soon money events first, then budget
// pressure, then trend context, then an actionable suggestion, then a
// closing "anything unusual?" line. Every item carries a `citation` (the raw
// numbers/transactions behind the claim) and an `action` (what the user can
// do about it) — no line is a black box. Amounts are left as raw numbers
// rather than pre-formatted strings so the frontend renders currency with
// the user's own formatCurrency()/locale preferences.
function computeDailySummary(userData, accounts, metrics, smartSavings, patterns, duplicates, anomalies) {
  const items = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const liquidAccounts = accounts.filter((a) => a.type !== 'credit');
  const rawAvailable = liquidAccounts.reduce((s, a) => s + Math.max(0, a.balance), 0);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
  const billsThisMonth = (userData.bills || [])
    .filter((b) => b.status === 'pending' && b.type !== 'transfer')
    .filter((b) => new Date(b.dueDate) <= endOfMonth)
    .map((b) => ({ id: b.id, name: b.name, amount: Math.abs(b.amount), dueDate: b.dueDate }))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const billsThisMonthTotal = billsThisMonth.reduce((s, b) => s + b.amount, 0);
  items.push({
    id: 'available_balance', tone: 'info', type: 'available_balance', amount: Math.round(rawAvailable - billsThisMonthTotal),
    citation: {
      rawAvailable: Math.round(rawAvailable), billsTotal: Math.round(billsThisMonthTotal),
      bills: billsThisMonth.slice(0, 5), billsCount: billsThisMonth.length,
      accounts: liquidAccounts.map((a) => ({ name: a.name, balance: Math.round(a.balance) })),
    },
    action: { kind: 'link', label: 'View bills', to: '/app/bills' },
  });

  const overdueBills = (userData.bills || []).filter((b) => b.status === 'pending' && new Date(b.dueDate) < today);
  const dueSoonBill = [...(userData.bills || [])]
    .filter((b) => b.status === 'pending')
    .map((b) => ({ ...b, diff: Math.round((new Date(b.dueDate) - today) / 86400000) }))
    .filter((b) => b.diff >= 0 && b.diff <= 3)
    .sort((a, b) => a.diff - b.diff)[0];
  const soonSubscription = patterns.find((p) => p.isSubscription && p.daysUntil >= 0 && p.daysUntil <= 3);

  if (overdueBills.length) {
    items.push({
      id: 'bill_overdue', tone: 'danger', type: 'bill_overdue', count: overdueBills.length,
      citation: { bills: overdueBills.map((b) => ({ id: b.id, name: b.name, amount: Math.abs(b.amount), dueDate: b.dueDate })) },
      action: { kind: 'link', label: 'View bills', to: '/app/bills' },
    });
  } else if (dueSoonBill) {
    items.push({
      id: 'bill_due', tone: 'warning', type: 'bill_due', name: dueSoonBill.name, days: dueSoonBill.diff, amount: Math.abs(dueSoonBill.amount),
      citation: { billId: dueSoonBill.id, dueDate: dueSoonBill.dueDate, frequency: dueSoonBill.frequency },
      action: { kind: 'link', label: 'View bills', to: '/app/bills' },
    });
  } else if (soonSubscription) {
    items.push({
      id: 'subscription_renewal', tone: 'warning', type: 'subscription_renewal', name: soonSubscription.vendor, days: soonSubscription.daysUntil, amount: soonSubscription.avgAmount,
      citation: { occurrences: soonSubscription.occurrences, lastDate: soonSubscription.lastDate, nextExpectedDate: soonSubscription.nextExpectedDate },
      action: { kind: 'link', label: 'View transactions', to: '/app/transactions' },
    });
  }

  let worstBudget = null;
  userData.budgets.forEach((b) => {
    if (!(b.limit > 0)) return;
    const spent = computeBudgetSpent(b, userData.transactions, userData.categories);
    const pct = (spent / b.limit) * 100;
    if (!worstBudget || pct > worstBudget.pct) {
      const cat = userData.categories.find((c) => c.id === b.categoryId);
      worstBudget = { pct, spent, limit: b.limit, categoryName: cat?.name || 'Budget', budget: b };
    }
  });
  if (worstBudget && worstBudget.pct >= 75) {
    const topTxns = budgetTransactionsInWindow(worstBudget.budget, userData.transactions, userData.categories)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 5)
      .map((t) => ({ id: t.id, vendor: t.vendor, amount: Math.abs(t.amount), date: t.date }));
    items.push({
      id: 'budget_hot', tone: worstBudget.pct >= 100 ? 'danger' : 'warning', type: 'budget_hot',
      categoryName: worstBudget.categoryName, pct: Math.round(worstBudget.pct),
      citation: { spent: Math.round(worstBudget.spent), limit: worstBudget.limit, transactions: topTxns },
      action: { kind: 'link', label: 'Review category', to: '/app/budgets' },
    });
  }

  if (metrics.monthlyExpenseDelta && Math.abs(metrics.monthlyExpenseDelta) >= 5) {
    items.push({
      id: 'spend_trend', tone: metrics.monthlyExpenseDelta < 0 ? 'positive' : 'info', type: 'spend_vs_last_month',
      pct: Math.abs(Math.round(metrics.monthlyExpenseDelta)), direction: metrics.monthlyExpenseDelta < 0 ? 'less' : 'more',
      citation: { thisMonth: Math.round(metrics.monthlyExpense) },
      action: { kind: 'link', label: 'View report', to: '/app/reports' },
    });
  }

  if (smartSavings && smartSavings.insufficientData) {
    items.push({
      id: 'smart_savings_insufficient_data', tone: 'info', type: 'smart_savings_insufficient_data',
      action: { kind: 'link', label: 'Set up a budget', to: '/app/budgets' },
    });
  } else if (smartSavings) {
    items.push({
      id: 'smart_savings', tone: 'positive', type: 'smart_savings', amount: smartSavings.amount,
      citation: smartSavings.citation,
      action: smartSavings.sourceAccountId && smartSavings.targetAccountId
        ? { kind: 'prefill_transfer', label: 'Move to savings', prefill: { fromAccountId: smartSavings.sourceAccountId, toAccountId: smartSavings.targetAccountId, amount: smartSavings.amount, vendor: 'Transfer to savings' } }
        : { kind: 'link', label: 'View accounts', to: '/app/accounts' },
    });
  }

  const topAnomaly = anomalies[0];
  if (duplicates.length) {
    items.push({
      id: 'unusual_duplicates', tone: 'warning', type: 'unusual_duplicates', count: duplicates.length,
      citation: { duplicates: duplicates.slice(0, 5) },
      action: { kind: 'link', label: 'Review transactions', to: '/app/transactions' },
    });
  } else if (topAnomaly) {
    items.push({
      id: 'unusual_transaction', tone: 'warning', type: 'unusual_transaction',
      vendor: topAnomaly.vendor, amount: topAnomaly.amount, multiple: topAnomaly.multiple,
      citation: { transactionId: topAnomaly.transactionId, date: topAnomaly.date, medianAmount: topAnomaly.medianAmount },
      action: { kind: 'link', label: 'Review transaction', to: '/app/transactions' },
    });
  } else if (!items.some((i) => i.tone === 'danger' || i.tone === 'warning')) {
    const largest = largestRecentExpense(userData.transactions, 7);
    items.push({
      id: 'no_unusual', tone: 'positive', type: 'no_unusual',
      largestVendor: largest?.vendor || null, largestAmount: largest ? Math.abs(largest.amount) : null,
      citation: largest ? { transactionId: largest.id, date: largest.date } : null,
      action: { kind: 'link', label: 'View transactions', to: '/app/transactions' },
    });
  }

  return items.slice(0, 6);
}

// Monthly AI report: income/expense/savings for the given month, largest
// spending category, budgets that stayed under limit or categories that
// fell, and forward-looking recommendations pulled from the same
// budget-pace/smart-savings/spending-insight logic used elsewhere so the
// report never disagrees with the live dashboard.
function computeMonthlyAIReport(userData, accounts, year, month) {
  const monthTxns = userData.transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const income = monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
  const savings = income - expense;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;
  const catMap = categorySpendForMonth(userData.transactions, userData.categories, year, month);
  const largest = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0];
  const largestCategory = largest
    ? { categoryId: largest[0], categoryName: userData.categories.find((c) => c.id === largest[0])?.name || 'Uncategorized', amount: Math.round(largest[1]) }
    : null;

  const achievements = [];
  userData.budgets.forEach((b) => {
    if (!(b.limit > 0)) return;
    const spent = computeBudgetSpent(b, userData.transactions, userData.categories);
    if (spent <= b.limit) {
      const cat = userData.categories.find((c) => c.id === b.categoryId);
      achievements.push({ type: 'under_budget', categoryName: cat?.name || 'Budget', spent: Math.round(spent), limit: b.limit });
    }
  });
  const spendingInsights = computeSpendingInsights(userData);
  spendingInsights
    .filter((i) => i.pct < 0)
    .forEach((i) => achievements.push({ type: 'spend_decrease', categoryName: i.categoryName, pct: Math.abs(i.pct) }));

  const recommendations = [];
  computeBudgetPredictions(userData).forEach((p) =>
    recommendations.push({ type: 'budget_pace', categoryName: p.categoryName, projected: p.projected, limit: p.limit })
  );
  const smartSavings = computeSmartSavings(userData, accounts);
  if (smartSavings && !smartSavings.insufficientData) recommendations.push({ type: 'smart_savings', amount: smartSavings.amount });
  spendingInsights
    .filter((i) => i.pct > 0)
    .forEach((i) => recommendations.push({ type: 'spend_increase', categoryName: i.categoryName, pct: Math.round(i.pct) }));

  return {
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    income: Math.round(income), expense: Math.round(expense), savings: Math.round(savings), savingsRate: round1(savingsRate),
    largestCategory,
    achievements: achievements.slice(0, 5),
    recommendations: recommendations.slice(0, 5),
  };
}

// Same item-array pattern as computeDailySummary (tone/type/citation/action),
// but week-scoped: week-over-week spend, bills due in the next 7 days,
// weekly-period budgets on pace, and the week's largest expense. Genuinely
// new — only a daily and a monthly narrative existed before this. Full
// calendar weeks (Mon-Sun) are compared for week-over-week rather than
// trying to align partial-week windows, which keeps the percentage honest
// about what it's actually comparing (labeled via citation) instead of
// silently approximating an apples-to-apples partial window.
function computeWeeklySummary(userData, accounts) {
  const items = [];
  const now = new Date();
  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart.getTime() - 1);

  const expenseInRange = (start, end) => userData.transactions
    .filter((t) => t.type === 'expense')
    .filter((t) => { const d = new Date(t.date); return d >= start && d <= end; })
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const thisWeekExpense = expenseInRange(thisWeekStart, now);
  const lastWeekExpense = expenseInRange(lastWeekStart, lastWeekEnd);
  const pct = lastWeekExpense > 0 ? ((thisWeekExpense - lastWeekExpense) / lastWeekExpense) * 100 : (thisWeekExpense > 0 ? 100 : 0);
  items.push({
    id: 'week_spend_trend', tone: pct < 0 ? 'positive' : 'info', type: 'week_spend_vs_last_week',
    thisWeekExpense: Math.round(thisWeekExpense), lastWeekExpense: Math.round(lastWeekExpense), pct: round1(pct),
    citation: { thisWeekStart: iso(thisWeekStart), lastWeekStart: iso(lastWeekStart), lastWeekEnd: iso(lastWeekEnd) },
    action: { kind: 'link', label: 'View report', to: '/app/reports' },
  });

  const billsDueThisWeek = upcomingBills(userData, { days: 7 });
  if (billsDueThisWeek.length) {
    items.push({
      id: 'week_bills_due', tone: 'warning', type: 'week_bills_due', count: billsDueThisWeek.length,
      totalAmount: Math.round(billsDueThisWeek.reduce((s, b) => s + b.amount, 0)),
      citation: { bills: billsDueThisWeek.slice(0, 5) },
      action: { kind: 'link', label: 'View bills', to: '/app/bills' },
    });
  }

  // Distinct from the AI-insights bundle's general budgetPredictions field
  // (which covers every period) — scoped to weekly-period budgets only, so
  // this doesn't just repeat the same list under a different heading.
  const weeklyBudgetPredictions = computeBudgetPredictions(userData).filter((p) => p.period === 'weekly');
  if (weeklyBudgetPredictions.length) {
    const worst = weeklyBudgetPredictions[0];
    items.push({
      id: 'week_budget_pace', tone: worst.projected >= worst.limit ? 'danger' : 'warning', type: 'week_budget_pace',
      categoryName: worst.categoryName, projected: worst.projected, limit: worst.limit,
      citation: { spent: worst.spent },
      action: { kind: 'link', label: 'Review category', to: '/app/budgets' },
    });
  }

  const daysSoFarThisWeek = Math.max(1, Math.round((now - thisWeekStart) / 86400000) + 1);
  const largest = largestRecentExpense(userData.transactions, daysSoFarThisWeek);
  if (largest) {
    items.push({
      id: 'week_largest_expense', tone: 'info', type: 'week_largest_expense',
      vendor: largest.vendor, amount: Math.abs(largest.amount), date: largest.date,
      citation: { transactionId: largest.id },
      action: { kind: 'link', label: 'View transactions', to: '/app/transactions' },
    });
  }

  return items.slice(0, 6);
}

module.exports = {
  computeDailySummary,
  computeMonthlyAIReport,
  computeWeeklySummary,
};
