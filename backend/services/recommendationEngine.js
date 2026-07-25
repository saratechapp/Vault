// Composition-only: reads the already-computed outputs of the other
// analysis services and ranks/formats them into one flat list. Never
// recomputes any analysis itself — every number here traces back to a
// service that already produced it, so this can't disagree with what the
// dashboard/AI-insights bundle already shows. `action` reuses the exact
// `{ kind, label, to/prefill }` shape computeDailySummary's items already
// use, so the frontend's existing action-rendering code works unmodified.
function pushIf(list, condition, item) {
  if (condition) list.push(item);
}

// Maps a Health Score factor's `improve` object (already a structured
// actionable suggestion — see healthScoreEngine.js) to a recommendation.
// `type: 'none'` means that factor is already healthy; skipped.
function recommendationFromImprove(factorName, improve) {
  switch (improve?.type) {
    case 'budget':
      return {
        id: `improve_budget_${factorName}`, priority: 2,
        title: `Reduce spending in ${improve.categoryName}`,
        body: `You've used ${improve.pctUsed}% of that budget for this period.`,
        action: { kind: 'link', label: 'Review budget', to: '/app/budgets' },
      };
    case 'savings_rate':
      return {
        id: 'improve_savings_rate', priority: 3,
        title: 'Increase your savings rate',
        body: `Cutting about ${improve.neededCut} from monthly spending would meaningfully improve your savings rate.`,
        action: { kind: 'link', label: 'View report', to: '/app/reports' },
      };
    case 'debt':
      return {
        id: 'improve_debt', priority: 2,
        title: 'Pay down high-interest debt',
        body: `Paying down about ${improve.suggestedPaydown} would meaningfully improve your debt load.`,
        action: { kind: 'link', label: 'View debts', to: '/app/debts' },
      };
    case 'emergency_fund':
      return {
        id: 'improve_emergency_fund', priority: 3,
        title: 'Build your emergency fund',
        body: `Adding about ${improve.shortfall} would bring you to a full 6-month safety net.`,
        action: { kind: 'link', label: 'View accounts', to: '/app/accounts' },
      };
    case 'credit_utilization':
      return {
        id: 'improve_credit_utilization', priority: 1,
        title: 'Pay down your credit card before interest is charged',
        body: `Paying down about ${improve.suggestedPaydown} would bring your credit utilization back under 30%.`,
        action: { kind: 'link', label: 'View accounts', to: '/app/accounts' },
      };
    case 'bill_payment':
      return {
        id: 'improve_bill_payment', priority: 2,
        title: 'Reduce late bill payments',
        body: `You've had ${improve.latePaymentCount} late payment(s) recently — consider setting a reminder a few days before each bill is due so you can pay it on time.`,
        action: { kind: 'link', label: 'View bills', to: '/app/bills' },
      };
    default:
      return null;
  }
}

// `inputs` is the bundle of already-computed results from the other
// services — passed in, never fetched/recomputed here.
function buildRecommendations({
  health, budgetPredictions = [], unusedBudgets = [], spendingInsights = [],
  largeExpenses = [], smartSavings = null, lowBalanceAlert = null, goalForecasts = [],
} = {}) {
  const recommendations = [];

  (health?.breakdown || []).forEach((factor) => {
    const rec = recommendationFromImprove(factor.name, factor.improve);
    if (rec) recommendations.push(rec);
  });

  budgetPredictions.slice(0, 2).forEach((p) => {
    recommendations.push({
      id: `budget_pace_${p.budgetId}`, priority: 1,
      title: `${p.categoryName} is on pace to go over budget`,
      body: `Projected to reach ${p.projected}, over your ${p.limit} limit — slow spending here before the period ends.`,
      action: { kind: 'link', label: 'Review budget', to: '/app/budgets' },
    });
  });

  unusedBudgets.slice(0, 2).forEach((u) => {
    recommendations.push({
      id: `unused_budget_${u.budgetId}`, priority: 4,
      title: `${u.categoryName} budget is going unused`,
      body: `You've used it only ${u.avgPctUsed}% on average over the last ${u.periodsChecked} periods — consider reducing or reallocating it.`,
      action: { kind: 'link', label: 'Review budget', to: '/app/budgets' },
    });
  });

  spendingInsights.filter((i) => i.pct > 0).slice(0, 2).forEach((i) => {
    recommendations.push({
      id: `spending_increase_${i.categoryId}`, priority: 3,
      title: `${i.categoryName} spending increased ${Math.round(i.pct)}%`,
      body: `Up from ${i.prev} to ${i.curr} vs. last month — worth a look.`,
      action: { kind: 'link', label: 'View transactions', to: '/app/transactions' },
    });
  });

  largeExpenses.slice(0, 1).forEach((e) => {
    recommendations.push({
      id: `large_expense_${e.transactionId}`, priority: 4,
      title: `Large expense at ${e.vendor}`,
      body: `${e.amount} on ${e.date} — meaningfully above your typical spend.`,
      action: { kind: 'link', label: 'Review transaction', to: '/app/transactions' },
    });
  });

  pushIf(recommendations, lowBalanceAlert, {
    id: 'low_balance_alert', priority: 1,
    title: 'Projected balance is running low',
    body: lowBalanceAlert
      ? `Your ${lowBalanceAlert.worstPoint.days}-day projected balance (${lowBalanceAlert.worstPoint.projected}) may not cover ${lowBalanceAlert.worstPoint.billsDue} in bills already due.`
      : '',
    action: { kind: 'link', label: 'View bills', to: '/app/bills' },
  });

  goalForecasts.slice(0, 2).forEach((g) => {
    recommendations.push({
      id: `goal_contribution_${g.goalId}`, priority: 3,
      title: `Increase your ${g.goalName} contribution`,
      body: `Contributing ${g.shortfall} more per month would get you there by ${g.deadline}.`,
      action: { kind: 'link', label: 'View goal', to: '/app/goals' },
    });
  });

  pushIf(recommendations, smartSavings && !smartSavings.insufficientData, {
    id: 'smart_savings', priority: 5,
    title: 'Move surplus cash into savings',
    body: smartSavings ? `You have about ${smartSavings.amount} beyond your committed bills, budgets and goals.` : '',
    action: smartSavings?.sourceAccountId && smartSavings?.targetAccountId
      ? { kind: 'prefill_transfer', label: 'Move to savings', prefill: { fromAccountId: smartSavings.sourceAccountId, toAccountId: smartSavings.targetAccountId, amount: smartSavings.amount, vendor: 'Transfer to savings' } }
      : { kind: 'link', label: 'View accounts', to: '/app/accounts' },
  });

  return recommendations.sort((a, b) => a.priority - b.priority).slice(0, 8);
}

module.exports = {
  buildRecommendations,
};
