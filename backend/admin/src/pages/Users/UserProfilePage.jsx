import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Tabs, Tab, Paper, Grid, Chip, Button, Alert, Table, TableBody,
  TableCell, TableHead, TableRow, Avatar, Stack,
} from '@mui/material';
import { api } from '../../lib/api.js';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import { hasPermission } from '../../lib/permissions.js';

function Overview({ user }) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
          <Avatar src={user.avatar} sx={{ width: 72, height: 72, mx: 'auto', mb: 1 }}>{user.name?.[0]}</Avatar>
          <Typography variant="h6">{user.name}</Typography>
          <Typography variant="body2" color="text.secondary">{user.email}</Typography>
          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1.5 }}>
            <Chip size="small" label={user.plan || 'Free'} color={user.plan && user.plan !== 'Free' ? 'primary' : 'default'} />
            <Chip size="small" label={user.status || 'active'} color={user.status === 'suspended' ? 'error' : 'success'} variant="outlined" />
            {user.mfaEnrolled && <Chip size="small" label="MFA" color="success" variant="outlined" />}
          </Stack>
        </Paper>
      </Grid>
      <Grid item xs={12} md={8}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">Details</Typography>
          <Table size="small">
            <TableBody>
              {[
                ['Phone', user.phone || '—'],
                ['Country', user.country || 'Unknown'],
                ['Currency', `${user.currency} (${user.currencySymbol})`],
                ['Registered', user.memberSince || '—'],
                ['Last sign-in', user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : '—'],
                ['Health score', `${user.healthScore ?? 0} (${user.healthGrade || '—'})`],
                ['Has password', user.hasPassword ? 'Yes' : 'No (OAuth only)'],
              ].map(([label, value]) => (
                <TableRow key={label}>
                  <TableCell sx={{ color: 'text.secondary', width: 160 }}>{label}</TableCell>
                  <TableCell>{value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Grid>
    </Grid>
  );
}

function FinancialData({ userId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get(`/users/${userId}/data`).then(setData).catch((err) => setError(err.message));
  }, [userId]);
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;
  const counts = [
    ['Accounts', data.accounts?.length || 0],
    ['Transactions', data.transactions?.length || 0],
    ['Budgets', data.budgets?.length || 0],
    ['Bills', data.bills?.length || 0],
    ['Goals', data.goals?.length || 0],
    ['Debts', data.debts?.length || 0],
    ['Categories', data.categories?.length || 0],
  ];
  return (
    <Grid container spacing={2}>
      {counts.map(([label, value]) => (
        <Grid item xs={6} sm={4} md={3} key={label}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{value}</Typography>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

function LoginHistory({ userId }) {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    api.get(`/users/${userId}/logins`).then(setEvents).catch(() => {});
  }, [userId]);
  return (
    <Paper variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>When</TableCell>
            <TableCell>Method</TableCell>
            <TableCell>Device</TableCell>
            <TableCell>IP</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {events.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{new Date(e.createdAt).toLocaleString()}</TableCell>
              <TableCell><Chip size="small" label={e.method} /></TableCell>
              <TableCell>{e.device}</TableCell>
              <TableCell>{e.ip}</TableCell>
            </TableRow>
          ))}
          {events.length === 0 && (
            <TableRow><TableCell colSpan={4}><Typography color="text.secondary">No login history yet.</Typography></TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}

function Activity({ userId }) {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    api.get(`/audit-log?targetType=user&targetId=${userId}`).then(setLogs).catch(() => {});
  }, [userId]);
  return (
    <Paper variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>When</TableCell>
            <TableCell>Admin</TableCell>
            <TableCell>Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{new Date(l.createdAt).toLocaleString()}</TableCell>
              <TableCell>{l.adminName || '—'}</TableCell>
              <TableCell>{l.action}</TableCell>
            </TableRow>
          ))}
          {logs.length === 0 && (
            <TableRow><TableCell colSpan={3}><Typography color="text.secondary">No admin activity on this account.</Typography></TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}

const TABS = ['Overview', 'Financial Data', 'Login History', 'Activity'];

export default function UserProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { admin } = useAdminAuth();
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');

  function load() {
    api.get(`/users/${id}`).then(setUser).catch((err) => setError(err.message || 'Could not load this user.'));
  }
  useEffect(load, [id]);

  const canSuspend = hasPermission(admin, 'users', 'suspend');
  const canImpersonate = hasPermission(admin, 'users', 'impersonate');

  async function toggleSuspend() {
    await api.post(`/users/${id}/${user.status === 'suspended' ? 'activate' : 'suspend'}`);
    load();
  }
  async function impersonate() {
    const res = await api.post(`/users/${id}/impersonate`, {});
    if (res.actionLink) window.open(res.actionLink, '_blank', 'noopener');
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!user) return null;

  return (
    <Box>
      <Button onClick={() => navigate('/users')} sx={{ mb: 1 }}>← Back to users</Button>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{user.name || user.email}</Typography>
        <Stack direction="row" spacing={1}>
          {canImpersonate && <Button variant="outlined" onClick={impersonate}>Login as user</Button>}
          {canSuspend && (
            <Button variant="outlined" color={user.status === 'suspended' ? 'success' : 'error'} onClick={toggleSuspend}>
              {user.status === 'suspended' ? 'Activate' : 'Suspend'}
            </Button>
          )}
        </Stack>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        {TABS.map((t) => <Tab key={t} label={t} />)}
      </Tabs>

      {tab === 0 && <Overview user={user} />}
      {tab === 1 && <FinancialData userId={id} />}
      {tab === 2 && <LoginHistory userId={id} />}
      {tab === 3 && <Activity userId={id} />}
    </Box>
  );
}
