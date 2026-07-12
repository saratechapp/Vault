// One function per answerable question. Every handler reads from data the
// app already fetches through existing authenticated endpoints (see
// dataStore.js) and returns a plain, UI-agnostic response object:
//   { heading?, headingValue?, text?, icon?, tone?,
//     rows?: [{label, value, tone?}], table?: {columns, rows},
//     note?, quickActions?: [{label, to}], followUps?: [{label, intentId, args?}] }
// `icon` is a lucide-react icon name (resolved via the existing DynamicIcon
// component) and `tone` is success/warning/danger/info/neutral — the same
// convention as TYPE_ICON/TONE_ICON_CLASS in pages/dashboard/aiWidgets.jsx.
// ChatMessage.jsx is the only thing that knows how to render this shape.
import { assistantData } from './dataStore.js';
import { formatCurrency, formatDate } from '../api.js';
import { currentMonth, previousMonth, monthRange, monthLabel, findMonthMentions } from './dateUtils.js';
import { matchCategory } from './categoryMatch.js';

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
  bills: [
    { label: 'Show upcoming recurring bills', intentId: 'upcomingRecurring' },
    { label: 'Open Bills', intentId: 'noop' },
  ],
  goals: [
    { label: 'How can I save more?', intentId: 'howToSaveMore' },
    { label: 'Show account balances', intentId: 'accountBalances' },
  ],
};

const TX_TABLE_COLUMNS = [
  { key: 'vendor', label: 'Vendor' },
  { key: 'date', label: 'Date' },
  { key: 'amount', label: 'Amount', align: 'right' },
];

// Short "Jul 5" form (not the user's full date-format preference) — these
// tables are always scoped to "this month," so the year is redundant and
// the space saved keeps a 3-column table readable inside a narrow chat bubble.
function shortDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function txTableRows(transactions) {
  return transactions.map((t) => ({ id: t.id, vendor: t.vendor || 'Unknown', date: shortDate(t.date), amount: formatCurrency(Math.abs(t.amount)) }));
}

async function expenseTotalsForRange(dateFrom, dateTo) {
  const [transactions, categories] = await Promise.all([
    assistantData.transactions({ dateFrom, dateTo }),
    assistantData.categories(),
  ]);
  const catName = (id) => categories.find((c) => c.id === id)?.name || 'Uncategorized';
  const byCategory = new Map();
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.type === 'income') income += Math.abs(t.amount);
    else if (t.type === 'expense') {
      expense += Math.abs(t.amount);
      const name = catName(t.categoryId);
      byCategory.set(name, (byCategory.get(name) || 0) + Math.abs(t.amount));
    }
  }
  const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { income, expense, topCategories, transactions };
}

export async function whereDidMoneyGo() {
  const { month, year } = currentMonth();
  const { dateFrom, dateTo } = monthRange(year, month);
  const [{ expense, topCategories }, insights] = await Promise.all([
    expenseTotalsForRange(dateFrom, dateTo),
    assistantData.insights(),
  ]);
  const biggestMover = (insights.spendingInsights || [])[0];
  return {
    icon: 'Wallet',
    tone: 'info',
    heading: 'Total Expenses',
    headingValue: formatCurrency(expense),
    rows: topCategories.map(([name, amount]) => ({ label: name, value: formatCurrency(amount) })),
    note: biggestMover
      ? `${biggestMover.categoryName} ${biggestMover.pct > 0 ? 'increased' : 'decreased'} by ${Math.abs(biggestMover.pct)}% compared to last month.`
      : undefined,
    followUps: FOLLOWUPS.spendingSummary,
    quickActions: [{ label: 'View Transactions', to: '/app/transactions' }],
  };
}

export async function spendingSummary() {
  const reports = await assistantData.reports();
  return {
    icon: 'PieChart',
    tone: 'info',
    heading: 'This Period',
    text: `Income ${formatCurrency(reports.totals.income)} · Expenses ${formatCurrency(reports.totals.expense)}`,
    rows: (reports.categorySpend || []).slice(0, 6).map((c) => ({ label: c.name, value: formatCurrency(c.value ?? c.amount ?? 0) })),
    note: `Savings rate: ${Math.round(reports.savingsRate)}%`,
    followUps: FOLLOWUPS.spendingSummary,
    quickActions: [{ label: 'Open Reports', to: '/app/reports' }],
  };
}

