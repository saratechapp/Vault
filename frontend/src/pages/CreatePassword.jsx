import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/index.js';
import { SlideUp } from '../components/motion/index.js';
import { PasswordFields } from '../components/PasswordFields.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { isPasswordValid, passwordValidationError } from '../lib/passwordValidation.js';

// Mandatory step right after a first-time Google/Apple/Facebook signup —
// gives the account a password so it can also be used to log in directly
// next time (see AuthContext's needsPassword / Login.jsx).
export default function CreatePassword() {
  const navigate = useNavigate();
  const { user, isAuthed, needsPassword, ready, setAccountPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && isAuthed && !needsPassword) navigate('/app/dashboard');
  }, [ready, isAuthed, needsPassword, navigate]);

  if (ready && !isAuthed) return <Navigate to="/login" replace />;

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
      setError(err.message || 'Could not set your password.');
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

        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
            <ShieldCheck size={20} />
          </span>
          <h1 className="font-display text-2xl font-bold text-fg">Create a password</h1>
          <p className="mt-1.5 text-sm text-muted">
            {user?.email ? <>For <span className="font-medium text-fg">{user.email}</span>. </> : null}
            Next time you can sign in with this instead of going through your provider again.
          </p>
        </div>

        {error && <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordFields password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} />
          <Button type="submit" fullWidth disabled={submitting || !isPasswordValid(password, confirm)}>{submitting ? 'Saving…' : 'Create password'}</Button>
        </form>
      </SlideUp>
    </div>
  );
}
