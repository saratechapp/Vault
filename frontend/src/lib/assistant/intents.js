import * as handlers from './handlers.js';
import { findMonthMentions } from './dateUtils.js';
import { findSynonymKeyInText } from './categoryMatch.js';

// The canned chips shown on the welcome screen — clicking one just sends its
// label as a chat message through the exact same free-text pipeline a typed
// question goes through (see matchIntent below), so there's only one code
// path to keep correct.
export const SUGGESTED_QUESTIONS = [
  { emoji: '💰', label: 'Where did my money go this month?' },
  { emoji: '📊', label: 'Show my spending summary' },
  { emoji: '📈', label: 'Compare June vs July' },
  { emoji: '🏦', label: 'Show account balances' },
  { emoji: '🎯', label: 'Show my savings goals' },
  { emoji: '💳', label: 'What bills are due soon?' },
  { emoji: '⚠️', label: 'Am I over budget?' },
  { emoji: '📅', label: 'Show upcoming recurring bills' },
  { emoji: '💡', label: 'How can I save more money?' },
  { emoji: '🔍', label: 'Find duplicate transactions' },
  { emoji: '📉', label: 'Why did expenses increase?' },
  { emoji: '🍔', label: 'Restaurant spending' },
  { emoji: '☕', label: 'Coffee spending' },
  { emoji: '🛒', label: 'Grocery expenses' },
  { emoji: '🚗', label: 'Transportation expenses' },
  { emoji: '📆', label: 'Monthly income' },
  { emoji: '💵', label: 'Cash flow forecast' },
  { emoji: '📂', label: 'Top spending categories' },
  { emoji: '🏆', label: 'Financial Health Report' },
  { emoji: '📄', label: 'Monthly Summary' },
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
  { id: 'monthlySummary', test: (l) => /monthly summary/.test(l) },
  { id: 'healthReport', test: (l) => /health (report|score)|financial health/.test(l) },
  { id: 'topCategories', test: (l) => /top .*categories/.test(l) },
  { id: 'cashFlowForecast', test: (l) => /cash flow/.test(l) },
  { id: 'monthlyIncome', test: (l) => /monthly income/.test(l) || (/income/.test(l) && /month/.test(l)) },
  { id: 'findDuplicates', test: (l) => /duplicate/.test(l) },
  { id: 'largestExpenses', test: (l) => /largest expense/.test(l) },
  { id: 'upcomingRecurring', test: (l) => /subscription/.test(l) || /recurring/.test(l) },
  { id: 'billsDueSoon', test: (l) => /(bills?.*(due|soon))|what bills/.test(l) },
  { id: 'overBudget', test: (l) => /over budget|budget.*over/.test(l) },
  { id: 'whyExpensesIncreased', test: (l) => /why.*(expense|spending).*(increase|up|higher)|expenses increase/.test(l) },
  { id: 'savingsGoals', test: (l) => /saving(s)? goal/.test(l) },
  { id: 'savingsAmount', test: (l) => /how much (did|have) i sav/.test(l) },
  { id: 'howToSaveMore', test: (l) => /how (can|do) i save|save more money/.test(l) },
  { id: 'accountBalances', test: (l) => /account balance|balances?/.test(l) },
  {
    id: 'categorySpending',
    test: (l, t) => Boolean(findSynonymKeyInText(t)),
    args: (t) => ({ category: findSynonymKeyInText(t) }),
  },
  { id: 'monthExpenses', test: (l, t) => findMonthMentions(t).length === 1 && /(expense|spending)/.test(l), args: (t) => handlers.parseSingleMonthArgs(t) },
  { id: 'spendingSummary', test: (l) => /spending summary/.test(l) },
  { id: 'whereDidMoneyGo', test: (l) => /where.*(money|did).*go|where did my money go/.test(l) },
];

export function matchIntent(text) {
  const lower = (text || '').toLowerCase();
  for (const rule of RULES) {
    if (rule.test(lower, text)) {
      return { id: rule.id, args: rule.args ? rule.args(text) : {} };
    }
  }
  return null;
}