export async function compareMonths(args = {}) {
  let a = args.a;
  let b = args.b;
  if (!a || !b) {
    const cur = currentMonth();
    a = cur;
    b = previousMonth(cur);
  }
  const rangeA = monthRange(a.year, a.month);
  const rangeB = monthRange(b.year, b.month);
  const [totalsA, totalsB] = await Promise.all([
    expenseTotalsForRange(rangeA.dateFrom, rangeA.dateTo),
    expenseTotalsForRange(rangeB.dateFrom, rangeB.dateTo),
  ]);
  const diff = totalsA.expense - totalsB.expense;
  const pct = totalsB.expense > 0 ? Math.round((diff / totalsB.expense) * 100) : 0;
  return {
    icon: 'BarChart3',
    tone: diff > 0 ? 'warning' : diff < 0 ? 'success' : 'info',
    heading: `${monthLabel(a.year, a.month)} vs ${monthLabel(b.year, b.month)}`,
    rows: [
      { label: `${monthLabel(a.year, a.month)} expenses`, value: formatCurrency(totalsA.expense) },
      { label: `${monthLabel(b.year, b.month)} expenses`, value: formatCurrency(totalsB.expense) },
    ],
    note: diff === 0
      ? 'Spending was flat between the two months.'
      : `You spent ${formatCurrency(Math.abs(diff))} (${Math.abs(pct)}%) ${diff > 0 ? 'more' : 'less'} in ${monthLabel(a.year, a.month)} than ${monthLabel(b.year, b.month)}.`,
    followUps: [{ label: 'Top spending categories', intentId: 'topCategories' }],
    quickActions: [{ label: 'Open Reports', to: '/app/reports' }],
  };
}

export async function accountBalances() {
  const accounts = await assistantData.accounts();
  const total = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  return {
    icon: 'Landmark',
    tone: 'info',
    heading: 'Total Balance',
    headingValue: formatCurrency(total),
    rows: accounts.map((a) => ({ label: a.name, value: formatCurrency(a.balance || 0) })),
    followUps: [{ label: 'Cash flow forecast', intentId: 'cashFlowForecast' }],
    quickActions: [{ label: 'View Accounts', to: '/app/accounts' }],
  };
}

export async function savingsGoals() {
  const goals = await assistantData.goals();
  if (!goals.length) {
    return {
      icon: 'Target',
      tone: 'neutral',
      text: "You don't have any savings goals yet.",
      quickActions: [{ label: 'Open Savings Goal', to: '/app/goals' }],
    };
  }
  return {
    icon: 'Target',
    tone: 'info',
    heading: 'Savings Goals',
    rows: goals.map((g) => ({
      label: g.name,
      value: `${formatCurrency(g.saved)} / ${formatCurrency(g.target)}`,
      tone: g.saved >= g.target ? 'success' : undefined,
    })),
    followUps: FOLLOWUPS.goals,
    quickActions: [{ label: 'Open Savings Goal', to: '/app/goals' }],
  };
}

export async function billsDueSoon() {
  const insights = await assistantData.insights();
  const bills = insights.upcomingBills30 || [];
  if (!bills.length) {
    return { icon: 'CalendarClock', tone: 'success', text: 'No bills due in the next 30 days.', quickActions: [{ label: 'View Bills', to: '/app/bills' }] };
  }
  return {
    icon: 'CalendarClock',
    tone: 'warning',
    heading: 'Bills Due Soon',
    rows: bills.slice(0, 8).map((b) => ({ label: `${b.name} · ${formatDate(b.dueDate)}`, value: formatCurrency(b.amount) })),
    followUps: FOLLOWUPS.bills,
    quickActions: [{ label: 'View Bills', to: '/app/bills' }],
  };
}

