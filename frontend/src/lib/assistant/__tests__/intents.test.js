import { describe, it, expect, vi } from 'vitest';

// intents.js pulls in handlers.js -> api.js -> supabaseClient.js, which reads
// import.meta.env.VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY at module load and
// calls createClient(). Those env vars aren't set in the test environment,
// so stub them before the dynamic import below to avoid a hard failure while
// still exercising the real matchIntent()/RULES logic (no mocking of the
// intent-matching code itself).
vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

// Note: RULES itself is a module-private const in intents.js (not exported —
// only SUGGESTED_QUESTIONS, HANDLERS, and matchIntent are). Per the "test
// only what's actually exported" rule, RULES is exercised indirectly here
// through matchIntent's behavior across every distinct intent category
// rather than imported directly.
const { matchIntent } = await import('../intents.js');

describe('matchIntent', () => {
  const cases = [
    ['Compare June vs July', 'compareMonths'],
    ['June versus July', 'compareMonths'],
    ['Show my monthly summary', 'monthlySummary'],
    ['Give me my financial health report', 'healthReport'],
    ['What is my health score', 'healthReport'],
    ['Show my top spending categories', 'topCategories'],
    ['Show me my cash flow forecast', 'cashFlowForecast'],
    ['What is my monthly income', 'monthlyIncome'],
    ['Find duplicate transactions', 'findDuplicates'],
    ['What are my largest expenses this month', 'largestExpenses'],
    ['Show my upcoming recurring bills', 'upcomingRecurring'],
    ['Any subscriptions coming up', 'upcomingRecurring'],
    ['What bills are due soon', 'billsDueSoon'],
    ['Am I over budget', 'overBudget'],
    ['Why did my expenses increase', 'whyExpensesIncreased'],
    ['Show my savings goals', 'savingsGoals'],
    ['How much have I saved', 'savingsAmount'],
    ['How can I save more money', 'howToSaveMore'],
    ['Show account balances', 'accountBalances'],
    ['Grocery expenses', 'categorySpending'],
    ['Coffee spending', 'categorySpending'],
    ['Show my spending summary', 'spendingSummary'],
    ['Where did my money go this month', 'whereDidMoneyGo'],
  ];

  it.each(cases)('resolves %j to intent %s', (text, expectedId) => {
    const result = matchIntent(text);
    expect(result).not.toBeNull();
    expect(result.id).toBe(expectedId);
  });

  it('returns null when nothing matches', () => {
    expect(matchIntent('What is the weather today')).toBeNull();
  });

  it('returns null for empty text', () => {
    expect(matchIntent('')).toBeNull();
  });

  // Previously matchIntent(undefined) threw a TypeError instead of returning
  // null like matchIntent('') does, because the un-defaulted `text` was
  // passed through to rules (e.g. compareMonths -> findMonthMentions ->
  // text.toLowerCase()) after only `lower` had been null-guarded. Fixed in
  // matchIntent to guard `text` itself before it's used anywhere.
  it('returns null for undefined text instead of throwing', () => {
    expect(matchIntent(undefined)).toBeNull();
  });

  it('is case-insensitive', () => {
    const result = matchIntent('SHOW ACCOUNT BALANCES');
    expect(result.id).toBe('accountBalances');
  });

  it('extracts compareMonths args (a/b month mentions) from the original text', () => {
    const result = matchIntent('Compare June vs July');
    expect(result.id).toBe('compareMonths');
    expect(result.args.a).toBeDefined();
    expect(result.args.b).toBeDefined();
    expect(result.args.a.month).toBe(5); // June
    expect(result.args.b.month).toBe(6); // July
  });

  it('extracts a category arg for categorySpending intents', () => {
    const result = matchIntent('Coffee spending');
    expect(result.id).toBe('categorySpending');
    expect(result.args).toEqual({ category: 'coffee' });
  });

  it('prioritizes compareMonths when two distinct months are mentioned, even without the word "compare"', () => {
    const result = matchIntent('June and July numbers');
    expect(result.id).toBe('compareMonths');
  });

  it('resolves a single-month expense question to monthExpenses with parsed args', () => {
    const result = matchIntent('June expenses');
    expect(result.id).toBe('monthExpenses');
    expect(result.args.month).toBe(5);
  });

  it('rules are evaluated in order and the first match wins (compareMonths beats monthExpenses)', () => {
    // Two month mentions + "expense" wording would also satisfy monthExpenses'
    // pattern, but compareMonths is listed first in RULES and requires only
    // >=2 month mentions, so it should win.
    const result = matchIntent('June and July expenses');
    expect(result.id).toBe('compareMonths');
  });
});
