import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Typography, Grid, Paper, TextField, MenuItem, Chip, Alert } from '@mui/material';
import { api } from '../../lib/api.js';
import { StatCard } from '../../components/StatCard.jsx';

const STATUS_COLOR = {
  open: 'warning', assigned: 'info', in_progress: 'info', waiting_for_user: 'warning',
  testing: 'info', resolved: 'success', closed: 'default', reopened: 'error',
};
const STATUS_OPTIONS = ['open', 'assigned', 'in_progress', 'waiting_for_user', 'testing', 'resolved', 'closed', 'reopened'];
const CATEGORY_OPTIONS = [
  'bug', 'feature_request', 'suggestion', 'complaint', 'performance', 'payment_issue',
  'ai_assistant', 'voice_entry', 'ui_ux', 'sync_issue', 'security', 'billing', 'translation', 'general_message', 'other',
];
const PRIORITY_COLOR = { low: 'default', normal: 'default', high: 'warning', urgent: 'error' };

export default function FeedbackList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [overview, setOverview] = useState(null);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard/overview').then(setOverview).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(paginationModel.page + 1), pageSize: String(paginationModel.pageSize), status, priority, category,
    });
    api.get(`/feedback?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setTotal(res.total);
        setError('');
      })
      .catch((err) => !cancelled && setError(err.message || 'Could not load feedback.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [paginationModel, status, priority, category]);

  const columns = [
    { field: 'subject', headerName: 'Subject', flex: 1.4, minWidth: 200 },
    { field: 'userEmail', headerName: 'User', flex: 1, minWidth: 160 },
    { field: 'category', headerName: 'Type', width: 130 },
    {
      field: 'priority', headerName: 'Priority', width: 110,
      renderCell: (p) => <Chip size="small" label={p.value} color={PRIORITY_COLOR[p.value] || 'default'} />,
    },
    {
      field: 'status', headerName: 'Status', width: 130,
      renderCell: (p) => <Chip size="small" label={p.value} color={STATUS_COLOR[p.value] || 'default'} variant="outlined" />,
    },
    {
      field: 'createdAt', headerName: 'Submitted', width: 160,
      valueFormatter: (p) => new Date(p.value).toLocaleDateString(),
    },
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>Feedback</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}><StatCard label="Total feedback" value={overview?.totalFeedback ?? 0} /></Grid>
        <Grid item xs={6} sm={3}><StatCard label="Open" value={overview?.openFeedback ?? 0} tone={overview?.openFeedback ? 'warning' : undefined} /></Grid>
        <Grid item xs={6} sm={3}><StatCard label="Critical" value={overview?.criticalFeedback ?? 0} tone={overview?.criticalFeedback ? 'danger' : undefined} /></Grid>
        <Grid item xs={6} sm={3}><StatCard label="Resolved backlog" value={(overview?.totalFeedback ?? 0) - (overview?.openFeedback ?? 0)} /></Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">All</MenuItem>
          {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField size="small" select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">All</MenuItem>
          {['low', 'normal', 'high', 'urgent'].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
        </TextField>
        <TextField size="small" select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">All</MenuItem>
          {CATEGORY_OPTIONS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
      </Paper>

      <Box sx={{ height: 560, bgcolor: 'background.paper', borderRadius: 2 }}>
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
          onRowClick={(p) => navigate(`/feedback/${p.id}`)}
        />
      </Box>
    </Box>
  );
}
