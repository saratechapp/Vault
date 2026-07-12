const { sortTransactionsRecentFirst, round1 } = require('./shared');

// ---------------------------------------------------------------------------
// derived analytics — core ledger/rollup primitives shared by every other
// analysis service and by non-AI routes (/api/dashboard, /api/accounts,
// /api/categories, /api/reports).
// ---------------------------------------------------------------------------
// Generic ledger roll-up: given a signed "contribution" for each transaction
// (null if the transaction doesn't touch this entity), returns the running
// balance plus the previous-balance/last-transaction pair so the UI can show
// Previous Balance + Latest Transaction = Current Balance for any entity
// (account, category, or sub-category).
function computeLedger(transactions, opening, contributionFn) {
  let inflow = 0, outflow = 0, txnCount = 0;
  const applicable = [];
  transactions.forEach((t) => {
    const amt = contributionFn(t);
    if (amt === null || amt === undefined) return;
    txnCount++;
    if (amt >= 0) inflow += amt; else outflow += Math.abs(amt);
    applicable.push({ t, amt });
  });
  const balance = opening + inflow - outflow;
  const mostRecent = sortTransactionsRecentFirst(applicable.map((a) => a.t))[0];
  const lastEntry = mostRecent && applicable.find((a) => a.t === mostRecent);
  const lastTransactionAmount = lastEntry ? lastEntry.amt : 0;
  const lastTransactionDate = mostRecent ? mostRecent.date : null;
  return {
    balance, inflow, outflow, txnCount,
    previousBalance: balance - lastTransactionAmount,
    lastTransactionAmount,
    lastTransactionDate,
  };
}

function computeAccounts(userData) {
  const now = new Date();
  return userData.accounts.map((acc) => {
    const contributionFn = (t) => {
      if (t.type === 'transfer') {
        if (t.fromAccountId === acc.id) return -Math.abs(t.amount);
        if (t.toAccountId === acc.id) return Math.abs(t.amount);
        return null;
      }
      if (t.accountId === acc.id) return t.amount;
      return null;
    };
    const ledger = computeLedger(userData.transactions, acc.openingBalance, contributionFn);
    // Net movement so far this calendar month — drives the ↑/↓ trend arrow on
    // the account card. Deliberately "this month's net change" rather than a
    // percentage vs. last month: a % is meaningless/noisy near a zero or
    // small base (common for cash/wallet accounts), while a signed rupee
    // amount is unambiguous at any balance.
    const monthNet = userData.transactions.reduce((sum, t) => {
      const d = new Date(t.date);
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return sum;
      const amt = contributionFn(t);
      return amt === null || amt === undefined ? sum : sum + amt;
    }, 0);
    return { ...acc, ...ledger, monthNet: Math.round(monthNet) };
  });
}

// Unlike an account (a store of money whose balance nets inflow against
// outflow), a category/sub-category is an activity bucket: its "available
// amount" is the running total of everything ever posted to it, so every
// transaction — income or expense — adds its magnitude to the total. Parent
// categories roll up the same way budgets do: a parent's total includes its
// own transactions plus every sub-category's, while a sub-category's total
// is scoped to just its own transactions.
function computeCategories(userData) {
  const { categories, transactions } = userData;
  return categories.map((cat) => {
    const childIds = cat.parentId ? [] : categories.filter((c) => c.parentId === cat.id).map((c) => c.id);
    const ids = new Set([cat.id, ...childIds]);
    const ledger = computeLedger(transactions, 0, (t) => (ids.has(t.categoryId) ? Math.abs(t.amount) : null));
    return { ...cat, ...ledger };
  });
}

