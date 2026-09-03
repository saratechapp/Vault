import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, TrendingUp, Sparkles, ShieldCheck } from 'lucide-react';
import { Button, Field, Input, Alert } from '../components/ui/index.js';
import { SlideIn, SlideUp, FadeIn } from '../components/motion/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { peekSessionExpiredFlag, clearSessionExpiredFlag, peekAccountSuspendedFlag, clearAccountSuspendedFlag } from '../lib/idleSession.js';

const HIGHLIGHTS = [
  { icon: TrendingUp, title: 'Cash flow, clearly', body: 'Income, spend and savings across every account.' },
  { icon: Sparkles, title: 'Insights from your data', body: 'Trends, anomalies and budget pace — computed live.' },
  { icon: ShieldCheck, title: 'Encrypted & private', body: 'Only you can see your finances.' },
];

export default function Login() {
  const navigate = useNavigate();
  const { loginWithPassword, setRememberMe, isAuthed, needsPassword, ready } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expiredNotice] = useState(() => peekSessionExpiredFlag());
  const [suspendedNotice] = useState(() => peekAccountSuspendedFlag());

  useEffect(() => {
    if (!ready || !isAuthed) return;
    navigate(needsPassword ? '/create-password' : '/app/dashboard');
  }, [ready, isAuthed, needsPassword, navigate]);

  useEffect(() => {
    clearSessionExpiredFlag();
    clearAccountSuspendedFlag();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      return setError('Enter your email and password.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return setError('That doesn’t look like a valid email address.');
    }
    setSubmitting(true);
    try {
      setRememberMe(keepSignedIn);
      await loginWithPassword(trimmedEmail, password);
      // A successful password login is itself proof this account has a
      // working password — go straight to the dashboard rather than relying
      // on the needsPassword effect above, which derives from Supabase's
      // `identities` list. That list doesn't always contain an 'email' entry
      // for accounts whose password was set via the admin API (e.g. this
      // app's one-off migration script) rather than the client updateUser()
      // call, so needsPassword can read stale/wrong right after a real login.
      navigate('/app/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <SlideIn from="left" className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800 shadow-glow p-12 text-white lg:flex">
        <div className="grid-bg absolute inset-0 opacity-10" />
        <div className="relative flex items-center gap-2.5">
          <img src="/logo.svg" alt="Vault" className="h-9 w-9 rounded-xl" />
          <span className="font-display text-lg font-bold">Vault</span>
        </div>

        <div className="relative">
          <h2 className="font-display text-4xl font-bold leading-tight">Welcome back.<br />Your money's been busy.</h2>
          <p className="mt-4 max-w-md text-white/80">
            Sign in to see your latest cash flow, budget health, and goal progress — all in one calm dashboard.
          </p>
          <div className="mt-8 space-y-5">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <h.icon size={16} />
                </span>
                <div>
                  <p className="text-sm font-semibold">{h.title}</p>
                  <p className="text-sm text-white/70">{h.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-sm italic text-white/60">Track every dollar, hit every goal, and finally understand where your money goes.</p>
      </SlideIn>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <FadeIn className="mb-8 lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Vault" className="h-8 w-8 rounded-lg" />
            <span className="font-display text-base font-bold text-fg">Vault</span>
          </Link>
        </FadeIn>

        <SlideUp className="mx-auto w-full max-w-sm">
          <h1 className="font-display text-2xl font-bold text-fg">Sign in</h1>
          <p className="mt-1.5 text-sm text-muted">
            New here? <Link to="/signup" className="font-semibold text-brand-500 link-underline">Create an account</Link>
          </p>

          {suspendedNotice && !error && (
            <Alert tone="danger" className="mt-4">Your account has been suspended. Contact support if you believe this is a mistake.</Alert>
          )}
          {expiredNotice && !suspendedNotice && !error && (
            <Alert tone="warning" className="mt-4">Your session has expired due to inactivity. Please sign in again.</Alert>
          )}
          {error && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </Field>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="label !mb-0">Password</label>
                <Link to="/forgot-password" className="text-xs font-medium text-brand-500 hover:text-brand-400">Forgot?</Link>
              </div>
              <Input
                type={showPassword ? 'text' : 'password'}
                required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                rightSlot={
                  <button type="button" onClick={() => setShowPassword((s) => !s)} className="text-subtle hover:text-fg">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={keepSignedIn} onChange={(e) => setKeepSignedIn(e.target.checked)} className="h-4 w-4 rounded border-line" />
              Remember me
            </label>

            <Button type="submit" fullWidth rightIcon={!submitting ? <span>→</span> : null} disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</Button>
          </form>

          <p className="mt-8 text-center text-xs text-subtle">
            By continuing you agree to Vault's <Link to="/terms" className="link-underline text-muted hover:text-fg">Terms</Link> and <Link to="/privacy" className="link-underline text-muted hover:text-fg">Privacy Policy</Link>.
          </p>
        </SlideUp>
      </div>
    </div>
  );
}
