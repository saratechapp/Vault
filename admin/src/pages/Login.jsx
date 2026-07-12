import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, TextField, Button, Typography, Alert } from '@mui/material';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';

export default function Login() {
  const navigate = useNavigate();
  const { loginWithPassword, isAuthed, ready, notAnAdmin, logout } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && isAuthed) navigate('/', { replace: true });
  }, [ready, isAuthed, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await loginWithPassword(email.trim(), password);
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Paper sx={{ p: 4, width: 380 }} variant="outlined">
        <Box component="img" src="/logo.svg" alt="Vault" sx={{ height: 40, width: 40, borderRadius: 1.5, mb: 2 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Vault Admin</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Sign in with your staff account.</Typography>

        {notAnAdmin && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={logout}>
            This account isn't an administrator, or has been suspended.
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus fullWidth />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />
          <Button type="submit" variant="contained" size="large" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
