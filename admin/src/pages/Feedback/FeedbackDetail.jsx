import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Chip, TextField, MenuItem, Button, Stack, Divider, Alert, Rating,
} from '@mui/material';
import { api } from '../../lib/api.js';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';

const STATUS_OPTIONS = ['open', 'assigned', 'in_progress', 'waiting_for_user', 'testing', 'resolved', 'closed', 'reopened'];

export default function FeedbackDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { admin } = useAdminAuth();
  const [item, setItem] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  function load() {
    api.get(`/feedback/${id}`).then(setItem).catch((err) => setError(err.message || 'Could not load this ticket.'));
  }
  useEffect(load, [id]);
  useEffect(() => { api.get('/admins').then(setAdmins).catch(() => {}); }, []);

  async function updateField(patch) {
    await api.patch(`/feedback/${id}`, patch);
    load();
  }
  async function assign(adminId) {
    await api.post(`/feedback/${id}/assign`, { adminId: adminId || null });
    load();
  }
  async function resolve() {
    await api.post(`/feedback/${id}/resolve`);
    load();
  }
  async function sendReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/feedback/${id}/messages`, { body: reply.trim(), internal });
      setReply('');
      setInternal(false);
      load();
    } catch (err) {
      setError(err.message || 'Could not send.');
    } finally {
      setSending(false);
    }
  }
  async function remove() {
    if (!window.confirm('Permanently delete this feedback ticket?')) return;
    await api.delete(`/feedback/${id}`);
    navigate('/feedback');
  }

  if (error && !item) return <Alert severity="error">{error}</Alert>;
  if (!item) return null;

  return (
    <Box>
      <Button onClick={() => navigate('/feedback')} sx={{ mb: 1 }}>← Back to feedback</Button>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Box sx={{ flex: 2 }}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{item.subject}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {item.userName || item.userEmail} · {item.userEmail} · {new Date(item.createdAt).toLocaleString()}
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{item.message}</Typography>
            {(item.rating || item.satisfactionRating) && (
              <Stack direction="row" spacing={3} sx={{ mt: 1.5 }}>
                {item.rating && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">Submission rating</Typography>
                    <Rating value={item.rating} readOnly size="small" />
                  </Box>
                )}
                {item.satisfactionRating && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">Satisfaction rating</Typography>
                    <Rating value={item.satisfactionRating} readOnly size="small" />
                  </Box>
                )}
              </Stack>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Conversation</Typography>
            <Stack spacing={1.5}>
              {(item.messages || []).map((m) => (
                m.senderType === 'system' ? (
                  <Typography key={m.id} variant="caption" color="text.secondary" align="center">
                    {m.body} · {new Date(m.createdAt).toLocaleString()}
                  </Typography>
                ) : (
                  <Box
                    key={m.id}
                    sx={{
                      p: 1.5, borderRadius: 2,
                      bgcolor: m.internal ? 'warning.main' : m.senderType === 'admin' ? 'primary.main' : 'action.hover',
                      color: m.internal || m.senderType === 'admin' ? '#fff' : 'text.primary',
                      opacity: m.internal ? 0.85 : 1,
                    }}
                  >
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      {m.internal ? 'Internal note' : m.senderType === 'admin' ? 'Admin reply' : 'User'} · {new Date(m.createdAt).toLocaleString()}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.body}</Typography>
                  </Box>
                )
              ))}
              {(item.messages || []).length === 0 && <Typography color="text.secondary">No replies yet.</Typography>}
            </Stack>

            <Divider sx={{ my: 2 }} />
            {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
            <Box component="form" onSubmit={sendReply}>
              <TextField
                value={reply} onChange={(e) => setReply(e.target.value)} multiline rows={3} fullWidth
                placeholder={internal ? 'Internal note (not visible to the user)…' : 'Reply to the user…'}
              />
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1.5 }}>
                <Button size="small" variant={internal ? 'contained' : 'outlined'} onClick={() => setInternal((v) => !v)}>
                  {internal ? 'Internal note' : 'Visible reply'}
                </Button>
                <Button type="submit" variant="contained" disabled={sending || !reply.trim()}>
                  {sending ? 'Sending…' : 'Send'}
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Box>

        <Box sx={{ flex: 1, minWidth: 260 }}>
          <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField select size="small" label="Status" value={item.status} onChange={(e) => updateField({ status: e.target.value })}>
              {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Priority" value={item.priority} onChange={(e) => updateField({ priority: e.target.value })}>
              {['low', 'normal', 'high', 'urgent'].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Assigned to" value={item.assignedAdminId || ''} onChange={(e) => assign(e.target.value)}>
              <MenuItem value="">Unassigned</MenuItem>
              {admins.map((a) => <MenuItem key={a.id} value={a.id}>{a.name || a.id}</MenuItem>)}
            </TextField>
            <Chip label={item.category} sx={{ alignSelf: 'flex-start' }} />
            <Divider />
            <Button variant="outlined" color="success" onClick={resolve} disabled={item.status === 'resolved'}>Mark resolved</Button>
            {admin?.isSuperAdmin && <Button variant="outlined" color="error" onClick={remove}>Delete ticket</Button>}
          </Paper>
        </Box>
      </Stack>
    </Box>
  );
}
