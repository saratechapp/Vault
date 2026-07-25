// Server-side port of the web app's client-only "Financial Assistant"
// (frontend/src/lib/assistant/{intents,handlers,localProvider,dateUtils,
// categoryMatch}.js) — same rule-based intent matching and response shape,
// moved server-side so both web and mobile share one engine and one set of
// answers instead of the web copy re-fetching over HTTP from the browser.
// Deliberately still no LLM/external AI call: every handler below reads
// straight from req.userData (already fetched once per request by
// requireAuth) and the existing analysis services — same "rule-based, no
// external calls, computed live" principle as GET /api/ai/insights.
//
// Response shape (unchanged from the web engine, both clients render this):
//   { heading?, headingValue?, text?, icon?, tone?,
//     rows?: [{label, value, tone?}], table?: {columns, rows}, note?,
//     quickActions?: [{label, action, to?}], followUps?: [{label, intentId, args?}] }
// `quickActions[].action` is new here (alongside the web-only `.to` route) —
// a semantic key mobile maps to its own navigation target.
const { computeAccounts, buildMetrics } = require('./metricsService');
const { computeHealth } = require('./healthScoreEngine');
const { computeBudgetSpent, categorySpendForMonth } = require('./shared');
const { computeTopSpendingCategories } = require('./cashFlowAnalysisService');
const { computeMonthlyAIReport } = require('./financialInsightsService');
const { computeAiInsightsBundle } = require('./aiInsightsBundle');
const insightsCache = require('./cache');

// ---------------------------------------------------------------------------
// date helpers — ported verbatim from frontend/src/lib/assistant/dateUtils.js
// ---------------------------------------------------------------------------
const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
function monthLabel(year, month) {
  return `${MONTH_NAMES[month][0].toUpperCase()}${MONTH_NAMES[month].slice(1)} ${year}`;
}
function currentMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}
function previousMonth({ year, month }) {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
}
function monthRange(year, month) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { dateFrom: iso(from), dateTo: iso(to) };
}
function findMonthMentions(text) {
  const lower = (text || '').toLowerCase();
  const now = new Date();
  const found = [];
  MONTH_NAMES.forEach((name, month) => {
    const idx = lower.indexOf(name);
    if (idx === -1) return;
    let year = now.getFullYear();
    if (month > now.getMonth()) year -= 1;
    found.push({ idx, year, month });
  });
  return found.sort((a, b) => a.idx - b.idx).map(({ year, month }) => ({ year, month }));
}

// ---------------------------------------------------------------------------
// category-name matching — ported verbatim from
// frontend/src/lib/assistant/categoryMatch.js
// ---------------------------------------------------------------------------
const SYNONYMS = {
  restaurant: ['restaurant', 'dining', 'eating out', 'food'],
  coffee: ['coffee', 'cafe', 'café'],
  grocery: ['grocery', 'groceries', 'supermarket'],
  fuel: ['fuel', 'gas', 'petrol'],
  transportation: ['transport', 'transportation', 'commute', 'uber', 'taxi', 'ride'],
  shopping: ['shopping', 'retail'],
  entertainment: ['entertainment', 'movies', 'streaming'],
  housing: ['housing', 'rent', 'mortgage'],
  utilities: ['utilities', 'utility', 'electricity', 'water bill'],
};
function expandSynonyms(keyword) {
  const k = keyword.toLowerCase();
  return SYNONYMS[k] || [k];
}
function matchCategory(categories, keyword) {
  if (!categories?.length || !keyword) return null;
  const needles = expandSynonyms(keyword);
  return categories.find((c) => needles.some((n) => c.name.toLowerCase().includes(n))) || null;
}
function findSynonymKeyInText(text) {
  const lower = (text || '').toLowerCase();
  const entry = Object.entries(SYNONYMS).find(([, needles]) => needles.some((n) => lower.includes(n)));
  return entry ? entry[0] : null;
}

