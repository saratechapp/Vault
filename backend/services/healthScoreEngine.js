const { computeBudgetSpent, round1 } = require('./shared');
const { buildSpendingTrend } = require('./metricsService');
const { computeBillPaymentHistory } = require('./billAnalysisService');

// "Used" is the negative portion of a credit account's balance, matching
// how credit-account balances already work elsewhere (excluded from
// liquid/totalAssets via `a.type !== 'credit'`/`Math.max(0, a.balance)`).
// Extracted as its own function (not inlined in computeHealth) so
// NotificationEngine's credit_utilization_high check can reuse the exact
// same math instead of a second copy that could drift out of sync.
function computeCreditUtilization(accounts) {
  const creditAccountsWithLimit = accounts.filter((a) => a.type === 'credit' && a.creditLimit > 0);
  if (creditAccountsWithLimit.length === 0) return null;
  const totalUsed = creditAccountsWithLimit.reduce((s, a) => s + Math.max(0, -a.balance), 0);
  const totalLimit = creditAccountsWithLimit.reduce((s, a) => s + a.creditLimit, 0);
  const utilizationPct = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;
  return { totalUsed: Math.round(totalUsed), totalLimit: Math.round(totalLimit), utilizationPct: round1(utilizationPct) };
}

function gradeFor(score) {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 60) return 'D';
  return 'F';
}

