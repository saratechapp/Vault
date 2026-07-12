import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { api } from '../../lib/api.js';

function CreateRoleDialog({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setName(''); setDescription(''); setError(''); }
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Role name is required.');
    setSaving(true);
    try {
      const role = await api.post('/rbac/roles', { name: name.trim(), description });
      onCreated(role);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not create role.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>New role</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} autoFocus fullWidth />
          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} multiline rows={2} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export default function RoleList() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api.get('/rbac/roles').then(setRoles).catch((err) => setError(err.message || 'Could not load roles.'));
  }
  useEffect(load, []);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Roles & Permissions</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setDialogOpen(true)}>New role</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Role</TableCell>
            <TableCell>Description</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {roles.map((r) => (
            <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/rbac/${r.id}`)}>
              <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
              <TableCell>{r.description || '—'}</TableCell>
              <TableCell align="right">{r.isSystem && <Chip size="small" label="System role" color="primary" variant="outlined" />}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CreateRoleDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={load} />
    </Box>
  );
}