// ---------------------------------------------------------------------------
// formatting — server-side equivalent of frontend/src/lib/api.js's
// formatCurrency/formatDate. Those read the browser's locally-stored
// currency/date-format prefs, which have no server-side equivalent; this
// uses the user's saved profile currency symbol and a fixed en-US format
// instead — visually close, not pixel-identical to a given client's prefs.
function formatCurrency(n, symbol = '₹') {
  const val = Math.abs(Number(n) || 0);
  return `${n < 0 ? '-' : ''}${symbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function shortDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// context — the data every handler reads from. Built once per chat message,
// reusing the same cached 'ai-insights'/'health' bundles GET /api/ai/insights
// and GET /api/dashboard already populate/invalidate, so a chat answer can
// never numerically disagree with the Reports tab or the dashboard.
// ---------------------------------------------------------------------------
async function buildContext(userId, userData, currencySymbol) {
  const accounts = computeAccounts(userData);
  const [bundle, health] = await Promise.all([
    computeAiInsightsBundle(userId, userData, accounts),
    insightsCache.getOrCompute(userId, 'health', () => computeHealth(userData, accounts)),
  ]);
  const budgetsWithSpent = userData.budgets.map((b) => ({
    ...b,
    category: userData.categories.find((c) => c.id === b.categoryId) || null,
    spent: computeBudgetSpent(b, userData.transactions, userData.categories),
  }));
  // Mirrors GET /api/reports' totals — all-time, not scoped to a period (a
  // pre-existing characteristic of the web engine's "spending summary",
  // preserved here rather than silently changed).
  const reportsTotals = userData.transactions.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      else if (t.type === 'expense') acc.expense += Math.abs(t.amount);
      return acc;
    },
    { income: 0, expense: 0 }
  );
  const reportsSavings = reportsTotals.income - reportsTotals.expense;
  const reportsSavingsRate = reportsTotals.income > 0 ? (reportsSavings / reportsTotals.income) * 100 : 0;
  const allCategorySpend = computeTopSpendingCategories(userData);
  const fmt = (n) => formatCurrency(n, currencySymbol);
  return { userData, accounts, bundle, health, budgetsWithSpent, reportsTotals, reportsSavings, reportsSavingsRate, allCategorySpend, fmt };
}

// Same category/date filtering handlers.js's expenseTotalsForRange did via
// an HTTP call to GET /api/transactions — computed directly over
// ctx.userData here instead, no network round-trip needed server-side.
function expenseTotalsForRange(ctx, dateFrom, dateTo) {
  const { transactions, categories } = ctx.userData;
  const inRange = transactions.filter((t) => t.date >= dateFrom && t.date <= dateTo);
  const catName = (id) => categories.find((c) => c.id === id)?.name || 'Uncategorized';
  const byCategory = new Map();
  let income = 0;
  let expense = 0;
  inRange.forEach((t) => {
    if (t.type === 'income') income += Math.abs(t.amount);
    else if (t.type === 'expense') {
      expense += Math.abs(t.amount);
      const name = catName(t.categoryId);
      byCategory.set(name, (byCategory.get(name) || 0) + Math.abs(t.amount));
    }
  });
  const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { income, expense, topCategories, transactions: inRange };
}

const TX_TABLE_COLUMNS = [
  { key: 'vendor', label: 'Vendor' },
  { key: 'date', label: 'Date' },
  { key: 'amount', label: 'Amount', align: 'right' },
];
function txTableRows(ctx, transactions) {
  return transactions.map((t) => ({ id: t.id, vendor: t.vendor || 'Unknown', date: shortDate(t.date), amount: ctx.fmt(Math.abs(t.amount)) }));
}

const FOLLOWUPS = {
  spendingSummary: [
    { label: 'Compare with last month', intentId: 'compareMonths' },
    { label: 'Top spending categories', intentId: 'topCategories' },
    { label: 'Am I over budget?', intentId: 'overBudget' },
  ],
  category: (categoryName) => [
    { label: 'Compare with last month', intentId: 'categorySpending', args: { category: categoryName } },
    { label: `Show ${categoryName} transactions`, intentId: 'categoryTransactions', args: { category: categoryName } },
    { label: 'Recommend savings', intentId: 'howToSaveMore' },
  ],
  bills: [{ label: 'Show upcoming recurring bills', intentId: 'upcomingRecurring' }],
  goals: [
    { label: 'How can I save more?', intentId: 'howToSaveMore' },
    { label: 'Show account balances', intentId: 'accountBalances' },
  ],
};

// ---------------------------------------------------------------------------
// handlers — one per answerable question, ported from handlers.js's
// assistantData.*() calls onto the ctx built above.
// ---------------------------------------------------------------------------
const HANDLERS = {
  async whereDidMoneyGo(ctx) {
    const { year, month } = currentMonth();
    const { dateFrom, dateTo } = monthRange(year, month);
    const { expense, topCategories } = expenseTotalsForRange(ctx, dateFrom, dateTo);
    const biggestMover = (ctx.bundle.spendingInsights || [])[0];
    return {
      icon: 'Wallet', tone: 'info', heading: 'Total Expenses', headingValue: ctx.fmt(expense),
      rows: topCategories.map(([name, amount]) => ({ label: name, value: ctx.fmt(amount) })),
      note: biggestMover
        ? `${biggestMover.categoryName} ${biggestMover.pct > 0 ? 'increased' : 'decreased'} by ${Math.abs(biggestMover.pct)}% compared to last month.`
        : undefined,
      followUps: FOLLOWUPS.spendingSummary,
      quickActions: [{ label: 'View Transactions', action: 'openTransactions', to: '/app/transactions' }],
    };
  },

  async spendingSummary(ctx) {
    return {
      icon: 'PieChart', tone: 'info', heading: 'This Period',
      text: `Income ${ctx.fmt(ctx.reportsTotals.income)} · Expenses ${ctx.fmt(ctx.reportsTotals.expense)}`,
      rows: ctx.allCategorySpend.slice(0, 6).map((c) => ({ label: c.name, value: ctx.fmt(c.amount) })),
      note: `Savings rate: ${Math.round(ctx.reportsSavingsRate)}%`,
      followUps: FOLLOWUPS.spendingSummary,
      quickActions: [{ label: 'Open Reports', action: 'openReports', to: '/app/reports' }],
    };
  },

  async compareMonths(ctx, args = {}) {
    let a = args.a;
    let b = args.b;
    if (!a || !b) {
      const cur = currentMonth();
      a = cur;
      b = previousMonth(cur);
    }
    const rangeA = monthRange(a.year, a.month);
    const rangeB = monthRange(b.year, b.month);
    const totalsA = expenseTotalsForRange(ctx, rangeA.dateFrom, rangeA.dateTo);
    const totalsB = expenseTotalsForRange(ctx, rangeB.dateFrom, rangeB.dateTo);
    const diff = totalsA.expense - totalsB.expense;
    const pct = totalsB.expense > 0 ? Math.round((diff / totalsB.expense) * 100) : 0;
    return {
      icon: 'BarChart3', tone: diff > 0 ? 'warning' : diff < 0 ? 'success' : 'info',
      heading: `${monthLabel(a.year, a.month)} vs ${monthLabel(b.year, b.month)}`,
      rows: [
        { label: `${monthLabel(a.year, a.month)} expenses`, value: ctx.fmt(totalsA.expense) },
        { label: `${monthLabel(b.year, b.month)} expenses`, value: ctx.fmt(totalsB.expense) },
      ],
      note: diff === 0
        ? 'Spending was flat between the two months.'
        : `You spent ${ctx.fmt(Math.abs(diff))} (${Math.abs(pct)}%) ${diff > 0 ? 'more' : 'less'} in ${monthLabel(a.year, a.month)} than ${monthLabel(b.year, b.month)}.`,
      followUps: [{ label: 'Top spending categories', intentId: 'topCategories' }],
      quickActions: [{ label: 'Open Reports', action: 'openReports', to: '/app/reports' }],
    };
  },

  async accountBalances(ctx) {
    const total = ctx.accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    return {
      icon: 'Landmark', tone: 'info', heading: 'Total Balance', headingValue: ctx.fmt(total),
      rows: ctx.accounts.map((a) => ({ label: a.name, value: ctx.fmt(a.balance || 0) })),
      followUps: [{ label: 'Cash flow forecast', intentId: 'cashFlowForecast' }],
      quickActions: [{ label: 'View Accounts', action: 'openAccounts', to: '/app/accounts' }],
    };
  },

  async savingsGoals(ctx) {
    const goals = ctx.userData.goals || [];
    if (!goals.length) {
      return { icon: 'Target', tone: 'info', text: "You don't have any savings goals yet.", quickActions: [{ label: 'Open Savings Goal', action: 'openGoals', to: '/app/goals' }] };
    }
    return {
      icon: 'Target', tone: 'info', heading: 'Savings Goals',
      rows: goals.map((g) => ({ label: g.name, value: `${ctx.fmt(g.saved)} / ${ctx.fmt(g.target)}`, tone: g.saved >= g.target ? 'success' : undefined })),
      followUps: FOLLOWUPS.goals,
      quickActions: [{ label: 'Open Savings Goal', action: 'openGoals', to: '/app/goals' }],
    };
  },

  async billsDueSoon(ctx) {
    const bills = ctx.bundle.upcomingBills30 || [];
    if (!bills.length) {
      return { icon: 'CalendarClock', tone: 'success', text: 'No bills due in the next 30 days.', quickActions: [{ label: 'View Bills', action: 'openBills', to: '/app/bills' }] };
    }
    return {
      icon: 'CalendarClock', tone: 'warning', heading: 'Bills Due Soon',
      rows: bills.slice(0, 8).map((b) => ({ label: `${b.name} · ${formatDate(b.dueDate)}`, value: ctx.fmt(b.amount) })),
      followUps: FOLLOWUPS.bills,
      quickActions: [{ label: 'View Bills', action: 'openBills', to: '/app/bills' }],
    };
  },

  async overBudget(ctx) {
    const over = ctx.budgetsWithSpent.filter((b) => b.limit > 0 && b.spent > b.limit);
    const predictions = ctx.bundle.budgetPredictions || [];
    if (!over.length && !predictions.length) {
      return { icon: 'ShieldCheck', tone: 'success', text: "You're not over budget in any category right now.", quickActions: [{ label: 'Open Budget', action: 'openBudgets', to: '/app/budgets' }] };
    }
    return {
      icon: 'AlertTriangle', tone: over.length ? 'danger' : 'warning', heading: over.length ? 'Over Budget' : 'On Pace to Exceed Budget',
      rows: over.length
        ? over.map((b) => ({ label: b.category?.name || 'Budget', value: `${ctx.fmt(b.spent)} / ${ctx.fmt(b.limit)}`, tone: 'danger' }))
        : predictions.map((p) => ({ label: p.categoryName, value: `Projected ${ctx.fmt(p.projected)} / ${ctx.fmt(p.limit)}`, tone: 'warning' })),
      followUps: FOLLOWUPS.spendingSummary,
      quickActions: [{ label: 'Open Budget', action: 'openBudgets', to: '/app/budgets' }],
    };
  },

  async upcomingRecurring(ctx) {
    const subs = ctx.bundle.subscriptions || [];
    const recurring = ctx.bundle.recurring || [];
    if (!subs.length && !recurring.length) {
      return { icon: 'Repeat', tone: 'info', text: 'No recurring bills or subscriptions detected yet.', quickActions: [{ label: 'View Bills', action: 'openBills', to: '/app/bills' }] };
    }
    return {
      icon: 'Repeat', tone: 'info', heading: 'Recurring & Subscriptions',
      rows: [...subs, ...recurring].slice(0, 8).map((p) => ({ label: `${p.vendor} · next ${formatDate(p.nextExpectedDate)}`, value: ctx.fmt(p.avgAmount) })),
      quickActions: [{ label: 'View Bills', action: 'openBills', to: '/app/bills' }],
    };
  },

  async howToSaveMore(ctx) {
    const savings = ctx.bundle.smartSavings;
    const recs = ctx.bundle.recommendations || [];
    const rows = [];
    if (savings && !savings.insufficientData) {
      rows.push({ label: 'Available to move to savings', value: ctx.fmt(savings.amount ?? 0), tone: 'success' });
    }
    return {
      icon: 'PiggyBank', tone: 'success', heading: 'Ways to Save More', rows,
      text: recs.length ? recs.slice(0, 3).map((r) => r.body || r.title).join(' ') : 'Keep logging transactions to unlock more tailored suggestions.',
      quickActions: [{ label: 'Open Dashboard', action: 'openDashboard', to: '/app/dashboard' }],
    };
  },

  async findDuplicates(ctx) {
    const dupes = ctx.bundle.duplicates || [];
    if (!dupes.length) {
      return { icon: 'Copy', tone: 'success', text: 'No possible duplicate transactions found.', quickActions: [{ label: 'View Transactions', action: 'openTransactions', to: '/app/transactions' }] };
    }
    return {
      icon: 'Copy', tone: 'warning', heading: 'Possible Duplicates',
      rows: dupes.map((d) => ({ label: `${d.vendor} · ${formatDate(d.firstDate)} & ${formatDate(d.secondDate)}`, value: ctx.fmt(d.amount), tone: 'warning' })),
      quickActions: [{ label: 'View Transactions', action: 'openTransactions', to: '/app/transactions' }],
    };
  },

  async whyExpensesIncreased(ctx) {
    const movers = (ctx.bundle.spendingInsights || []).filter((i) => i.pct > 0);
    if (!movers.length) {
      return { icon: 'ShieldCheck', tone: 'success', text: 'Nothing stands out — no category increased 15%+ vs. last month.' };
    }
    return {
      icon: 'TrendingUp', tone: 'danger', heading: 'Categories Driving the Increase',
      rows: movers.map((i) => ({ label: i.categoryName, value: `+${i.pct}%`, tone: 'danger' })),
      quickActions: [{ label: 'Open Reports', action: 'openReports', to: '/app/reports' }],
    };
  },

  async categorySpending(ctx, args = {}) {
    const { categories } = ctx.userData;
    const category = args.category
      ? categories.find((c) => c.name.toLowerCase() === String(args.category).toLowerCase()) || matchCategory(categories, args.category)
      : null;
    if (!category) {
      return { icon: 'HelpCircle', tone: 'info', text: `I couldn't find a category matching "${args.category || ''}".` };
    }
    const cur = currentMonth();
    const prev = previousMonth(cur);
    const curRange = monthRange(cur.year, cur.month);
    const prevRange = monthRange(prev.year, prev.month);
    const sumFor = (dateFrom, dateTo) => ctx.userData.transactions
      .filter((t) => t.type === 'expense' && t.categoryId === category.id && t.date >= dateFrom && t.date <= dateTo)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const curTotal = sumFor(curRange.dateFrom, curRange.dateTo);
    const prevTotal = sumFor(prevRange.dateFrom, prevRange.dateTo);
    const pct = prevTotal > 0 ? Math.round(((curTotal - prevTotal) / prevTotal) * 100) : null;
    return {
      icon: 'ShoppingBag', tone: pct === null ? 'info' : pct > 0 ? 'warning' : 'success',
      heading: `${category.name} Spending`, headingValue: ctx.fmt(curTotal),
      rows: [{ label: `Last month (${monthLabel(prev.year, prev.month)})`, value: ctx.fmt(prevTotal) }],
      note: pct === null ? undefined : `${Math.abs(pct)}% ${pct >= 0 ? 'more' : 'less'} than last month.`,
      followUps: FOLLOWUPS.category(category.name),
      quickActions: [{ label: 'View Transactions', action: 'openTransactions', to: '/app/transactions' }],
    };
  },

  async categoryTransactions(ctx, args = {}) {
    const category = matchCategory(ctx.userData.categories, args.category || '');
    if (!category) return { icon: 'HelpCircle', tone: 'info', text: `I couldn't find a category matching "${args.category || ''}".` };
    const cur = currentMonth();
    const { dateFrom, dateTo } = monthRange(cur.year, cur.month);
    const tx = ctx.userData.transactions.filter((t) => t.categoryId === category.id && t.date >= dateFrom && t.date <= dateTo);
    if (!tx.length) return { icon: 'Receipt', tone: 'info', text: `No ${category.name} transactions this month.` };
    return {
      icon: 'Receipt', tone: 'info', heading: `${category.name} Transactions`,
      table: { columns: TX_TABLE_COLUMNS, rows: txTableRows(ctx, tx.slice(0, 8)) },
      quickActions: [{ label: 'View Transactions', action: 'openTransactions', to: '/app/transactions' }],
    };
  },

  async monthlyIncome(ctx) {
    const cur = currentMonth();
    const { dateFrom, dateTo } = monthRange(cur.year, cur.month);
    const { income } = expenseTotalsForRange(ctx, dateFrom, dateTo);
    return {
      icon: 'Banknote', tone: 'success', heading: `Income (${monthLabel(cur.year, cur.month)})`, headingValue: ctx.fmt(income),
      quickActions: [{ label: 'Open Reports', action: 'openReports', to: '/app/reports' }],
    };
  },

  async cashFlowForecast(ctx) {
    const cf = ctx.bundle.cashFlow;
    if (!cf) return { icon: 'LineChart', tone: 'info', text: 'Not enough data yet to forecast cash flow.' };
    return {
      icon: 'LineChart', tone: 'info', heading: 'Cash Flow Forecast', headingValue: ctx.fmt(cf.current),
      rows: [
        { label: '7 days', value: ctx.fmt(cf.sevenDay) },
        { label: '30 days', value: ctx.fmt(cf.thirtyDay) },
        { label: `End of month (${cf.endOfMonthDays}d)`, value: ctx.fmt(cf.endOfMonth) },
      ],
      quickActions: [{ label: 'Open Dashboard', action: 'openDashboard', to: '/app/dashboard' }],
    };
  },

  async topCategories(ctx) {
    const rows = (ctx.bundle.topSpendingCategories || []).slice(0, 5);
    if (!rows.length) return { icon: 'PieChart', tone: 'info', text: 'No category spending recorded yet.' };
    return {
      icon: 'PieChart', tone: 'info', heading: 'Top Spending Categories',
      rows: rows.map((c) => ({ label: c.name, value: ctx.fmt(c.amount) })),
      quickActions: [{ label: 'Open Reports', action: 'openReports', to: '/app/reports' }],
    };
  },

  async healthReport(ctx) {
    const { score, grade, breakdown } = ctx.health;
    return {
      icon: 'ShieldCheck', tone: score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger',
      heading: `Financial Health · Grade ${grade || '—'}`, headingValue: `${score ?? '—'}/100`,
      text: (breakdown || []).map((b) => `${b.name}: ${b.note || ''}`).join('\n'),
      quickActions: [{ label: 'Open Dashboard', action: 'openDashboard', to: '/app/dashboard' }],
    };
  },

  async monthlySummary(ctx, args = {}) {
    const cur = currentMonth();
    const year = args.year || cur.year;
    const month = args.month ?? cur.month;
    const report = computeMonthlyAIReport(ctx.userData, ctx.accounts, year, month);
    return {
      icon: 'FileText', tone: 'info', heading: `Monthly Summary · ${monthLabel(year, month)}`, headingValue: ctx.fmt(report.expense ?? 0),
      rows: [
        { label: 'Income', value: ctx.fmt(report.income ?? 0) },
        { label: 'Savings', value: ctx.fmt(report.savings ?? 0) },
        ...(report.largestCategory ? [{ label: `Largest category: ${report.largestCategory.categoryName}`, value: ctx.fmt(report.largestCategory.amount) }] : []),
      ],
      note: report.achievements?.length ? `${report.achievements.length} budget win(s) this month.` : undefined,
      quickActions: [{ label: 'Open Reports', action: 'openReports', to: '/app/reports' }],
    };
  },

  async largestExpenses(ctx) {
    const cur = currentMonth();
    const { dateFrom, dateTo } = monthRange(cur.year, cur.month);
    const tx = ctx.userData.transactions.filter((t) => t.type === 'expense' && t.date >= dateFrom && t.date <= dateTo);
    const top = [...tx].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 5);
    if (!top.length) return { icon: 'AlertOctagon', tone: 'info', text: 'No expenses recorded this month.' };
    return {
      icon: 'AlertOctagon', tone: 'warning', heading: 'Largest Expenses This Month',
      table: { columns: TX_TABLE_COLUMNS, rows: txTableRows(ctx, top) },
      quickActions: [{ label: 'View Transactions', action: 'openTransactions', to: '/app/transactions' }],
    };
  },

  async monthExpenses(ctx, args = {}) {
    const cur = currentMonth();
    const year = args.year ?? cur.year;
    const month = args.month ?? cur.month;
    const { dateFrom, dateTo } = monthRange(year, month);
    const { expense, topCategories } = expenseTotalsForRange(ctx, dateFrom, dateTo);
    return {
      icon: 'Calendar', tone: 'info', heading: `${monthLabel(year, month)} Expenses`, headingValue: ctx.fmt(expense),
      rows: topCategories.map(([name, amount]) => ({ label: name, value: ctx.fmt(amount) })),
      quickActions: [{ label: 'View Transactions', action: 'openTransactions', to: '/app/transactions' }],
    };
  },

  async savingsAmount(ctx) {
    return {
      icon: 'PiggyBank', tone: 'success', heading: 'Saved So Far', headingValue: ctx.fmt(ctx.reportsSavings),
      note: `Savings rate: ${Math.round(ctx.reportsSavingsRate)}%`,
      quickActions: [{ label: 'Open Reports', action: 'openReports', to: '/app/reports' }],
    };
  },

  async noop() {
    return { text: 'Okay.' };
  },
};