// Composite financial-health score, recomputed from the user's actual data
// on every dashboard load rather than a stored value — same "always live"
// principle as account/category balances. Each factor only appears once
// there's enough of the relevant data to say something meaningful about it;
// with nothing to go on at all, the caller shows "not enough data" instead.
function computeHealth(userData, accounts) {
  if (accounts.length === 0 || userData.transactions.length === 0) {
    return { score: 0, grade: '—', breakdown: [] };
  }

  const breakdown = [];

  if (userData.budgets.length > 0) {
    const budgetDetail = userData.budgets.map((b) => {
      const spent = b.limit > 0 ? computeBudgetSpent(b, userData.transactions, userData.categories) : 0;
      const cat = userData.categories.find((c) => c.id === b.categoryId);
      return { categoryName: cat?.name || 'Budget', spent: Math.round(spent), limit: b.limit, pctUsed: b.limit > 0 ? round1((spent / b.limit) * 100) : 0 };
    });
    const adherence = budgetDetail.map((b) => (b.limit > 0 ? Math.max(0, Math.min(100, 100 - Math.max(0, b.pctUsed - 100))) : 100));
    const score = Math.round(adherence.reduce((s, v) => s + v, 0) / adherence.length);
    const worst = [...budgetDetail].sort((a, b) => b.pctUsed - a.pctUsed)[0];
    breakdown.push({
      name: 'Budget Adherence', score,
      note: score >= 80 ? 'Comfortably under your budgets.' : score >= 50 ? 'A few budgets are running hot.' : 'Frequently over budget.',
      detail: { budgets: budgetDetail },
      improve: worst && worst.pctUsed >= 80
        ? { type: 'budget', categoryName: worst.categoryName, pctUsed: Math.round(worst.pctUsed) }
        : { type: 'none' },
    });
  }

  const [thisMonth] = buildSpendingTrend(userData.transactions, 1);
  if (thisMonth.income > 0 || thisMonth.expense > 0) {
    const rate = thisMonth.income > 0 ? ((thisMonth.income - thisMonth.expense) / thisMonth.income) * 100 : 0;
    const score = Math.max(0, Math.min(100, Math.round(rate)));
    breakdown.push({
      name: 'Savings Rate', score,
      note: score >= 60 ? 'Saving a healthy share of income.' : score >= 20 ? 'Saving a modest share of income.' : 'Spending most or all of your income.',
      detail: { income: Math.round(thisMonth.income), expense: Math.round(thisMonth.expense), savings: Math.round(thisMonth.income - thisMonth.expense) },
      improve: score < 60 && thisMonth.income > 0
        ? { type: 'savings_rate', neededCut: Math.round(Math.max(0, thisMonth.expense - thisMonth.income * 0.4)) }
        : { type: 'none' },
    });
  }

  const totalDebt = (userData.debts || []).reduce((s, d) => s + d.balance, 0);
  const totalAssets = accounts.reduce((s, a) => s + Math.max(0, a.balance), 0);
  if (totalDebt > 0 || totalAssets > 0) {
    const score = totalDebt <= 0 ? 100 : Math.max(0, Math.min(100, Math.round(100 - (totalDebt / (totalAssets + totalDebt)) * 100)));
    breakdown.push({
      name: 'Debt Load', score,
      note: score >= 70 ? 'Debt is well managed relative to assets.' : score >= 40 ? 'Some high-APR debt outstanding.' : 'Debt load is high relative to assets.',
      detail: { totalDebt: Math.round(totalDebt), totalAssets: Math.round(totalAssets) },
      improve: totalDebt > 0 ? { type: 'debt', suggestedPaydown: Math.round(totalDebt * 0.25) } : { type: 'none' },
    });
  }

  const liquid = accounts.filter((a) => a.type !== 'credit').reduce((s, a) => s + Math.max(0, a.balance), 0);
  const recentTrend = buildSpendingTrend(userData.transactions, 3);
  const avgMonthlyExpense = recentTrend.reduce((s, m) => s + m.expense, 0) / recentTrend.length;
  if (liquid > 0 || avgMonthlyExpense > 0) {
    const monthsCovered = avgMonthlyExpense > 0 ? liquid / avgMonthlyExpense : 6;
    const score = Math.max(0, Math.min(100, Math.round((monthsCovered / 6) * 100)));
    breakdown.push({
      name: 'Emergency Fund', score,
      note: score >= 100 ? 'Full safety net of 6+ months.' : score >= 50 ? 'Getting close to a full safety net.' : 'Limited runway if income stopped.',
      detail: { liquidBalance: Math.round(liquid), avgMonthlyExpense: Math.round(avgMonthlyExpense), monthsCovered: round1(monthsCovered) },
      improve: score < 100 && avgMonthlyExpense > 0
        ? { type: 'emergency_fund', shortfall: Math.round(Math.max(0, avgMonthlyExpense * 6 - liquid)) }
        : { type: 'none' },
    });
  }

  // Credit Utilization — only appears once at least one credit account has
  // a creditLimit set (0006_credit_limit.sql; nullable, so most accounts
  // won't qualify until a user fills it in).
  const utilization = computeCreditUtilization(accounts);
  if (utilization) {
    const score = Math.max(0, Math.min(100, Math.round(100 - utilization.utilizationPct)));
    breakdown.push({
      name: 'Credit Utilization', score,
      note: utilization.utilizationPct <= 30 ? 'Credit usage is well within a healthy range.' : utilization.utilizationPct <= 50 ? 'Credit usage is getting high.' : 'Credit usage is high relative to your limits.',
      detail: utilization,
      improve: utilization.utilizationPct > 30
        ? { type: 'credit_utilization', suggestedPaydown: Math.round(Math.max(0, utilization.totalUsed - utilization.totalLimit * 0.3)) }
        : { type: 'none' },
    });
  }

  // Bill Payment History — only appears once there's enough logged payment
  // history to judge from (see computeBillPaymentHistory's insufficientData
  // gate); new users and anyone who hasn't paid a bill through the app since
  // 0007_bill_payments.sql shipped simply won't have this factor yet, same
  // graceful-degradation convention as every factor above.
  const billHistory = computeBillPaymentHistory(userData);
  if (!billHistory.insufficientData) {
    const score = Math.round(billHistory.onTimeRate);
    breakdown.push({
      name: 'Bill Payment History', score,
      note: score >= 90 ? 'Bills are almost always paid on time.' : score >= 70 ? 'Most bills are paid on time.' : 'Frequent late bill payments.',
      detail: { totalPayments: billHistory.totalPayments, onTimeCount: billHistory.onTimeCount, lateCount: billHistory.lateCount },
      improve: score < 90 ? { type: 'bill_payment', latePaymentCount: billHistory.lateCount } : { type: 'none' },
    });
  }

  if (breakdown.length === 0) return { score: 0, grade: '—', breakdown: [] };
  const overall = Math.round(breakdown.reduce((s, b) => s + b.score, 0) / breakdown.length);
  return { score: overall, grade: gradeFor(overall), breakdown };
}

module.exports = {
  gradeFor,
  computeHealth,
  computeCreditUtilization,
};