export async function overBudget() {
  const [insights, budgets] = await Promise.all([assistantData.insights(), assistantData.budgets()]);
  const over = budgets.filter((b) => b.limit > 0 && b.spent > b.limit);
  const predictions = insights.budgetPredictions || [];
  if (!over.length && !predictions.length) {
    return { icon: 'ShieldCheck', tone: 'success', text: "You're not over budget in any category right now.", quickActions: [{ label: 'Open Budget', to: '/app/budgets' }] };
  }
  return {
    icon: 'AlertTriangle',
    tone: over.length ? 'danger' : 'warning',
    heading: over.length ? 'Over Budget' : 'On Pace to Exceed Budget',
    rows: over.length
      ? over.map((b) => ({ label: b.category?.name || 'Budget', value: `${formatCurrency(b.spent)} / ${formatCurrency(b.limit)}`, tone: 'danger' }))
      : predictions.map((p) => ({ label: p.categoryName, value: `Projected ${formatCurrency(p.projected)} / ${formatCurrency(p.limit)}`, tone: 'warning' })),
    followUps: FOLLOWUPS.spendingSummary,
    quickActions: [{ label: 'Open Budget', to: '/app/budgets' }],
  };
}

export async function upcomingRecurring() {
  const insights = await assistantData.insights();
  const subs = insights.subscriptions || [];
  const recurring = insights.recurring || [];
  if (!subs.length && !recurring.length) {
    return { icon: 'Repeat', tone: 'neutral', text: 'No recurring bills or subscriptions detected yet.', quickActions: [{ label: 'View Bills', to: '/app/bills' }] };
  }
  return {
    icon: 'Repeat',
    tone: 'info',
    heading: 'Recurring & Subscriptions',
    rows: [...subs, ...recurring].slice(0, 8).map((p) => ({ label: `${p.vendor} · next ${formatDate(p.nextExpectedDate)}`, value: formatCurrency(p.avgAmount) })),
    quickActions: [{ label: 'View Bills', to: '/app/bills' }],
  };
}

export async function howToSaveMore() {
  const insights = await assistantData.insights();
  const savings = insights.smartSavings;
  const recs = insights.recommendations || [];
  const lines = [];
  if (savings && !savings.insufficientData) {
    lines.push({ label: 'Available to move to savings', value: formatCurrency(savings.availableToSave ?? savings.amount ?? 0), tone: 'success' });
  }
  return {
    icon: 'PiggyBank',
    tone: 'success',
    heading: 'Ways to Save More',
    rows: lines,
    text: recs.length ? recs.slice(0, 3).map((r) => r.body || r.title).join(' ') : 'Keep logging transactions to unlock more tailored suggestions.',
    quickActions: [{ label: 'Open Dashboard', to: '/app/dashboard' }],
  };
}

export async function findDuplicates() {
  const insights = await assistantData.insights();
  const dupes = insights.duplicates || [];
  if (!dupes.length) {
    return { icon: 'Copy', tone: 'success', text: 'No possible duplicate transactions found.', quickActions: [{ label: 'View Transactions', to: '/app/transactions' }] };
  }
  return {
    icon: 'Copy',
    tone: 'warning',
    heading: 'Possible Duplicates',
    rows: dupes.map((d) => ({ label: `${d.vendor} · ${formatDate(d.firstDate)} & ${formatDate(d.secondDate)}`, value: formatCurrency(d.amount), tone: 'warning' })),
    quickActions: [{ label: 'View Transactions', to: '/app/transactions' }],
  };
}

export async function whyExpensesIncreased() {
  const insights = await assistantData.insights();
  const movers = (insights.spendingInsights || []).filter((i) => i.pct > 0);
  if (!movers.length) {
    return { icon: 'ShieldCheck', tone: 'success', text: "Nothing stands out — no category increased 15%+ vs. last month." };
  }
  return {
    icon: 'TrendingUp',
    tone: 'danger',
    heading: 'Categories Driving the Increase',
    rows: movers.map((i) => ({ label: i.categoryName, value: `+${i.pct}%`, tone: 'danger' })),
    quickActions: [{ label: 'Open Reports', to: '/app/reports' }],
  };
}

