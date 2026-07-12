const { round1, addDaysFromToday, computeBudgetSpent, categorySpendForMonth } = require('./shared');
const { buildSpendingTrend } = require('./metricsService');
const { upcomingBills } = require('./billAnalysisService');

// Trend-based forecast: current total balance plus the trailing 3-month
// average daily net (income minus expense), extrapolated out to 7/30 days
// and to the end of the current calendar month. Deliberately a single
// consistent model rather than layering in discrete upcoming-bill amounts
// on top (which risks double-counting money that's already reflected in
// the historical run rate) — upcoming bills are surfaced separately.
function computeCashFlowForecast(userData, accounts) {
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const trend = buildSpendingTrend(userData.transactions, 3);
  const totalNet = trend.reduce((s, m) => s + (m.income - m.expense), 0);
  const avgDailyNet = totalNet / (trend.length * 30);
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const eomDays = Math.max(0, Math.round((endOfMonth - now) / 86400000));
  const horizon = (days) => Math.round(totalBalance + avgDailyNet * days);
  return {
    current: Math.round(totalBalance),
    sevenDay: horizon(7),
    thirtyDay: horizon(30),
    endOfMonth: horizon(eomDays),
    endOfMonthDays: eomDays,
    avgDailyNet: round1(avgDailyNet),
  };
}

