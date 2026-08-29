// Executive Dashboard — real metrics only, derived from tables that
// actually exist. No CPU/RAM/queue/uptime widgets: this app has no
// monitoring infrastructure to report on (see the plan's "Explicitly
// Deferred" section). Aggregation is done in JS after a plain row fetch,
// which is fine at this app's current scale; if `login_events`/`profiles`
// grow large, replace with a Postgres view/RPC rather than fetching full
// tables — flagged here, not solved now.
const express = require('express');
const { supabase } = require('../../supabaseClient');
const { requirePermission } = require('../../middleware/adminAuth');
const { ah } = require('../../lib/asyncHandler');

const router = express.Router();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoIso(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

router.get('/overview', requirePermission('dashboard', 'view'), ah(async (req, res) => {
  const today = todayStr();
  const [
    { count: totalUsers },
    { count: newUsersToday },
    { count: suspendedUsers },
    { data: planRows },
    { count: totalBudgets },
    { count: dailyTransactions },
    { count: totalExpensesLogged },
    { data: aiUsageToday },
    { count: totalFeedback },
    { count: openFeedback },
    { count: criticalFeedback },
    { data: activeUserRows },
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('member_since', today),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'suspended'),
    supabase.from('profiles').select('plan'),
    supabase.from('budgets').select('id', { count: 'exact', head: true }),
    supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('date', today),
    supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('type', 'expense'),
    supabase.from('ai_usage').select('count').eq('day', today),
    supabase.from('feedback').select('id', { count: 'exact', head: true }),
    supabase.from('feedback').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
    supabase.from('feedback').select('id', { count: 'exact', head: true }).eq('priority', 'urgent').in('status', ['open', 'in_progress']),
    // "Active" = at least one login event in the last 30 days.
    supabase.from('login_events').select('user_id').gte('created_at', daysAgoIso(30)),
  ]);

  const planMix = {};
  (planRows || []).forEach((r) => { planMix[r.plan || 'Unknown'] = (planMix[r.plan || 'Unknown'] || 0) + 1; });
  const premiumSubscribers = Object.entries(planMix).filter(([plan]) => plan !== 'Free').reduce((sum, [, n]) => sum + n, 0);
  const freeUsers = planMix.Free || 0;
  const activeUsers = new Set((activeUserRows || []).map((r) => r.user_id)).size;
  const aiRequestsToday = (aiUsageToday || []).reduce((sum, r) => sum + (r.count || 0), 0);

  res.json({
    totalUsers: totalUsers || 0,
    activeUsers,
    newUsersToday: newUsersToday || 0,
    suspendedUsers: suspendedUsers || 0,
    premiumSubscribers,
    freeUsers,
    planMix,
    totalBudgets: totalBudgets || 0,
    dailyTransactions: dailyTransactions || 0,
    totalExpensesLogged: totalExpensesLogged || 0,
    aiRequestsToday,
    totalFeedback: totalFeedback || 0,
    openFeedback: openFeedback || 0,
    criticalFeedback: criticalFeedback || 0,
  });
}));

// User signups per day, last 30 days.
router.get('/user-growth', requirePermission('dashboard', 'view'), ah(async (req, res) => {
  const { data, error } = await supabase.from('profiles').select('member_since').gte('member_since', daysAgoIso(30).slice(0, 10));
  if (error) throw error;
  const byDay = {};
  (data || []).forEach((r) => { byDay[r.member_since] = (byDay[r.member_since] || 0) + 1; });
  res.json(Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })));
}));

// Distinct logged-in users per day, last 30 days — backs both a DAU chart
// and (rolled up) an MAU figure.
router.get('/dau-mau', requirePermission('dashboard', 'view'), ah(async (req, res) => {
  const { data, error } = await supabase.from('login_events').select('user_id, created_at').gte('created_at', daysAgoIso(30));
  if (error) throw error;
  const byDay = {};
  const monthlySet = new Set();
  (data || []).forEach((r) => {
    const day = r.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = new Set();
    byDay[day].add(r.user_id);
    monthlySet.add(r.user_id);
  });
  const dau = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, set]) => ({ date, count: set.size }));
  res.json({ dau, mau: monthlySet.size });
}));

router.get('/device-distribution', requirePermission('dashboard', 'view'), ah(async (req, res) => {
  const { data, error } = await supabase.from('login_events').select('device').gte('created_at', daysAgoIso(30));
  if (error) throw error;
  const byDevice = {};
  (data || []).forEach((r) => { const d = r.device || 'Unknown'; byDevice[d] = (byDevice[d] || 0) + 1; });
  res.json(Object.entries(byDevice).map(([device, count]) => ({ device, count })));
}));

router.get('/country-distribution', requirePermission('dashboard', 'view'), ah(async (req, res) => {
  const { data, error } = await supabase.from('profiles').select('country');
  if (error) throw error;
  const byCountry = {};
  (data || []).forEach((r) => { const c = r.country || 'Unknown'; byCountry[c] = (byCountry[c] || 0) + 1; });
  res.json(Object.entries(byCountry).sort(([, a], [, b]) => b - a).map(([country, count]) => ({ country, count })));
}));

router.get('/feedback-trend', requirePermission('dashboard', 'view'), ah(async (req, res) => {
  const { data, error } = await supabase.from('feedback').select('created_at').gte('created_at', daysAgoIso(30));
  if (error) throw error;
  const byDay = {};
  (data || []).forEach((r) => { const day = r.created_at.slice(0, 10); byDay[day] = (byDay[day] || 0) + 1; });
  res.json(Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })));
}));

module.exports = router;