export async function categorySpending(args = {}) {
  const categories = await assistantData.categories();
  const category = args.category
    ? categories.find((c) => c.name.toLowerCase() === String(args.category).toLowerCase()) || matchCategory(categories, args.category)
    : null;
  if (!category) {
    return { icon: 'HelpCircle', tone: 'neutral', text: `I couldn't find a category matching "${args.category || ''}".` };
  }
  const cur = currentMonth();
  const prev = previousMonth(cur);
  const curRange = monthRange(cur.year, cur.month);
  const prevRange = monthRange(prev.year, prev.month);
  const [curTx, prevTx] = await Promise.all([
    assistantData.transactions({ category: category.id, dateFrom: curRange.dateFrom, dateTo: curRange.dateTo, type: 'expense' }),
    assistantData.transactions({ category: category.id, dateFrom: prevRange.dateFrom, dateTo: prevRange.dateTo, type: 'expense' }),
  ]);
  const sum = (list) => list.reduce((s, t) => s + Math.abs(t.amount), 0);
  const curTotal = sum(curTx);
  const prevTotal = sum(prevTx);
  const pct = prevTotal > 0 ? Math.round(((curTotal - prevTotal) / prevTotal) * 100) : null;
  return {
    icon: 'ShoppingBag',
    tone: pct === null ? 'info' : pct > 0 ? 'warning' : 'success',
    heading: `${category.name} Spending`,
    headingValue: formatCurrency(curTotal),
    rows: [{ label: `Last month (${monthLabel(prev.year, prev.month)})`, value: formatCurrency(prevTotal) }],
    note: pct === null ? undefined : `${Math.abs(pct)}% ${pct >= 0 ? 'more' : 'less'} than last month.`,
    followUps: FOLLOWUPS.category(category.name),
    quickActions: [{ label: 'View Transactions', to: '/app/transactions' }],
  };
}

export async function categoryTransactions(args = {}) {
  const categories = await assistantData.categories();
  const category = matchCategory(categories, args.category || '');
  if (!category) return { icon: 'HelpCircle', tone: 'neutral', text: `I couldn't find a category matching "${args.category || ''}".` };
  const cur = currentMonth();
  const { dateFrom, dateTo } = monthRange(cur.year, cur.month);
  const tx = await assistantData.transactions({ category: category.id, dateFrom, dateTo });
  if (!tx.length) return { icon: 'Receipt', tone: 'neutral', text: `No ${category.name} transactions this month.` };
  return {
    icon: 'Receipt',
    tone: 'info',
    heading: `${category.name} Transactions`,
    table: { columns: TX_TABLE_COLUMNS, rows: txTableRows(tx.slice(0, 8)) },
    quickActions: [{ label: 'View Transactions', to: '/app/transactions' }],
  };
}

export async function monthlyIncome() {
  const cur = currentMonth();
  const { dateFrom, dateTo } = monthRange(cur.year, cur.month);
  const { income } = await expenseTotalsForRange(dateFrom, dateTo);
  return {
    icon: 'Banknote',
    tone: 'success',
    heading: `Income (${monthLabel(cur.year, cur.month)})`,
    headingValue: formatCurrency(income),
    quickActions: [{ label: 'Open Reports', to: '/app/reports' }],
  };
}

export async function cashFlowForecast() {
  const insights = await assistantData.insights();
  const cf = insights.cashFlow;
  if (!cf) return { icon: 'LineChart', tone: 'neutral', text: 'Not enough data yet to forecast cash flow.' };
  return {
    icon: 'LineChart',
    tone: 'info',
    heading: 'Cash Flow Forecast',
    headingValue: formatCurrency(cf.current),
    rows: [
      { label: '7 days', value: formatCurrency(cf.sevenDay) },
      { label: '30 days', value: formatCurrency(cf.thirtyDay) },
      { label: `End of month (${cf.endOfMonthDays}d)`, value: formatCurrency(cf.endOfMonth) },
    ],
    quickActions: [{ label: 'Open Dashboard', to: '/app/dashboard' }],
  };
}