function parseCompareMonthsArgs(text) {
  const mentions = findMonthMentions(text);
  if (mentions.length >= 2) return { a: mentions[0], b: mentions[1] };
  return {};
}
function parseSingleMonthArgs(text) {
  const mentions = findMonthMentions(text);
  return mentions[0] ? { year: mentions[0].year, month: mentions[0].month } : {};
}

// Ordered, most-specific-first — ported verbatim from intents.js's RULES.
const RULES = [
  { id: 'compareMonths', test: (l, t) => /compare|\bvs\.?\b|versus/.test(l) || findMonthMentions(t).length >= 2, args: (t) => parseCompareMonthsArgs(t) },
  { id: 'monthlySummary', test: (l) => /monthly.*summary/.test(l) },
  { id: 'healthReport', test: (l) => /health (report|score)|financial health/.test(l) },
  { id: 'topCategories', test: (l) => /top .*categories|spending by category/.test(l) },
  { id: 'cashFlowForecast', test: (l) => /cash flow/.test(l) },
  { id: 'monthlyIncome', test: (l) => /monthly income/.test(l) || (/income/.test(l) && /month/.test(l)) },
  { id: 'findDuplicates', test: (l) => /duplicate|unusual/.test(l) },
  { id: 'largestExpenses', test: (l) => /largest expense/.test(l) },
  { id: 'upcomingRecurring', test: (l) => /subscription/.test(l) || /recurring/.test(l) },
  { id: 'billsDueSoon', test: (l) => /(bills?.*(due|soon))|what bills/.test(l) },
  { id: 'overBudget', test: (l) => /over budget|budget.*over|budget recommendation|overspending|analy[sz]e.*budget|budget analysis/.test(l) },
  { id: 'whyExpensesIncreased', test: (l) => /why.*(expense|spending).*(increase|up|higher)|expenses increase/.test(l) },
  { id: 'savingsGoals', test: (l) => /saving(s)? goal/.test(l) },
  { id: 'savingsAmount', test: (l) => /how much (did|have) i sav/.test(l) },
  { id: 'howToSaveMore', test: (l) => /how (can|do) i save|save more money|reduce.*spending|cut.*spending|lower.*spending|spend less/.test(l) },
  { id: 'accountBalances', test: (l) => /account balance|balances?/.test(l) },
  { id: 'categorySpending', test: (l, t) => Boolean(findSynonymKeyInText(t)), args: (t) => ({ category: findSynonymKeyInText(t) }) },
  { id: 'monthExpenses', test: (l, t) => findMonthMentions(t).length === 1 && /(expense|spending)/.test(l), args: (t) => parseSingleMonthArgs(t) },
  { id: 'spendingSummary', test: (l) => /spending summary/.test(l) },
  { id: 'whereDidMoneyGo', test: (l) => /where.*(money|did).*go|where did my money go|analy[sz]e my spending|analy[sz]e my budget/.test(l) },
  // Broad safety net, deliberately last (lowest priority — every rule above
  // is more specific and always wins first): this is a rule-based matcher,
  // not a general NLU/LLM, so it can't understand truly arbitrary phrasing.
  // Rather than a bare "I don't understand" for any message that's clearly
  // finance-related but doesn't match a specific pattern, fall through to
  // the general spending breakdown — a relevant answer beats a dead end.
  { id: 'whereDidMoneyGo', test: (l) => /spend|expense|budget|money|financ/.test(l) },
];

