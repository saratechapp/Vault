import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button, Field, Input } from '../components/ui/index.js';
import { SlideUp } from '../components/motion/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { twoFactorApi, api } from '../lib/api.js';

const RESEND_COOLDOWN = 30;

// Post-login step-up: the account has email-OTP 2FA enabled but this browser
// session hasn't verified a code yet. On mount we ask the backend to send a
// fresh 'login' code; entering it marks this device session verified and the
// app proceeds. Mirrors the mobile app's TwoFactorScreen.
export default function TwoFactorChallenge() {
  const navigate = useNavigate();
  const { isAuthed, ready, twoFactorPending, logout, setUser, user } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN);
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    twoFactorApi.sendCode('login').catch(() => setError('Could not send a verification code. Try “Resend”.'));
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  if (ready && !isAuthed) return <Navigate to="/login" replace />;
  // 2FA already satisfied (or not enabled) — nothing to do here.
  if (ready && !twoFactorPending) return <Navigate to="/app/dashboard" replace />;

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the 6-digit code from your email.');
    setBusy(true);
    try {
      await twoFactorApi.verify('login', code.trim());
      // Refresh the profile so twoFactorVerified flips true and routing releases.
      const fresh = await api.get('/me');
      if (fresh?.user) setUser(fresh.user);
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(
        err.message === 'incorrect_code' ? 'That code is not correct.'
        : err.message === 'code_expired_or_missing' ? 'That code has expired. Tap “Resend”.'
        : err.message === 'too_many_attempts' ? 'Too many attempts. Wait a few minutes and try again.'
        : 'Could not verify that code.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0) return;
    setError('');
    try {
      await twoFactorApi.sendCode('login');
      setResendIn(RESEND_COOLDOWN);
    } catch {
      setError('Could not resend the code.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <SlideUp className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
            <ShieldCheck size={20} />
          </span>
          <h1 className="font-display text-2xl font-bold text-fg">Two-factor verification</h1>
          <p className="mt-1.5 text-sm text-muted">
            We emailed a 6-digit code{user?.email ? <> to <span className="font-medium text-fg">{user.email}</span></> : null}. Enter it to continue.
          </p>
        </div>

        {error && <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <form onSubmit={handleVerify} noValidate className="space-y-4">
          <Field label="Verification code">
            <Input
              type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456"
            />
          </Field>
          <Button type="submit" fullWidth disabled={busy || code.trim().length !== 6}>
            {busy ? 'Verifying…' : 'Verify & continue'}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button" onClick={handleResend} disabled={resendIn > 0}
            className="font-semibold text-brand-500 link-underline disabled:text-subtle disabled:no-underline"
          >
            {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
          </button>
          <button type="button" onClick={() => logout()} className="text-muted hover:text-fg">
            Sign out
          </button>
        </div>
      </SlideUp>
    </div>
  );
}
