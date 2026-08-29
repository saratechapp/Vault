import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataGrid } from '@mui/x-data-grid';
import {
  Box, Typography, TextField, MenuItem, Chip, IconButton, Menu, Alert,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { api } from '../../lib/api.js';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import { hasPermission } from '../../lib/permissions.js';

function RowActions({ row, onChanged, canEdit, canSuspend, canDelete, canImpersonate }) {
  const [anchor, setAnchor] = useState(null);
  const navigate = useNavigate();

  async function run(action) {
    setAnchor(null);
    try {
      if (action === 'view') return navigate(`/users/${row.id}`);
      if (action === 'suspend') await api.post(`/users/${row.id}/suspend`);
      if (action === 'activate') await api.post(`/users/${row.id}/activate`);
      if (action === 'delete') {
        if (!window.confirm(`Permanently delete ${row.email || row.name}? This cannot be undone.`)) return;
        await api.delete(`/users/${row.id}`);
      }
      if (action === 'reset-password') await api.post(`/users/${row.id}/reset-password`);
      if (action === 'force-logout') await api.post(`/users/${row.id}/force-logout`);
      if (action === 'impersonate') {
        const res = await api.post(`/users/${row.id}/impersonate`, {});
        if (res.actionLink) window.open(res.actionLink, '_blank', 'noopener');
      }
      onChanged();
    } catch (err) {
      window.alert(err.message || 'Action failed.');
    }
  }

  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}><MoreVertIcon fontSize="small" /></IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => run('view')}>View profile</MenuItem>
        {canEdit && <MenuItem onClick={() => run('reset-password')}>Reset password</MenuItem>}
        {canEdit && <MenuItem onClick={() => run('force-logout')}>Force logout</MenuItem>}
        {canSuspend && row.status !== 'suspended' && <MenuItem onClick={() => run('suspend')}>Suspend</MenuItem>}
        {canSuspend && row.status === 'suspended' && <MenuItem onClick={() => run('activate')}>Activate</MenuItem>}
        {canImpersonate && <MenuItem onClick={() => run('impersonate')}>Login as user</MenuItem>}
        {canDelete && <MenuItem onClick={() => run('delete')} sx={{ color: 'error.main' }}>Delete</MenuItem>}
      </Menu>
    </>
  );
}

export default function UserList() {
  const { admin } = useAdminAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(paginationModel.page + 1),
      pageSize: String(paginationModel.pageSize),
      search, status, plan,
    });
    api.get(`/users?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows.map((r) => ({ ...r, id: r.id })));
        setTotal(res.total);
        setError('');
      })
      .catch((err) => !cancelled && setError(err.message || 'Could not load users.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [paginationModel, search, status, plan, reloadTick]);

  const canEdit = hasPermission(admin, 'users', 'edit');
  const canSuspend = hasPermission(admin, 'users', 'suspend');
  const canDelete = hasPermission(admin, 'users', 'delete');
  const canImpersonate = hasPermission(admin, 'users', 'impersonate');

  const columns = useMemo(() => [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 140 },
    { field: 'email', headerName: 'Email', flex: 1.2, minWidth: 180 },
    { field: 'phone', headerName: 'Mobile', width: 130 },
    { field: 'country', headerName: 'Country', width: 100 },
    { field: 'currency', headerName: 'Currency', width: 100 },
    {
      field: 'plan', headerName: 'Plan', width: 110,
      renderCell: (p) => <Chip size="small" label={p.value || 'Free'} color={p.value && p.value !== 'Free' ? 'primary' : 'default'} />,
    },
    { field: 'memberSince', headerName: 'Registered', width: 120 },
    {
      field: 'status', headerName: 'Status', width: 110,
      renderCell: (p) => <Chip size="small" label={p.value || 'active'} color={p.value === 'suspended' ? 'error' : 'success'} variant="outlined" />,
    },
    {
      field: 'actions', headerName: '', width: 60, sortable: false, filterable: false,
      renderCell: (p) => (
        <RowActions
          row={p.row} onChanged={() => setReloadTick((t) => t + 1)}
          canEdit={canEdit} canSuspend={canSuspend} canDelete={canDelete} canImpersonate={canImpersonate}
        />
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [canEdit, canSuspend, canDelete, canImpersonate]);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>Users</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small" label="Search name, email, phone" value={search}
          onChange={(e) => { setSearch(e.target.value); setPaginationModel((m) => ({ ...m, page: 0 })); }}
          sx={{ minWidth: 260 }}
        />
        <TextField
          size="small" select label="Status" value={status}
          onChange={(e) => { setStatus(e.target.value); setPaginationModel((m) => ({ ...m, page: 0 })); }}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="suspended">Suspended</MenuItem>
        </TextField>
        <TextField
          size="small" select label="Plan" value={plan}
          onChange={(e) => { setPlan(e.target.value); setPaginationModel((m) => ({ ...m, page: 0 })); }}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="Free">Free</MenuItem>
          <MenuItem value="Pro">Pro</MenuItem>
          <MenuItem value="Premium">Premium</MenuItem>
          <MenuItem value="Enterprise">Enterprise</MenuItem>
        </TextField>
      </Box>

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
          onRowDoubleClick={(p) => navigate(`/users/${p.id}`)}
        />
      </Box>
    </Box>
  );
}
