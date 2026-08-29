import { useEffect, useMemo, useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import {
  Box, Typography, Tabs, Tab, Paper, Grid, Chip, Button, Alert, Switch,
  FormControlLabel, TextField, MenuItem, Stack, Divider, Snackbar,
  Table, TableBody, TableCell, TableHead, TableRow, IconButton,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { api } from '../../lib/api.js';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import { hasPermission } from '../../lib/permissions.js';

const STATUS_COLOR = {
  FREE_ACCESS: 'default',
  FREE_TRIAL: 'primary',
  ACTIVE: 'success',
  EXPIRED: 'warning',
  CANCELLED: 'default',
};

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

// Preview: a trial started right now would end this far out.
function addMonthsPreview(months) {
  const d = new Date();
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, daysInMonth));
  return d;
}

function SettingsTab({ canManage }) {
  const [settings, setSettings] = useState(null);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [enabledCurrencies, setEnabledCurrencies] = useState([]);
  const [form, setForm] = useState({
    trialEnabled: false, trialDurationMonths: 1, enforcementEnabled: false, defaultCurrency: 'INR',
  });

  function load() {
    Promise.all([
      api.get('/subscriptions/settings'),
      api.get('/subscriptions/overview'),
      api.get('/subscriptions/prices'),
    ])
      .then(([s, o, p]) => {
        setSettings(s);
        setOverview(o);
        setEnabledCurrencies((p.rows || []).filter((r) => r.enabled).map((r) => r.currency));
        setForm({
          trialEnabled: !!s.trialEnabled,
          trialDurationMonths: s.trialDurationMonths || 1,
          enforcementEnabled: !!s.enforcementEnabled,
          defaultCurrency: s.defaultCurrency || 'INR',
        });
        setDirty(false);
      })
      .catch((err) => setError(err.message || 'Could not load subscription settings.'));
  }

  useEffect(load, []);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const updated = await api.put('/subscriptions/settings', {
        trialEnabled: form.trialEnabled,
        trialDurationMonths: Number(form.trialDurationMonths),
        enforcementEnabled: form.enforcementEnabled,
        defaultCurrency: form.defaultCurrency,
      });
      setSettings(updated);
      setForm({
        trialEnabled: !!updated.trialEnabled,
        trialDurationMonths: updated.trialDurationMonths,
        enforcementEnabled: !!updated.enforcementEnabled,
        defaultCurrency: updated.defaultCurrency || 'INR',
      });
      setDirty(false);
      setSaved(true);
      api.get('/subscriptions/overview').then(setOverview).catch(() => {});
    } catch (err) {
      setError(err.message || 'Could not save. Only the Super Admin can change these settings.');
    } finally {
      setSaving(false);
    }
  }

  if (error && !settings) return <Alert severity="error">{error}</Alert>;
  if (!settings) return null;

  const previewEnd = addMonthsPreview(Number(form.trialDurationMonths) || 1);
  const counts = overview?.counts || {};

  return (
    <Stack spacing={3}>
      {!canManage && (
        <Alert severity="info">
          You can view subscription settings. Only the Super Admin can change them.
        </Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={1.5}>
        {['FREE_ACCESS', 'FREE_TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED'].map((k) => (
          <Grid item key={k}>
            <Chip
              label={`${k.replace('_', ' ')}: ${counts[k] ?? 0}`}
              color={STATUS_COLOR[k]}
              variant={k === 'FREE_ACCESS' || k === 'CANCELLED' ? 'outlined' : 'filled'}
              size="small"
            />
          </Grid>
        ))}
        {overview?.unresolved ? (
          <Grid item>
            <Chip label={`Not yet resolved: ${overview.unresolved}`} variant="outlined" size="small" />
          </Grid>
        ) : null}
      </Grid>

      <Paper variant="outlined" sx={{ p: 3, maxWidth: 560 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>Free Trial</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          When ON, every newly registered user automatically gets a free trial. Existing
          users (registered before you switched this on) keep free access and are never
          locked out.
        </Typography>

        <FormControlLabel
          control={(
            <Switch
              checked={form.trialEnabled}
              disabled={!canManage || saving}
              onChange={(e) => { setForm((f) => ({ ...f, trialEnabled: e.target.checked })); setDirty(true); }}
            />
          )}
          label={form.trialEnabled ? 'Enforcement ON' : 'Enforcement OFF'}
        />

        <TextField
          select fullWidth size="small" label="Free trial duration" sx={{ mt: 2 }}
          value={form.trialDurationMonths}
          disabled={!canManage || saving}
          onChange={(e) => { setForm((f) => ({ ...f, trialDurationMonths: e.target.value })); setDirty(true); }}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <MenuItem key={n} value={n}>{n} {n === 1 ? 'month' : 'months'}</MenuItem>
          ))}
        </TextField>

        <Alert severity="info" sx={{ mt: 2 }}>
          A user signing up today would get a trial ending <strong>{fmtDate(previewEnd.toISOString())}</strong>.
        </Alert>

        <Divider sx={{ my: 2 }} />
        <Typography variant="caption" color="text.secondary" component="div">
          {settings.enforcementStartedAt
            ? `Enforcement active since ${fmtDate(settings.enforcementStartedAt)}. This is the grandfather cutoff and does not change if you toggle the switch off and on again.`
            : 'Enforcement has never been switched on. Turning it on now sets the grandfather cutoff to this moment.'}
        </Typography>
        {settings.updatedAt && (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
            Last updated {fmtDate(settings.updatedAt)}.
          </Typography>
        )}

      </Paper>

      <Paper variant="outlined" sx={{ p: 3, maxWidth: 560 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>Subscription enforcement</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Independent of the free trial. When ON, an expired trial is asked to choose a paid
          plan. It does not lock anyone out yet — there is no payment layer — it only firms up
          the copy on the Subscription page.
        </Typography>

        <FormControlLabel
          control={(
            <Switch
              checked={form.enforcementEnabled}
              disabled={!canManage || saving}
              onChange={(e) => { setForm((f) => ({ ...f, enforcementEnabled: e.target.checked })); setDirty(true); }}
            />
          )}
          label={form.enforcementEnabled ? 'Enforcement ON' : 'Enforcement OFF'}
        />

        <TextField
          select fullWidth size="small" label="Default currency" sx={{ mt: 2 }}
          helperText="Used when a visitor's currency can't be detected or isn't priced."
          value={enabledCurrencies.includes(form.defaultCurrency) ? form.defaultCurrency : ''}
          disabled={!canManage || saving || enabledCurrencies.length === 0}
          onChange={(e) => { setForm((f) => ({ ...f, defaultCurrency: e.target.value })); setDirty(true); }}
        >
          {enabledCurrencies.map((c) => (
            <MenuItem key={c} value={c}>{c}</MenuItem>
          ))}
        </TextField>

        <Box sx={{ mt: 2 }}>
          <Button variant="contained" disabled={!canManage || saving || !dirty} onClick={save}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </Box>
      </Paper>

      <Snackbar open={saved} autoHideDuration={3000} onClose={() => setSaved(false)} message="Subscription settings saved" />
    </Stack>
  );
}

function UsersTab() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(paginationModel.page + 1),
      pageSize: String(paginationModel.pageSize),
      search,
    });
    api.get(`/subscriptions/users?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          memberSince: r.memberSince,
          status: r.subscription?.status || 'FREE_ACCESS',
          type: r.subscription?.type || 'FREE_ACCESS',
          trialEndDate: r.subscription?.trialEndDate || null,
          daysRemaining: r.subscription?.daysRemaining ?? 0,
        })));
        setTotal(res.total);
        setError('');
      })
      .catch((err) => !cancelled && setError(err.message || 'Could not load subscriptions.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [paginationModel, search]);

  const columns = useMemo(() => [
    { field: 'name', headerName: 'User', flex: 1, minWidth: 140 },
    { field: 'email', headerName: 'Email', flex: 1.2, minWidth: 200 },
    {
      field: 'status', headerName: 'Status', width: 140,
      renderCell: (p) => <Chip size="small" label={String(p.value).replace('_', ' ')} color={STATUS_COLOR[p.value] || 'default'} />,
    },
    { field: 'type', headerName: 'Type', width: 130, renderCell: (p) => String(p.value || '').replace('_', ' ') },
    {
      field: 'trialEndDate', headerName: 'Trial ends', width: 150,
      renderCell: (p) => fmtDate(p.value),
    },
    { field: 'memberSince', headerName: 'Registered', width: 130 },
  ], []);

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TextField
        size="small" label="Search name, email" value={search}
        onChange={(e) => { setSearch(e.target.value); setPaginationModel((m) => ({ ...m, page: 0 })); }}
        sx={{ minWidth: 280, mb: 2 }}
      />
      <Box sx={{ height: 600, bgcolor: 'background.paper', borderRadius: 2 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          rowCount={total}
          loading={loading}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
        />
      </Box>
    </Box>
  );
}

function PriceRow({ row, isDefault, canManage, onSaved, onDeleted }) {
  const [monthly, setMonthly] = useState(String(row.monthlyPrice));
  const [yearly, setYearly] = useState(String(row.yearlyPrice));
  const [enabled, setEnabled] = useState(!!row.enabled);
  const [busy, setBusy] = useState(false);
  const dirty =
    Number(monthly) !== row.monthlyPrice || Number(yearly) !== row.yearlyPrice || enabled !== !!row.enabled;

  async function save() {
    setBusy(true);
    try {
      await api.put(`/subscriptions/prices/${row.currency}`, {
        monthlyPrice: Number(monthly), yearlyPrice: Number(yearly), enabled,
      });
      onSaved();
    } catch (err) {
      window.alert(err.message || 'Could not save price.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove ${row.currency} pricing?`)) return;
    setBusy(true);
    try {
      await api.delete(`/subscriptions/prices/${row.currency}`);
      onDeleted();
    } catch (err) {
      window.alert(err.message || 'Could not delete.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <TableRow>
      <TableCell sx={{ fontWeight: 600 }}>
        {row.currency}{isDefault && <Chip label="default" size="small" sx={{ ml: 1 }} />}
      </TableCell>
      <TableCell>
        <TextField
          type="number" size="small" value={monthly} disabled={!canManage || busy}
          onChange={(e) => setMonthly(e.target.value)} sx={{ width: 110 }}
          inputProps={{ min: 0, step: '0.01' }}
        />
      </TableCell>
      <TableCell>
        <TextField
          type="number" size="small" value={yearly} disabled={!canManage || busy}
          onChange={(e) => setYearly(e.target.value)} sx={{ width: 110 }}
          inputProps={{ min: 0, step: '0.01' }}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={enabled} disabled={!canManage || busy}
          onChange={(e) => setEnabled(e.target.checked)}
        />
      </TableCell>
      <TableCell align="right">
        <Button size="small" variant="contained" disabled={!canManage || busy || !dirty} onClick={save}>
          Save
        </Button>
        <IconButton
          size="small" color="error" disabled={!canManage || busy || isDefault} onClick={remove}
          sx={{ ml: 1 }} aria-label={`Delete ${row.currency}`}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

function PricingTab({ canManage }) {
  const [rows, setRows] = useState(null);
  const [migrated, setMigrated] = useState(true);
  const [defaultCurrency, setDefaultCurrency] = useState('INR');
  const [addable, setAddable] = useState([]);
  const [error, setError] = useState('');
  const [add, setAdd] = useState({ currency: '', monthly: '', yearly: '' });
  const [addBusy, setAddBusy] = useState(false);

  function load() {
    api.get('/subscriptions/prices')
      .then((res) => {
        setRows(res.rows || []);
        setMigrated(res.migrated !== false);
        setDefaultCurrency(res.defaultCurrency || 'INR');
        setAddable(res.addable || []);
        setError('');
      })
      .catch((err) => setError(err.message || 'Could not load pricing.'));
  }
  useEffect(load, []);

  async function addCurrency() {
    if (!add.currency) return;
    setAddBusy(true);
    try {
      await api.put(`/subscriptions/prices/${add.currency}`, {
        monthlyPrice: Number(add.monthly) || 0,
        yearlyPrice: Number(add.yearly) || 0,
        enabled: true,
      });
      setAdd({ currency: '', monthly: '', yearly: '' });
      load();
    } catch (err) {
      window.alert(err.message || 'Could not add currency.');
    } finally {
      setAddBusy(false);
    }
  }

  if (error && !rows) return <Alert severity="error">{error}</Alert>;
  if (!rows) return null;

  if (!migrated) {
    return (
      <Alert severity="warning" sx={{ maxWidth: 720 }}>
        Subscription pricing isn’t set up in the database yet. Apply the{' '}
        <code>0026_subscription_pricing.sql</code> migration in the Supabase SQL editor, then
        reload this page. Until then the Subscription page shows “plans are being finalised”.
      </Alert>
    );
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      {!canManage && (
        <Alert severity="info">You can view pricing. Only the Super Admin can change it.</Alert>
      )}
      <Alert severity="info">
        Prices are fixed per market — never converted from INR by an exchange rate. Live FX is
        only a reference when you decide a number. Changing a price affects new purchases only;
        existing subscriptions keep their purchased price.
      </Alert>

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Currency</TableCell>
              <TableCell>Monthly</TableCell>
              <TableCell>Yearly</TableCell>
              <TableCell>Enabled</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <PriceRow
                key={r.currency}
                row={r}
                isDefault={r.currency === defaultCurrency}
                canManage={canManage}
                onSaved={load}
                onDeleted={load}
              />
            ))}
          </TableBody>
        </Table>
      </Paper>

      {canManage && addable.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Add a currency</Typography>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <TextField
              select size="small" label="Currency" sx={{ minWidth: 160 }}
              value={add.currency}
              onChange={(e) => setAdd((a) => ({ ...a, currency: e.target.value }))}
            >
              {addable.map((c) => (
                <MenuItem key={c.code} value={c.code}>{c.code} — {c.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              type="number" size="small" label="Monthly" sx={{ width: 120 }}
              value={add.monthly} onChange={(e) => setAdd((a) => ({ ...a, monthly: e.target.value }))}
              inputProps={{ min: 0, step: '0.01' }}
            />
            <TextField
              type="number" size="small" label="Yearly" sx={{ width: 120 }}
              value={add.yearly} onChange={(e) => setAdd((a) => ({ ...a, yearly: e.target.value }))}
              inputProps={{ min: 0, step: '0.01' }}
            />
            <Button variant="contained" disabled={!add.currency || addBusy} onClick={addCurrency}>
              Add
            </Button>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

export default function SubscriptionsPage() {
  const { admin } = useAdminAuth();
  const [tab, setTab] = useState(0);
  const canManage = !!admin?.isSuperAdmin || hasPermission(admin, 'subscriptions', 'manage');

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>Subscriptions</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Settings" />
        <Tab label="Pricing" />
        <Tab label="Users" />
      </Tabs>
      {tab === 0 && <SettingsTab canManage={canManage} />}
      {tab === 1 && <PricingTab canManage={canManage} />}
      {tab === 2 && <UsersTab />}
    </Box>
  );
}
