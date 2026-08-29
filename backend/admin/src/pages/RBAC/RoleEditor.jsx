import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Checkbox, Alert, Chip,
} from '@mui/material';
import { api } from '../../lib/api.js';

export default function RoleEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [modules, setModules] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([api.get(`/rbac/roles/${id}`), api.get('/rbac/permissions-catalog')])
      .then(([r, cat]) => {
        setRole(r);
        setModules(cat.modules);
        setSelected(new Set((r.permissions || []).map((p) => `${p.module}:${p.action}`)));
      })
      .catch((err) => setError(err.message || 'Could not load this role.'));
  }, [id]);

  const moduleEntries = useMemo(() => Object.entries(modules), [modules]);

  function toggle(module, action) {
    const key = `${module}:${action}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const permissions = Array.from(selected).map((key) => {
        const [module, action] = key.split(':');
        return { module, action };
      });
      await api.put(`/rbac/roles/${id}/permissions`, { permissions });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message || 'Could not save permissions.');
    } finally {
      setSaving(false);
    }
  }

  if (error && !role) return <Alert severity="error">{error}</Alert>;
  if (!role) return null;

  return (
    <Box>
      <Button onClick={() => navigate('/rbac')} sx={{ mb: 1 }}>← Back to roles</Button>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{role.name}</Typography>
        {role.isSystem && <Chip label="System role — always has full access" color="primary" size="small" />}
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {role.isSystem ? (
        <Alert severity="info">Super Admin bypasses this permission matrix entirely and always has full access — nothing to configure.</Alert>
      ) : (
        <Paper variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Module</TableCell>
                <TableCell colSpan={10}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {moduleEntries.map(([moduleKey, { label, actions }]) => (
                <TableRow key={moduleKey}>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      {actions.map((action) => (
                        <Box key={action} sx={{ display: 'flex', alignItems: 'center' }}>
                          <Checkbox
                            size="small"
                            checked={selected.has(`${moduleKey}:${action}`)}
                            onChange={() => toggle(moduleKey, action)}
                          />
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{action}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {!role.isSystem && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save permissions'}</Button>
          {saved && <Typography color="success.main" variant="body2">Saved</Typography>}
        </Box>
      )}
    </Box>
  );
}