// "Savings" here means money actually set aside — either moved into a
// savings-type account (a transfer from, say, Salary Account to Short-Term
// Savings), or any record the user explicitly tagged "Savings"/"Investment" when
// adding it (e.g. an expense-type payment into a mutual fund, which has no
// dedicated account type of its own). Transferring back out of a savings
// account nets against it, so a withdrawal that same month reduces the
// savings figure instead of being invisible like all other transfers.
function buildSpendingTrend(transactions, months = 7, accounts = []) {
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: d.toLocaleDateString('en-US', { month: 'short' }), income: 0, expense: 0, savings: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  const savingsAccountIds = new Set(accounts.filter((a) => a.type === 'savings').map((a) => a.id));
  transactions.forEach((t) => {
    const d = new Date(t.date);
    const b = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (!b) return;
    const tagged = (t.labels || []).some((l) => ['savings', 'investment'].includes(String(l).toLowerCase()));
    if (t.type === 'income') {
      b.income += t.amount;
      if (tagged) b.savings += t.amount;
    } else if (t.type === 'expense') {
      b.expense += Math.abs(t.amount);
      if (tagged) b.savings += Math.abs(t.amount);
    } else if (t.type === 'transfer') {
      let counted = false;
      if (savingsAccountIds.has(t.toAccountId)) { b.savings += Math.abs(t.amount); counted = true; }
      if (savingsAccountIds.has(t.fromAccountId)) { b.savings -= Math.abs(t.amount); counted = true; }
      if (!counted && tagged) b.savings += Math.abs(t.amount);
    }
  });
  return buckets.map(({ key, ...rest }) => rest);
}

// The Cash flow chart itself is driven purely by the four quick tags a user
// can attach when adding a record (Expenditure / Protection / Income /
// Investment) — a transaction contributes to a line only if it carries that
// exact tag, regardless of its type or account. Untagged activity doesn't
// show up here at all; it's a deliberate view of tagged money movement, not
// a substitute for the account-level income/expense totals used elsewhere.
const TAG_TREND_KEYS = ['Expenditure', 'Protection', 'Income', 'Investment'];
function buildTagTrend(transactions, months = 7) {
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const bucket = { key: `${d.getFullYear()}-${d.getMonth()}`, month: d.toLocaleDateString('en-US', { month: 'short' }) };
    TAG_TREND_KEYS.forEach((tag) => { bucket[tag.toLowerCase()] = 0; });
    buckets.push(bucket);
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  const tagLookup = new Map(TAG_TREND_KEYS.map((tag) => [tag.toLowerCase(), tag.toLowerCase()]));
  transactions.forEach((t) => {
    const d = new Date(t.date);
    const b = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (!b) return;
    (t.labels || []).forEach((l) => {
      const key = tagLookup.get(String(l).toLowerCase());
      if (key) b[key] += Math.abs(t.amount);
    });
  });
  return buckets.map(({ key, ...rest }) => rest);
}

// Every expense rolls up to its top-level category — a transaction booked to
// a sub-category (e.g. "Groceries") counts toward its parent ("Food &
// Dining"), and one booked straight to a top-level category counts toward
// itself — so the total always matches actual spend for the month with
// nothing double-counted. Anything with no valid category left (deleted
// category, never set) lands in a synthetic "Other" bucket instead of being
// silently dropped.
function buildCategorySpend(transactions, categories) {
  const now = new Date();
  const topLevelIdOf = new Map(categories.map((c) => [c.id, c.parentId || c.id]));
  const map = new Map();
  transactions.forEach((t) => {
    if (t.type !== 'expense') return;
    const d = new Date(t.date);
    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return;
    const topId = topLevelIdOf.get(t.categoryId) || null;
    map.set(topId, (map.get(topId) || 0) + Math.abs(t.amount));
  });
  return [...map.entries()].map(([categoryId, amount]) => ({ categoryId, amount })).sort((a, b) => b.amount - a.amount);
}

function buildMetrics(userData, accounts) {
  const trend = buildSpendingTrend(userData.transactions, 2);
  const [prev, curr] = trend;
  const monthlyIncome = curr.income;
  const monthlyExpense = curr.expense;
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0;
  const pct = (a, b) => (b > 0 ? ((a - b) / b) * 100 : 0);
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalDebt = (userData.debts || []).reduce((s, d) => s + d.balance, 0);
  const netWorth = totalBalance - totalDebt;
  return {
    totalBalance, totalBalanceDelta: 0,
    monthlyIncome, monthlyIncomeDelta: round1(pct(monthlyIncome, prev.income)),
    monthlyExpense, monthlyExpenseDelta: round1(pct(monthlyExpense, prev.expense)),
    savingsRate: round1(savingsRate), savingsRateDelta: 0,
    netWorth, netWorthDelta: 0,
  };
}

module.exports = {
  computeLedger,
  computeAccounts,
  computeCategories,
  buildSpendingTrend,
  buildTagTrend,
  buildCategorySpend,
  buildMetrics,
  TAG_TREND_KEYS,
};
