import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, IconButton, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Avatar, Stack,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import { api } from '../../lib/api.js';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';

function blankForm() {
  return { email: '', name: '', department: '', phone: '', roleId: '' };
}

function AdminFormDialog({ open, onClose, roles, editing, onSaved }) {
  const [form, setForm] = useState(blankForm());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(editing
      ? { email: editing.email || '', name: editing.name || '', department: editing.department || '', phone: editing.phone || '', roleId: editing.roleId || '' }
      : blankForm());
  }, [open, editing]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.roleId || (!editing && !form.email)) return setError('Email and role are required.');
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.patch(`/admins/${editing.id}`, { name: form.name, department: form.department, phone: form.phone, roleId: form.roleId });
      } else {
        await api.post('/admins', form);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save admin.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{editing ? 'Edit admin' : 'Invite admin'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {!editing && (
            <TextField label="Email" type="email" required value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} fullWidth />
          )}
          <TextField label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} fullWidth />
          <TextField label="Department" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} fullWidth />
          <TextField label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} fullWidth />
          <TextField select label="Role" required value={form.roleId} onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))} fullWidth>
            {roles.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export default function AdminList() {
  const { admin: currentAdmin } = useAdminAuth();
  const [admins, setAdmins] = useState([]);
  const [roles, setRoles] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuRow, setMenuRow] = useState(null);
  const [error, setError] = useState('');

  function load() {
    Promise.all([api.get('/admins'), api.get('/rbac/roles')])
      .then(([a, r]) => { setAdmins(a); setRoles(r); })
      .catch((err) => setError(err.message || 'Could not load admins.'));
  }
  useEffect(load, []);

  async function handleSuspendToggle(row) {
    setMenuAnchor(null);
    await api.patch(`/admins/${row.id}`, { status: row.status === 'suspended' ? 'active' : 'suspended' });
    load();
  }
  async function handleDelete(row) {
    setMenuAnchor(null);
    if (!window.confirm(`Remove admin access for ${row.name || row.id}?`)) return;
    try {
      await api.delete(`/admins/${row.id}`);
      load();
    } catch (err) {
      window.alert(err.message || 'Could not delete admin.');
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Admins</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => { setEditing(null); setDialogOpen(true); }}>Invite admin</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Admin</TableCell>
            <TableCell>Department</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Status</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {admins.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar src={a.avatar} sx={{ width: 32, height: 32 }}>{a.name?.[0]}</Avatar>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.name || '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">{a.id}</Typography>
                  </Box>
                </Stack>
              </TableCell>
              <TableCell>{a.department || '—'}</TableCell>
              <TableCell><Chip size="small" label={a.roleName} /></TableCell>
              <TableCell>
                <Chip size="small" label={a.status} color={a.status === 'suspended' ? 'error' : 'success'} variant="outlined" />
              </TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={(e) => { setMenuAnchor(e.currentTarget); setMenuRow(a); }}>
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => { setEditing(menuRow); setDialogOpen(true); setMenuAnchor(null); }}>Edit</MenuItem>
        <MenuItem onClick={() => handleSuspendToggle(menuRow)}>{menuRow?.status === 'suspended' ? 'Activate' : 'Suspend'}</MenuItem>
        <MenuItem
          onClick={() => handleDelete(menuRow)}
          disabled={menuRow?.id === currentAdmin?.id}
          sx={{ color: 'error.main' }}
        >
          Delete
        </MenuItem>
      </Menu>

      <AdminFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} roles={roles} editing={editing} onSaved={load} />
    </Box>
  );
}
