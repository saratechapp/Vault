import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/index.js';
import { SlideUp } from '../components/motion/index.js';
import { PasswordFields } from '../components/PasswordFields.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { isPasswordValid, passwordValidationError } from '../lib/passwordValidation.js';

// Landing page for the link Supabase emails from ForgotPassword. supabase-js
// auto-detects the recovery token in the URL and establishes a temporary
// session (AuthContext's onAuthStateChange picks it up like any other) —
// this page just needs to capture the new password once that's in place.
export default function ResetPassword() {
  const navigate = useNavigate();
  const { setAccountPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const validationError = passwordValidationError(password, confirm);
    if (validationError) return setError(validationError);
    setSubmitting(true);
    try {
      await setAccountPassword(password);
      navigate('/app/dashboard');
    } catch (err) {
      setError(err.message || 'Could not reset your password. The link may have expired — request a new one.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <SlideUp className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <img src="/logo.svg" alt="Vault" className="h-8 w-8 rounded-lg" />
          <span className="font-display text-base font-bold text-fg">Vault</span>
        </div>

        <h1 className="text-center font-display text-2xl font-bold text-fg">Set a new password</h1>
        <p className="mt-1.5 text-center text-sm text-muted">Choose a new password for your account.</p>

        {error && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <PasswordFields passwordLabel="New password" password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} />
          <Button type="submit" fullWidth disabled={submitting || !isPasswordValid(password, confirm)}>{submitting ? 'Saving…' : 'Save new password'}</Button>
        </form>
      </SlideUp>
    </div>
  );
}
