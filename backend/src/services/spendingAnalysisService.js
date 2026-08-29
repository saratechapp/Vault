const { iso, addDaysFromToday, round1, categoryIdByName, categorySpendForMonth } = require('./shared');

// Per top-level category, this month vs last month — flags categories that
// moved enough (both relatively and in absolute terms) to be worth a
// sentence, so a tiny category swinging 200% on ₹50 doesn't drown out a
// meaningful move in a big one.
function computeSpendingInsights(userData) {
  const now = new Date();
  const currMap = categorySpendForMonth(userData.transactions, userData.categories, now.getFullYear(), now.getMonth());
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMap = categorySpendForMonth(userData.transactions, userData.categories, prevDate.getFullYear(), prevDate.getMonth());
  const catIds = new Set([...currMap.keys(), ...prevMap.keys()]);
  const insights = [];
  catIds.forEach((id) => {
    if (!id) return;
    const curr = currMap.get(id) || 0;
    const prev = prevMap.get(id) || 0;
    if (prev < 200) return; // not enough history for a meaningful comparison
    const pct = ((curr - prev) / prev) * 100;
    if (Math.abs(pct) < 15 || Math.abs(curr - prev) < 200) return;
    const cat = userData.categories.find((c) => c.id === id);
    insights.push({ categoryId: id, categoryName: cat?.name || 'Uncategorized', pct: round1(pct), curr: Math.round(curr), prev: Math.round(prev) });
  });
  return insights.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 3);
}

