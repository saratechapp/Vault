// ---------------------------------------------------------------------------
// small helpers shared across the analysis services (and, via server.js's
// destructured require, by non-analysis route handlers too) — single source
// of truth so nothing gets a second, possibly-drifting copy.
// ---------------------------------------------------------------------------
function iso(d) {
  return d.toISOString().slice(0, 10);
}
function sortTransactionsRecentFirst(list) {
  return list
    .map((t, i) => [t, i])
    .sort(([a, ai], [b, bi]) => new Date(b.date) - new Date(a.date) || bi - ai)
    .map(([t]) => t);
}
function addDaysFromToday(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function round1(n) {
  return Math.round(n * 10) / 10;
}
// `Number(x) || 0` shows up all over the insert/patch payload builders and
// analysis code to coerce a possibly-missing/blank numeric field to a safe
// default.
function numOr(value, fallback = 0) {
  return Number(value) || fallback;
}
function signAmount(type, amount) {
  const abs = Math.abs(numOr(amount));
  if (type === 'expense') return -abs;
  return abs; // income and transfer are stored positive
}
// Categories are now Postgres-generated UUIDs (not the old fixed string ids
// like 'cat_transfer'/'cat_subscriptions'), so anything that used to hardcode
// one of those ids has to resolve it by name against this user's own
// categories instead — the signup trigger (0001_init.sql) still seeds every
// new user with a 'Transfer' and a 'Subscriptions' category by that exact
// name, so this stays equivalent to the old hardcoded lookup.
function categoryIdByName(categories, name) {
  const cat = categories.find((c) => c.name === name);
  return cat ? cat.id : null;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function budgetWindow(budget) {
  const now = new Date();
  if (budget.period === 'custom' && budget.startDate) {
    return { start: new Date(budget.startDate), end: budget.endDate ? new Date(budget.endDate) : now };
  }
  if (budget.period === 'weekly') {
    const start = startOfWeek(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (budget.period === 'yearly') {
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
  }
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
}
function budgetTransactionsInWindow(budget, transactions, categories) {
  const catIds = new Set([budget.categoryId, ...categories.filter((c) => c.parentId === budget.categoryId).map((c) => c.id)]);
  const { start, end } = budgetWindow(budget);
  return transactions.filter((t) => t.type === 'expense' && catIds.has(t.categoryId)).filter((t) => {
    const d = new Date(t.date);
    return d >= start && d <= end;
  });
}
function computeBudgetSpent(budget, transactions, categories) {
  return budgetTransactionsInWindow(budget, transactions, categories).reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

function categorySpendForMonth(transactions, categories, year, month) {
  const topLevelIdOf = new Map(categories.map((c) => [c.id, c.parentId || c.id]));
  const map = new Map();
  transactions.forEach((t) => {
    if (t.type !== 'expense') return;
    const d = new Date(t.date);
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    const topId = topLevelIdOf.get(t.categoryId) || null;
    map.set(topId, (map.get(topId) || 0) + Math.abs(t.amount));
  });
  return map;
}

module.exports = {
  iso,
  sortTransactionsRecentFirst,
  addDaysFromToday,
  round1,
  numOr,
  signAmount,
  categoryIdByName,
  startOfWeek,
  budgetWindow,
  budgetTransactionsInWindow,
  computeBudgetSpent,
  categorySpendForMonth,
};
