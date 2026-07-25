const { buildMetrics } = require('./metricsService');
const { computeHealth } = require('./healthScoreEngine');
const { computeCashFlowForecast, computeSmartSavings, computeLowBalanceAlert } = require('./forecastService');
const { computeBudgetPredictions, computeUnusedBudgets, recommendBudgetAdjustments } = require('./budgetAnalysisService');
const {
  computeYearOverYear, computeAverageDailySpending, computeAverageMonthlySavings,
  computeWeekendVsWeekday, computeMostAndLeastExpensiveMonth,
  computeTopSpendingCategories, computeTopMerchants,
} = require('./cashFlowAnalysisService');
const {
  computeSpendingInsights, computeDuplicateAlerts, computeRecurringPatterns, computeAnomalies, computeLargeExpenseAlerts,
} = require('./spendingAnalysisService');
const { computeGoalInsights, computeGoalCompletionForecast, computeRequiredMonthlyContribution } = require('./goalAnalysisService');
const { upcomingBills, computeBillPaymentHistory } = require('./billAnalysisService');
const { computeDailySummary, computeWeeklySummary } = require('./financialInsightsService');
const { buildRecommendations } = require('./recommendationEngine');
const insightsCache = require('./cache');

// Extracted verbatim from GET /api/ai/insights' inline closure — pulled out
// so assistantEngine.js's chat handlers can share the exact same cached
// bundle instead of a second, possibly-drifting computation. A chat answer
// about spending can never numerically disagree with the Reports tab's
// AiInsightCard, since both now come from this one function under the same
// 'ai-insights' cache key/invalidation (insightsCache.touch, already called
// from every mutating route).
async function computeAiInsightsBundle(userId, userData, accounts) {
  return insightsCache.getOrCompute(userId, 'ai-insights', async () => {
    const metrics = buildMetrics(userData, accounts);
    const cashFlow = computeCashFlowForecast(userData, accounts);
    const budgetPredictions = computeBudgetPredictions(userData);
    const smartSavings = computeSmartSavings(userData, accounts);
    const patterns = computeRecurringPatterns(userData.transactions, userData.categories);
    const duplicates = computeDuplicateAlerts(userData.transactions);
    const recurringVendors = new Set(patterns.map((p) => p.vendor.trim().toLowerCase()));
    const anomalies = computeAnomalies(userData.transactions, recurringVendors);
    const spendingInsights = computeSpendingInsights(userData);
    const goalInsights = computeGoalInsights(userData);
    const dailySummary = computeDailySummary(userData, accounts, metrics, smartSavings, patterns, duplicates, anomalies);
    const unusedBudgets = computeUnusedBudgets(userData);
    const largeExpenses = computeLargeExpenseAlerts(userData);
    const lowBalanceAlert = computeLowBalanceAlert(userData, accounts);
    const requiredMonthlyContribution = computeRequiredMonthlyContribution(userData);
    const health = await insightsCache.getOrCompute(userId, 'health', () => computeHealth(userData, accounts));
    return {
      dailySummary,
      cashFlow,
      budgetPredictions,
      smartSavings,
      subscriptions: patterns.filter((p) => p.isSubscription),
      recurring: patterns.filter((p) => !p.isSubscription),
      duplicates,
      anomalies,
      spendingInsights,
      goalInsights,
      weeklySummary: computeWeeklySummary(userData, accounts),
      largeExpenses,
      unusedBudgets,
      budgetAdjustments: recommendBudgetAdjustments(userData),
      yearOverYear: computeYearOverYear(userData, accounts),
      averageDailySpending: computeAverageDailySpending(userData),
      averageMonthlySavings: computeAverageMonthlySavings(userData, accounts),
      weekendVsWeekday: computeWeekendVsWeekday(userData),
      monthlyExtremes: computeMostAndLeastExpensiveMonth(userData, accounts),
      topSpendingCategories: computeTopSpendingCategories(userData, { n: 5 }),
      topMerchants: computeTopMerchants(userData),
      goalCompletionForecast: computeGoalCompletionForecast(userData),
      requiredMonthlyContribution,
      lowBalanceAlert,
      billPaymentHistory: computeBillPaymentHistory(userData),
      upcomingBills30: upcomingBills(userData, { days: 30 }),
      recommendations: buildRecommendations({
        health, budgetPredictions, unusedBudgets, spendingInsights, largeExpenses,
        smartSavings, lowBalanceAlert, goalForecasts: requiredMonthlyContribution,
      }),
    };
  });
}

module.exports = { computeAiInsightsBundle };