// Suggests moving spare cash into savings: liquid balance (checking/cash/
// wallet — excludes credit and existing savings accounts) minus a buffer
// covering bills due in the next 14 days plus one average week of spend.
// Only surfaces a suggestion when the surplus is large enough to be worth
// acting on, and never moves money itself — it's a suggestion the user
// still has to act on via the existing Transfer flow.
// A "move X to savings" claim is only as trustworthy as what it's checked
// against — recommending purely off a leftover balance is exactly the
// unreliable behavior this function must avoid (a balance can already be
// earmarked for rent, school fees, a card bill, a goal contribution, etc.
// with no sign of that in the number itself). So every known commitment
// against the user's liquid cash is subtracted explicitly, and each is
// broken out in `citation` so the final number is fully explainable rather
// than a black box:
//
//   Available to Save = Liquid Balance
//                        − Bills & scheduled transfers due in 30 days
//                        − Remaining budget allocations this period
//                        − Debt minimum payments due in 30 days
//                        − Committed monthly goal contributions
//                        − Typical spend in categories with no budget/bill
//
// If there are no budgets and no bills on record at all, there's nothing
// concrete to check the balance against — returning a number in that case
// would be the same unreliable balance-only guess this exists to prevent,
// so it reports "insufficient data" instead.
function computeSmartSavings(userData, accounts) {
  const liquidTypes = new Set(['bank', 'cash', 'wallet']);
  const liquidAccounts = accounts.filter((a) => liquidTypes.has(a.type));
  const liquidBalance = liquidAccounts.reduce((s, a) => s + Math.max(0, a.balance), 0);
  if (liquidBalance <= 0) return null;

  const budgets = userData.budgets || [];
  const bills = userData.bills || [];
  if (budgets.length === 0 && bills.length === 0) {
    return { insufficientData: true };
  }

  const liquidAccountIds = new Set(liquidAccounts.map((a) => a.id));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30Days = addDaysFromToday(30);

  // Bills & scheduled payments due in the next 30 days — rent, EMI,
  // insurance, school fees, subscriptions. A scheduled transfer bill counts
  // too when it draws from one of these liquid accounts: that money is
  // already spoken for even though it's moving to another of the user's own
  // accounts, not out of the household.
  const upcomingBills = bills.filter((b) => {
    if (b.status !== 'pending') return false;
    const d = new Date(b.dueDate);
    if (d < today || d > in30Days) return false;
    return b.type === 'transfer' ? liquidAccountIds.has(b.fromAccountId) : true;
  });
  const billsReserved = upcomingBills.reduce((s, b) => s + Math.abs(b.amount), 0);

  // Remaining budget allocations this period — money earmarked for a
  // category that hasn't been spent yet is still committed, not "extra."
  const budgetsReserved = budgets
    .filter((b) => b.limit > 0)
    .reduce((s, b) => s + Math.max(0, b.limit - computeBudgetSpent(b, userData.transactions, userData.categories)), 0);

  // Debt minimum payments due in the next 30 days — credit card due amounts,
  // EMIs, loan installments.
  const debtsDueSoon = (userData.debts || []).filter((d) => {
    if (!d.dueDate || !(d.minPayment > 0)) return false;
    const due = new Date(d.dueDate);
    return due >= today && due <= in30Days;
  });
  const debtsReserved = debtsDueSoon.reduce((s, d) => s + d.minPayment, 0);

  // Goal contributions the user has already committed to making this month.
  const goalsReserved = (userData.goals || [])
    .filter((g) => g.saved < g.target)
    .reduce((s, g) => s + Math.max(0, g.monthlyContribution || 0), 0);

  // Trailing 3-month average spend in categories that have neither a budget
  // nor a bill tracking them — genuinely un-planned discretionary spending
  // still needs room, without double-counting categories already reserved
  // for above via budgets or bills.
  const topLevelIdOf = new Map(userData.categories.map((c) => [c.id, c.parentId || c.id]));
  const trackedCategoryIds = new Set([
    ...budgets.map((b) => topLevelIdOf.get(b.categoryId) || b.categoryId),
    ...bills.map((b) => topLevelIdOf.get(b.categoryId) || b.categoryId).filter(Boolean),
  ]);
  let unbudgetedTotal = 0;
  for (let i = 0; i < 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthMap = categorySpendForMonth(userData.transactions, userData.categories, d.getFullYear(), d.getMonth());
    monthMap.forEach((amount, categoryId) => {
      if (!trackedCategoryIds.has(categoryId)) unbudgetedTotal += amount;
    });
  }
  const unbudgetedBuffer = Math.round(unbudgetedTotal / 3);

  const totalReserved = billsReserved + budgetsReserved + debtsReserved + goalsReserved + unbudgetedBuffer;
  const availableToSave = liquidBalance - totalReserved;
  if (availableToSave < 500) return null;

  const suggested = Math.floor(availableToSave / 100) * 100;
  const savingsAccount = accounts.find((a) => a.type === 'savings');
  // Source for a one-click transfer: the liquid account holding the most —
  // that's where the available amount is actually sitting.
  const sourceAccount = [...liquidAccounts].sort((a, b) => b.balance - a.balance)[0];
  return {
    amount: suggested,
    targetAccountId: savingsAccount?.id || null,
    targetAccountName: savingsAccount?.name || null,
    sourceAccountId: sourceAccount?.id || null,
    sourceAccountName: sourceAccount?.name || null,
    citation: {
      liquidBalance: Math.round(liquidBalance),
      billsReserved: Math.round(billsReserved),
      budgetsReserved: Math.round(budgetsReserved),
      debtsReserved: Math.round(debtsReserved),
      goalsReserved: Math.round(goalsReserved),
      unbudgetedBuffer,
      totalReserved: Math.round(totalReserved),
      availableToSave: Math.round(availableToSave),
    },
  };
}

// Flags a projected balance point that drops below zero, or below the bills
// already committed to be due by that point (whichever is more useful — a
// strict $0 floor is unambiguous, but a positive-but-less-than-your-bills
// balance is worth flagging too, so both checks are surfaced with their own
// citation rather than picking just one definition).
function computeLowBalanceAlert(userData, accounts) {
  const forecast = computeCashFlowForecast(userData, accounts);
  const points = [7, 30].map((days) => {
    const billsDue = Math.round(upcomingBills(userData, { days }).reduce((s, b) => s + b.amount, 0));
    const projected = days === 7 ? forecast.sevenDay : forecast.thirtyDay;
    return {
      days,
      projected,
      billsDue,
      belowZero: projected < 0,
      belowCommittedBills: projected < billsDue,
    };
  });
  const flagged = points.filter((p) => p.belowZero || p.belowCommittedBills);
  if (!flagged.length) return null;
  return { points, worstPoint: flagged[0] };
}

module.exports = {
  computeCashFlowForecast,
  computeSmartSavings,
  computeLowBalanceAlert,
};
