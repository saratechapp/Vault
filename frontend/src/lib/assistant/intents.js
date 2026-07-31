import * as handlers from './handlers.js';
import { findMonthMentions } from './dateUtils.js';
import { findSynonymKeyInText } from './categoryMatch.js';

// The canned chips shown on the welcome screen — clicking one just sends its
// label as a chat message through the exact same free-text pipeline a typed
// question goes through (see matchIntent below), so there's only one code
// path to keep correct. Kept identical (same 8 labels, in the same order)
// to the mobile app's src/features/ask/data.ts SUGGESTED_PROMPTS and the
// backend's services/assistantEngine.js SUGGESTED_QUESTIONS — the "Ask AI"
// spec's explicit requirement that web and mobile show the same prompts.
// This only trims the *displayed* list; every other question below still
// answers correctly if typed (RULES/HANDLERS are unchanged and richer).
export const SUGGESTED_QUESTIONS = [
  { emoji: '💰', label: 'Analyze my spending' },
  { emoji: '📄', label: 'Monthly budget summary' },
  { emoji: '💡', label: 'How can I save more?' },
  { emoji: '💳', label: 'Upcoming bills' },
  { emoji: '📂', label: 'Top spending categories' },
  { emoji: '📈', label: 'Compare this month vs last month' },
  { emoji: '📉', label: 'Spending trends' },
  { emoji: '🔁', label: 'Subscription analysis' },
];

export const HANDLERS = {
  whereDidMoneyGo: handlers.whereDidMoneyGo,
  spendingSummary: handlers.spendingSummary,
  compareMonths: handlers.compareMonths,
  accountBalances: handlers.accountBalances,
  savingsGoals: handlers.savingsGoals,
  billsDueSoon: handlers.billsDueSoon,
  overBudget: handlers.overBudget,
  upcomingRecurring: handlers.upcomingRecurring,
  howToSaveMore: handlers.howToSaveMore,
  findDuplicates: handlers.findDuplicates,
  whyExpensesIncreased: handlers.whyExpensesIncreased,
  categorySpending: handlers.categorySpending,
  categoryTransactions: handlers.categoryTransactions,
  monthlyIncome: handlers.monthlyIncome,
  cashFlowForecast: handlers.cashFlowForecast,
  topCategories: handlers.topCategories,
  healthReport: handlers.healthReport,
  monthlySummary: handlers.monthlySummary,
  largestExpenses: handlers.largestExpenses,
  monthExpenses: handlers.monthExpenses,
  savingsAmount: handlers.savingsAmount,
  noop: async () => ({ text: 'Okay.' }),
};

// Ordered, most-specific-first. Each rule's `test` runs against the
// lower-cased message; the first match wins. `args` (optional) extracts
// whatever the handler needs straight from the original text.
const RULES = [
  { id: 'compareMonths', test: (l, t) => /compare|\bvs\.?\b|versus/.test(l) || findMonthMentions(t).length >= 2, args: (t) => handlers.parseCompareMonthsArgs(t) },
  { id: 'monthlySummary', test: (l) => /monthly.*summary/.test(l) },
  { id: 'healthReport', test: (l) => /health (report|score)|financial health/.test(l) },
  { id: 'topCategories', test: (l) => /top .*categories|spending by category/.test(l) },
  { id: 'cashFlowForecast', test: (l) => /cash flow/.test(l) },
  { id: 'monthlyIncome', test: (l) => /monthly income/.test(l) || (/income/.test(l) && /month/.test(l)) },
  { id: 'findDuplicates', test: (l) => /duplicate|unusual/.test(l) },
  { id: 'largestExpenses', test: (l) => /largest expense/.test(l) },
  { id: 'upcomingRecurring', test: (l) => /subscription/.test(l) || /recurring/.test(l) },
  { id: 'billsDueSoon', test: (l) => /(bills?.*(due|soon))|what bills|upcoming bills?|upcoming payments?|payments? due|due payments?|any payments?/.test(l) },
  { id: 'overBudget', test: (l) => /over budget|budget.*over|budget recommendation|overspending|analy[sz]e.*budget|budget analysis/.test(l) },
  { id: 'whyExpensesIncreased', test: (l) => /why.*(expense|spending).*(increase|up|higher)|expenses increase/.test(l) },
  { id: 'savingsGoals', test: (l) => /saving(s)? goal/.test(l) },
  { id: 'savingsAmount', test: (l) => /how much (did|have) i sav/.test(l) },
  { id: 'howToSaveMore', test: (l) => /how (can|do) i save|save more money|reduce.*spending|cut.*spending|lower.*spending|spend less/.test(l) },
  { id: 'accountBalances', test: (l) => /account balance|balances?/.test(l) },
  {
    id: 'categorySpending',
    test: (l, t) => Boolean(findSynonymKeyInText(t)),
    args: (t) => ({ category: findSynonymKeyInText(t) }),
  },
  { id: 'monthExpenses', test: (l, t) => findMonthMentions(t).length === 1 && /(expense|spending)/.test(l), args: (t) => handlers.parseSingleMonthArgs(t) },
  { id: 'spendingSummary', test: (l) => /spending summary/.test(l) },
  { id: 'whereDidMoneyGo', test: (l) => /where.*(money|did).*go|where did my money go|analy[sz]e my spending|analy[sz]e my budget/.test(l) },
  // Broad safety net, deliberately last — see assistantEngine.js's identical
  // comment for why this exists (rule-based matcher, not a general NLU/LLM).
  { id: 'whereDidMoneyGo', test: (l) => /spend|expense|budget|money|financ|payment|\bbill|income|saving|goal|debt|account|transaction|balance|recurring|subscription|categor/.test(l) },
];

export function matchIntent(text) {
  const safeText = text || '';
  const lower = safeText.toLowerCase();
  for (const rule of RULES) {
    if (rule.test(lower, safeText)) {
      return { id: rule.id, args: rule.args ? rule.args(safeText) : {} };
    }
  }
  return null;
}
