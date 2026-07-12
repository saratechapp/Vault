import { useEffect, useState } from 'react';
import { Grid, Paper, Typography, Box, Alert } from '@mui/material';
import { api } from '../../lib/api.js';
import { StatCard } from '../../components/StatCard.jsx';
import { SimpleLineChart } from '../../components/charts/SimpleLineChart.jsx';
import { SimpleBarChart } from '../../components/charts/SimpleBarChart.jsx';

// Executive Dashboard — every number here is real, queried from tables that
// actually exist (backend/routes/admin/dashboard.js). No CPU/RAM/queue/
// uptime widgets: this app has no monitoring infrastructure to report on
// (see the plan doc's "Explicitly Deferred" section).
export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [userGrowth, setUserGrowth] = useState([]);
  const [dauMau, setDauMau] = useState({ dau: [], mau: 0 });
  const [devices, setDevices] = useState([]);
  const [countries, setCountries] = useState([]);
  const [feedbackTrend, setFeedbackTrend] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/dashboard/overview'),
      api.get('/dashboard/user-growth'),
      api.get('/dashboard/dau-mau'),
      api.get('/dashboard/device-distribution'),
      api.get('/dashboard/country-distribution'),
      api.get('/dashboard/feedback-trend'),
    ])
      .then(([ov, growth, dm, dev, ctry, fb]) => {
        if (cancelled) return;
        setOverview(ov);
        setUserGrowth(growth);
        setDauMau(dm);
        setDevices(dev);
        setCountries(ctry.slice(0, 10));
        setFeedbackTrend(fb);
      })
      .catch((err) => !cancelled && setError(err.message || 'Could not load dashboard data.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const stats = [
    { label: 'Total users', value: overview?.totalUsers },
    { label: 'Active users (30d)', value: overview?.activeUsers },
    { label: 'New users today', value: overview?.newUsersToday },
    { label: 'Premium subscribers', value: overview?.premiumSubscribers },
    { label: 'Free users', value: overview?.freeUsers },
    { label: 'Suspended users', value: overview?.suspendedUsers, tone: overview?.suspendedUsers ? 'warning' : undefined },
    { label: 'Daily transactions', value: overview?.dailyTransactions },
    { label: 'Total budgets', value: overview?.totalBudgets },
    { label: 'AI requests today', value: overview?.aiRequestsToday },
    { label: 'Total feedback', value: overview?.totalFeedback },
    { label: 'Open feedback', value: overview?.openFeedback },
    { label: 'Critical feedback', value: overview?.criticalFeedback, tone: overview?.criticalFeedback ? 'danger' : undefined },
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>Dashboard</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2}>
        {stats.map((s) => (
          <Grid item xs={6} sm={4} md={3} key={s.label}>
            <StatCard label={s.label} value={s.value ?? 0} loading={loading} tone={s.tone} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>User growth (30d)</Typography>
            <SimpleLineChart data={userGrowth} xKey="date" yKey="count" />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Daily active users (30d) — MAU: {dauMau.mau}
            </Typography>
            <SimpleLineChart data={dauMau.dau} xKey="date" yKey="count" />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Feedback trend (30d)</Typography>
            <SimpleLineChart data={feedbackTrend} xKey="date" yKey="count" color="#dc2626" />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Device distribution (30d)</Typography>
            <SimpleBarChart data={devices} xKey="device" yKey="count" />
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Top countries</Typography>
            <SimpleBarChart data={countries} xKey="country" yKey="count" height={260} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