function matchIntent(text) {
  const safeText = text || '';
  const lower = safeText.toLowerCase();
  for (const rule of RULES) {
    if (rule.test(lower, safeText)) return { id: rule.id, args: rule.args ? rule.args(safeText) : {} };
  }
  return null;
}

// The 8 prompts requested for the empty-state suggestion cards (mobile) /
// default follow-ups (fallback response) — kept here so both clients can
// stay in sync with what the engine can actually answer.
const SUGGESTED_QUESTIONS = [
  { label: 'Analyze my spending', intentId: 'whereDidMoneyGo' },
  { label: 'How can I save more money?', intentId: 'howToSaveMore' },
  { label: 'Show unusual expenses', intentId: 'findDuplicates' },
  { label: 'Budget recommendations', intentId: 'overBudget' },
  { label: 'Monthly financial summary', intentId: 'monthlySummary' },
  { label: 'Compare this month vs last month', intentId: 'compareMonths' },
  { label: 'Spending by category', intentId: 'topCategories' },
  { label: 'Subscription analysis', intentId: 'upcomingRecurring' },
];

const FALLBACK_RESPONSE = {
  text: "I'm not sure how to answer that yet. Try one of these:",
  followUps: SUGGESTED_QUESTIONS.slice(0, 4),
};

// Entry point — resolves a question (typed text, or a follow-up chip's
// explicit intentId) to a handler and returns its structured response.
async function answer({ userId, userData, currencySymbol, message, intentId, args }) {
  const resolved = intentId ? { id: intentId, args: args || {} } : matchIntent(message);
  if (!resolved || !HANDLERS[resolved.id]) return FALLBACK_RESPONSE;
  try {
    const ctx = await buildContext(userId, userData, currencySymbol);
    return await HANDLERS[resolved.id](ctx, resolved.args);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('assistantEngine.answer failed', err);
    return { text: 'Something went wrong pulling that up — please try again in a moment.' };
  }
}

module.exports = { answer, matchIntent, SUGGESTED_QUESTIONS };