// Same vendor + same amount + same account within 2 days is very likely a
// double entry (double-tap on save, re-imported CSV row, etc). Auto-posted
// bill transactions repeat monthly by design, so they're excluded — a real
// duplicate is two transactions close together in time, not a recurring one
// far apart.
function computeDuplicateAlerts(transactions) {
  const candidates = transactions.filter((t) => t.type !== 'transfer' && t.vendor && t.vendor.trim());
  const groups = new Map();
  candidates.forEach((t) => {
    const key = `${t.accountId}|${t.type}|${Math.abs(t.amount)}|${t.vendor.trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  });
  const alerts = [];
  groups.forEach((list) => {
    if (list.length < 2) return;
    const sorted = [...list].sort((a, b) => new Date(a.date) - new Date(b.date));
    for (let i = 1; i < sorted.length; i++) {
      const gapDays = Math.abs((new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / 86400000);
      if (gapDays <= 2 && !sorted[i].sourceBillId && !sorted[i - 1].sourceBillId) {
        alerts.push({
          id: `dup_${sorted[i - 1].id}_${sorted[i].id}`,
          vendor: sorted[i].vendor,
          amount: Math.abs(sorted[i].amount),
          firstDate: sorted[i - 1].date,
          secondDate: sorted[i].date,
          transactionIds: [sorted[i - 1].id, sorted[i].id],
        });
      }
    }
  });
  return alerts.slice(0, 10);
}

// Groups transactions by vendor + type and looks for a roughly-monthly
// cadence (20-40 day gaps) with a stable amount (<15% deviation) — that's
// "recurring" whether it's a subscription (Netflix), a fixed expense
// (rent, insurance) or income (salary). Subscriptions are the subset that
// are expenses, either already tagged to the Subscriptions category or
// small enough (<= 5,000) to look like a recurring service rather than a
// bill like rent.
// Beyond the Subscriptions category itself, a small set of well-known
// subscription-service names catches vendors a user filed under a different
// category (e.g. Netflix logged as "Entertainment"). Deliberately narrow —
// a regular monthly charge to an ordinary merchant (groceries, a cab app)
// should land in "recurring", not be mislabeled a subscription.
const SUBSCRIPTION_VENDOR_HINTS = [
  'netflix', 'spotify', 'prime video', 'amazon prime', 'hotstar', 'youtube premium',
  'apple music', 'apple one', 'icloud', 'disney', 'jiocinema', 'sonyliv', 'zee5',
  'audible', 'google one', 'gym membership', 'linkedin premium',
];
function computeRecurringPatterns(transactions, categories) {
  const subscriptionCategoryId = categoryIdByName(categories, 'Subscriptions');
  const candidates = transactions.filter((t) => t.type !== 'transfer' && t.vendor && t.vendor.trim());
  const groups = new Map();
  candidates.forEach((t) => {
    const key = `${t.type}|${t.vendor.trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  });
  const patterns = [];
  groups.forEach((list) => {
    if (list.length < 2) return;
    const sorted = [...list].sort((a, b) => new Date(a.date) - new Date(b.date));
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / 86400000);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (avgGap < 20 || avgGap > 40) return; // only ~monthly cadences count as recurring
    const amounts = sorted.map((t) => Math.abs(t.amount));
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const maxDeviation = avgAmount > 0 ? Math.max(...amounts.map((a) => Math.abs(a - avgAmount) / avgAmount)) : 0;
    if (maxDeviation > 0.15) return; // amount varies too much to call it recurring
    const last = sorted[sorted.length - 1];
    const nextExpected = new Date(last.date);
    nextExpected.setDate(nextExpected.getDate() + Math.round(avgGap));
    const daysUntil = Math.round((nextExpected - new Date()) / 86400000);
    const isSubscription = last.type === 'expense' && (last.categoryId === subscriptionCategoryId || SUBSCRIPTION_VENDOR_HINTS.some((hint) => last.vendor.toLowerCase().includes(hint)));
    // Price-change detection: this occurrence's amount vs. the average of
    // every occurrence before it — flags a subscription/bill that just went
    // up (or down) in price, distinct from computeRecurringPatterns' own
    // maxDeviation guard (which only rejects amounts too unstable to call
    // "recurring" at all; a one-off gradual price bump can still pass that
    // check while still being worth surfacing).
    const priorAmounts = amounts.slice(0, -1);
    const priorAvg = priorAmounts.length ? priorAmounts.reduce((s, a) => s + a, 0) / priorAmounts.length : null;
    const lastAmount = amounts[amounts.length - 1];
    const priceChange = priorAvg && Math.abs(lastAmount - priorAvg) / priorAvg >= 0.05
      ? { from: Math.round(priorAvg), to: Math.round(lastAmount), changePct: round1(((lastAmount - priorAvg) / priorAvg) * 100) }
      : null;
    patterns.push({
      vendor: last.vendor,
      type: last.type,
      categoryId: last.categoryId,
      avgAmount: Math.round(avgAmount),
      occurrences: sorted.length,
      lastDate: last.date,
      nextExpectedDate: iso(nextExpected),
      daysUntil,
      isSubscription,
      // Roughly-monthly cadence is already a precondition for "recurring"
      // above (20-40 day gaps), so avgAmount is a reasonable stand-in for
      // monthly cost without a second gap-based scaling step.
      monthlyCost: isSubscription ? Math.round(avgAmount) : null,
      annualCost: isSubscription ? Math.round(avgAmount * 12) : null,
      priceChange,
    });
  });
  // Possible duplicate subscriptions: two *different* vendor spellings that
  // both matched the same known-service hint (e.g. "Netflix" and
  // "Netflix.com") — deliberately not grouped by category, since two
  // unrelated subscriptions filed under the same "Subscriptions" category
  // are not duplicates of each other.
  const subscriptionGroups = new Map();
  patterns.forEach((p) => {
    if (!p.isSubscription) return;
    const hint = SUBSCRIPTION_VENDOR_HINTS.find((h) => p.vendor.toLowerCase().includes(h));
    if (!hint) return;
    if (!subscriptionGroups.has(hint)) subscriptionGroups.set(hint, []);
    subscriptionGroups.get(hint).push(p);
  });
  const duplicates = new Set();
  subscriptionGroups.forEach((group) => {
    if (new Set(group.map((p) => p.vendor.toLowerCase())).size > 1) group.forEach((p) => duplicates.add(p));
  });
  patterns.forEach((p) => { p.isDuplicate = duplicates.has(p); });
  return patterns.sort((a, b) => a.daysUntil - b.daysUntil);
}

