const { iso, round1, numOr } = require('./shared');

// Goal-progress narration: this month's contribution total per goal, current
// percent complete, and — when a deadline is set and the goal isn't reached
// yet — how much is still needed and how many days remain. Pure rule-based
// (no external call), same convention as computeSpendingInsights /
// computeBudgetPredictions elsewhere: small functions over userData,
// returning structured objects the frontend renders via a type switch.
function computeGoalInsights(userData) {
  const now = new Date();
  const insights = [];
  (userData.goals || []).forEach((g) => {
    const contributions = userData.transactions.filter((t) => t.goalId === g.id);
    const monthTotal = contributions
      .filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    if (monthTotal > 0) {
      insights.push({ id: `goal_contrib_${g.id}`, type: 'goal_contribution_this_month', goalId: g.id, goalName: g.name, amount: Math.round(monthTotal) });
    }
    const pct = g.target > 0 ? (g.saved / g.target) * 100 : 0;
    if (pct > 0 && pct < 100) {
      insights.push({ id: `goal_pct_${g.id}`, type: 'goal_progress', goalId: g.id, goalName: g.name, pct: Math.round(pct) });
    }
    if (g.deadline && g.saved < g.target) {
      const daysLeft = Math.round((new Date(g.deadline) - now) / 86400000);
      if (daysLeft > 0) {
        insights.push({
          id: `goal_shortfall_${g.id}`, type: 'goal_deadline_shortfall', goalId: g.id, goalName: g.name,
          amount: Math.round(g.target - g.saved), deadline: g.deadline, daysLeft,
        });
      }
    }
  });
  return insights.slice(0, 6);
}

// Trailing-N-month average contribution rate per goal, projected forward at
// the same pace — genuinely new: computeGoalInsights above only reports
// *this* month's contribution and current %, never a pace-based forecast.
function computeGoalCompletionForecast(userData, { months = 3 } = {}) {
  const now = new Date();
  const forecasts = [];
  (userData.goals || []).forEach((g) => {
    if (g.saved >= g.target) return;
    const contributions = userData.transactions.filter((t) => t.goalId === g.id);
    let total = 0;
    for (let i = 0; i < months; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      total += contributions
        .filter((t) => { const d = new Date(t.date); return d >= monthStart && d <= monthEnd; })
        .reduce((s, t) => s + Math.abs(t.amount), 0);
    }
    const avgMonthlyContribution = total / months;
    const remaining = g.target - g.saved;
    if (!(avgMonthlyContribution > 0)) {
      forecasts.push({ goalId: g.id, goalName: g.name, insufficientData: true });
      return;
    }
    const monthsToComplete = remaining / avgMonthlyContribution;
    const projectedDate = new Date(now.getFullYear(), now.getMonth() + Math.ceil(monthsToComplete), now.getDate());
    forecasts.push({
      goalId: g.id,
      goalName: g.name,
      avgMonthlyContribution: Math.round(avgMonthlyContribution),
      remaining: Math.round(remaining),
      monthsToComplete: round1(monthsToComplete),
      projectedCompletionDate: iso(projectedDate),
    });
  });
  return forecasts;
}

// Required monthly contribution to hit a goal's own deadline, compared
// against what it's actually set to (monthlyContribution) — flags goals
// that are contributing less than the deadline needs. Days-based month
// length (daysLeft / 30) matches the same daysLeft convention
// computeGoalInsights already uses, rather than introducing calendar-month
// arithmetic just for this one function.
function computeRequiredMonthlyContribution(userData) {
  const now = new Date();
  const results = [];
  (userData.goals || []).forEach((g) => {
    if (!g.deadline || g.saved >= g.target) return;
    const daysLeft = Math.round((new Date(g.deadline) - now) / 86400000);
    if (daysLeft <= 0) return;
    const monthsLeft = Math.max(1, daysLeft / 30);
    const remaining = g.target - g.saved;
    const requiredMonthlyContribution = remaining / monthsLeft;
    const currentMonthlyContribution = numOr(g.monthlyContribution);
    const shortfall = requiredMonthlyContribution - currentMonthlyContribution;
    if (shortfall <= 0) return; // already on pace to hit the deadline
    results.push({
      goalId: g.id,
      goalName: g.name,
      requiredMonthlyContribution: Math.round(requiredMonthlyContribution),
      currentMonthlyContribution: Math.round(currentMonthlyContribution),
      shortfall: Math.round(shortfall),
      deadline: g.deadline,
      daysLeft,
    });
  });
  return results;
}

module.exports = {
  computeGoalInsights,
  computeGoalCompletionForecast,
  computeRequiredMonthlyContribution,
};
