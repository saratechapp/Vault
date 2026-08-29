const { round1, addDaysFromToday } = require('./shared');
const { buildSpendingTrend } = require('./metricsService');

// This month vs. the same calendar month last year — buildSpendingTrend's
// own bucketing (trailing N months ending at the current one) makes this a
// 13-month pull rather than a bespoke date range: index 12 is the current
// month, index 0 is exactly 12 months back.
function computeYearOverYear(userData, accounts) {
  const trend = buildSpendingTrend(userData.transactions, 13, accounts);
  const currentMonth = trend[12];
  const sameMonthLastYear = trend[0];
  const pct = (a, b) => (b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0);
  return {
    currentMonth: { month: currentMonth.month, income: Math.round(currentMonth.income), expense: Math.round(currentMonth.expense) },
    sameMonthLastYear: { month: sameMonthLastYear.month, income: Math.round(sameMonthLastYear.income), expense: Math.round(sameMonthLastYear.expense) },
    incomeChangePct: round1(pct(currentMonth.income, sameMonthLastYear.income)),
    expenseChangePct: round1(pct(currentMonth.expense, sameMonthLastYear.expense)),
  };
}

function computeAverageDailySpending(userData, { days = 30 } = {}) {
  const since = addDaysFromToday(-days);
  const total = userData.transactions
    .filter((t) => t.type === 'expense' && new Date(t.date) >= since)
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  return round1(total / days);
}

function computeAverageMonthlySavings(userData, accounts, { months = 3 } = {}) {
  const trend = buildSpendingTrend(userData.transactions, months, accounts);
  const total = trend.reduce((s, m) => s + (m.income - m.expense), 0);
  return round1(total / months);
}

// Weekend/weekday spend split over a trailing window, normalized to a
// per-day average (not just a raw total) since a 90-day window has roughly
// 3.5x as many weekdays as weekend days — a raw total would always show
// "you spend more on weekdays" regardless of actual habits.
function computeWeekendVsWeekday(userData, { days = 90 } = {}) {
  const since = addDaysFromToday(-days);
  let weekendDayCount = 0, weekdayDayCount = 0;
  for (let i = 0; i < days; i++) {
    const day = addDaysFromToday(-i).getDay();
    if (day === 0 || day === 6) weekendDayCount++; else weekdayDayCount++;
  }
  let weekendTotal = 0, weekdayTotal = 0;
  userData.transactions
    .filter((t) => t.type === 'expense' && new Date(t.date) >= since)
    .forEach((t) => {
      const day = new Date(t.date).getDay();
      const amt = Math.abs(t.amount);
      if (day === 0 || day === 6) weekendTotal += amt; else weekdayTotal += amt;
    });
  return {
    days,
    weekendTotal: Math.round(weekendTotal),
    weekdayTotal: Math.round(weekdayTotal),
    weekendAvgPerDay: weekendDayCount > 0 ? round1(weekendTotal / weekendDayCount) : 0,
    weekdayAvgPerDay: weekdayDayCount > 0 ? round1(weekdayTotal / weekdayDayCount) : 0,
  };
}

function computeMostAndLeastExpensiveMonth(userData, accounts, { months = 12 } = {}) {
  const trend = buildSpendingTrend(userData.transactions, months, accounts).filter((m) => m.expense > 0);
  if (!trend.length) return null;
  const most = trend.reduce((max, m) => (m.expense > max.expense ? m : max));
  const least = trend.reduce((min, m) => (m.expense < min.expense ? m : min));
  return {
    mostExpensiveMonth: { month: most.month, expense: Math.round(most.expense) },
    leastExpensiveMonth: { month: least.month, expense: Math.round(least.expense) },
  };
}

// Extracted verbatim from GET /api/reports' previously-inline category-spend
// reduce/map/sort — same output shape, now shared with any AI insight that
// wants the same "top categories" data instead of re-deriving it. `n`
// defaults to no limit (matches /api/reports' original unsliced behavior);
// pass it explicitly for a capped top-N list.
function computeTopSpendingCategories(userData, { n } = {}) {
  const { transactions, categories } = userData;
  const categoryTotals = new Map();
  transactions.filter((t) => t.type === 'expense').forEach((t) => {
    categoryTotals.set(t.categoryId, (categoryTotals.get(t.categoryId) || 0) + Math.abs(t.amount));
  });
  const sorted = [...categoryTotals.entries()]
    .map(([categoryId, amount]) => {
      const cat = categories.find((c) => c.id === categoryId);
      return { categoryId, amount, name: cat?.name || 'Uncategorized', color: cat?.color || '#64748b' };
    })
    .sort((a, b) => b.amount - a.amount);
  return typeof n === 'number' ? sorted.slice(0, n) : sorted;
}

// Extracted verbatim from GET /api/reports' previously-inline top-payees
// reduce/map/sort. "Top Payees" is who you actually paid — a debt/loan
// repayment's vendor is the debt's own name, not a merchant, so it's
// excluded the same way transfers already are (transfers never reach this
// filter since it's type === 'expense' only).
function computeTopMerchants(userData, { n = 8 } = {}) {
  const payeeTotals = new Map();
  userData.transactions
    .filter((t) => t.type === 'expense' && !(t.labels || []).includes('debt-payment'))
    .forEach((t) => {
      payeeTotals.set(t.vendor, (payeeTotals.get(t.vendor) || 0) + Math.abs(t.amount));
    });
  return [...payeeTotals.entries()]
    .map(([vendor, amount]) => ({ vendor, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

module.exports = {
  computeYearOverYear,
  computeAverageDailySpending,
  computeAverageMonthlySavings,
  computeWeekendVsWeekday,
  computeMostAndLeastExpensiveMonth,
  computeTopSpendingCategories,
  computeTopMerchants,
};