// Trailing-90-day median expense amount as the baseline for "what's normal
// for this user" — a median resists being skewed by rent or other large
// one-offs the way a mean would. Anything in the last 7 days at least 3x
// that (and at least ₹1,000 above it, so a small base doesn't create noise)
// gets cited by name, amount and date instead of a generic "something's off."
// Vendors already recognized as a recurring pattern (rent, insurance, salary
// deductions, etc. — see computeRecurringPatterns) are excluded: a large
// payment that happens every month on schedule isn't "unusual," it's
// expected, which is exactly the distinction the doc's own worked example
// draws ("consistent with your recurring pattern").
function computeAnomalies(transactions, recurringVendors = new Set()) {
  const ninetyDaysAgo = addDaysFromToday(-90);
  const recentExpenses = transactions.filter((t) => t.type === 'expense' && new Date(t.date) >= ninetyDaysAgo);
  if (recentExpenses.length < 5) return [];
  const amounts = recentExpenses.map((t) => Math.abs(t.amount)).sort((a, b) => a - b);
  const mid = Math.floor(amounts.length / 2);
  const median = amounts.length % 2 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2;
  if (median <= 0) return [];
  const sevenDaysAgo = addDaysFromToday(-7);
  return recentExpenses
    .filter((t) => new Date(t.date) >= sevenDaysAgo)
    .filter((t) => !recurringVendors.has((t.vendor || '').trim().toLowerCase()))
    .filter((t) => Math.abs(t.amount) >= median * 3 && Math.abs(t.amount) - median >= 1000)
    .map((t) => ({
      transactionId: t.id,
      vendor: t.vendor,
      amount: Math.abs(t.amount),
      date: t.date,
      medianAmount: Math.round(median),
      multiple: round1(Math.abs(t.amount) / median),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

// A distinct, simpler signal from computeAnomalies: a flat percentile
// threshold over a trailing window, with no recurring-vendor exclusion — so
// a big-but-expected recurring payment (rent, insurance) still surfaces
// here even though computeAnomalies correctly excludes it there. These are
// deliberately complementary, not a duplicate of anomalies.
function computeLargeExpenseAlerts(userData, { lookbackDays = 90, recentDays = 30, percentile = 0.95 } = {}) {
  const since = addDaysFromToday(-lookbackDays);
  const expenses = userData.transactions.filter((t) => t.type === 'expense' && new Date(t.date) >= since);
  if (expenses.length < 5) return [];
  const amounts = expenses.map((t) => Math.abs(t.amount)).sort((a, b) => a - b);
  const threshold = amounts[Math.min(amounts.length - 1, Math.floor(amounts.length * percentile))];
  if (!(threshold > 0)) return [];
  const recentSince = addDaysFromToday(-recentDays);
  return expenses
    .filter((t) => new Date(t.date) >= recentSince && Math.abs(t.amount) >= threshold)
    .map((t) => ({
      transactionId: t.id,
      vendor: t.vendor,
      amount: Math.abs(t.amount),
      date: t.date,
      thresholdAmount: Math.round(threshold),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
}

function largestRecentExpense(transactions, days = 7) {
  const since = addDaysFromToday(-days);
  const recent = transactions.filter((t) => t.type === 'expense' && new Date(t.date) >= since);
  if (!recent.length) return null;
  return recent.reduce((max, t) => (Math.abs(t.amount) > Math.abs(max.amount) ? t : max));
}

module.exports = {
  computeSpendingInsights,
  computeDuplicateAlerts,
  computeRecurringPatterns,
  computeAnomalies,
  computeLargeExpenseAlerts,
  largestRecentExpense,
  SUBSCRIPTION_VENDOR_HINTS,
};