export async function topCategories() {
  const insights = await assistantData.insights();
  const rows = (insights.topSpendingCategories || []).slice(0, 5);
  if (!rows.length) return { icon: 'PieChart', tone: 'neutral', text: 'No category spending recorded yet.' };
  return {
    icon: 'PieChart',
    tone: 'info',
    heading: 'Top Spending Categories',
    rows: rows.map((c) => ({ label: c.categoryName || c.name, value: formatCurrency(c.amount ?? c.total ?? 0) })),
    quickActions: [{ label: 'Open Reports', to: '/app/reports' }],
  };
}

export async function healthReport() {
  const dashboard = await assistantData.dashboard();
  const breakdown = dashboard.healthBreakdown || [];
  const score = dashboard.healthScore ?? 0;
  return {
    icon: 'ShieldCheck',
    tone: score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger',
    heading: `Financial Health · Grade ${dashboard.healthGrade || '—'}`,
    headingValue: `${dashboard.healthScore ?? '—'}/100`,
    // Each factor's note is a full sentence, not a short number — rendered
    // as report-style lines (heading: sentence) rather than the label/value
    // row layout used elsewhere, which truncates long labels next to long values.
    text: breakdown.map((b) => `${b.name}: ${b.note || ''}`).join('\n'),
    quickActions: [{ label: 'Open Dashboard', to: '/app/dashboard' }],
  };
}

export async function monthlySummary(args = {}) {
  const cur = currentMonth();
  const year = args.year || cur.year;
  const month = args.month ?? cur.month;
  const report = await assistantData.monthlyReport(`${year}-${month + 1}`);
  return {
    icon: 'FileText',
    tone: 'info',
    heading: `Monthly Summary · ${monthLabel(year, month)}`,
    headingValue: formatCurrency(report.totals?.expense ?? 0),
    rows: (report.categorySpend || []).slice(0, 6).map((c) => ({ label: c.name, value: formatCurrency(c.value ?? c.amount ?? 0) })),
    note: report.narrative || undefined,
    quickActions: [{ label: 'Open Reports', to: '/app/reports' }],
  };
}

export async function largestExpenses() {
  const cur = currentMonth();
  const { dateFrom, dateTo } = monthRange(cur.year, cur.month);
  const tx = await assistantData.transactions({ type: 'expense', dateFrom, dateTo });
  const top = [...tx].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 5);
  if (!top.length) return { icon: 'AlertOctagon', tone: 'neutral', text: 'No expenses recorded this month.' };
  return {
    icon: 'AlertOctagon',
    tone: 'warning',
    heading: 'Largest Expenses This Month',
    table: { columns: TX_TABLE_COLUMNS, rows: txTableRows(top) },
    quickActions: [{ label: 'View Transactions', to: '/app/transactions' }],
  };
}

export function parseCompareMonthsArgs(text) {
  const mentions = findMonthMentions(text);
  if (mentions.length >= 2) return { a: mentions[0], b: mentions[1] };
  return {};
}

export function parseSingleMonthArgs(text) {
  const mentions = findMonthMentions(text);
  return mentions[0] ? { year: mentions[0].year, month: mentions[0].month } : {};
}

export async function monthExpenses(args = {}) {
  const cur = currentMonth();
  const year = args.year ?? cur.year;
  const month = args.month ?? cur.month;
  const { dateFrom, dateTo } = monthRange(year, month);
  const { expense, topCategories: cats } = await expenseTotalsForRange(dateFrom, dateTo);
  return {
    icon: 'Calendar',
    tone: 'info',
    heading: `${monthLabel(year, month)} Expenses`,
    headingValue: formatCurrency(expense),
    rows: cats.map(([name, amount]) => ({ label: name, value: formatCurrency(amount) })),
    quickActions: [{ label: 'View Transactions', to: '/app/transactions' }],
  };
}

export async function savingsAmount() {
  const reports = await assistantData.reports();
  return {
    icon: 'PiggyBank',
    tone: 'success',
    heading: 'Saved So Far',
    headingValue: formatCurrency(reports.savings),
    note: `Savings rate: ${Math.round(reports.savingsRate)}%`,
    quickActions: [{ label: 'Open Reports', to: '/app/reports' }],
  };
}
