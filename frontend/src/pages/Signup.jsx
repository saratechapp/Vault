import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Mail, ArrowLeft } from 'lucide-react';
import { Button, ProgressBar, Field, Input } from '../components/ui/index.js';
import { GoogleIcon, AppleIcon, FacebookIcon } from '../components/ui/BrandIcons.jsx';
import { SlideIn, SlideUp, FadeIn, Stagger, StaggerItem } from '../components/motion/index.js';
import { useAuth } from '../context/AuthContext.jsx';

const OAUTH_PROVIDERS = [
  { id: 'google', label: 'Continue with Google', Icon: GoogleIcon },
  { id: 'apple', label: 'Continue with Apple', Icon: AppleIcon },
  { id: 'facebook', label: 'Continue with Facebook', Icon: FacebookIcon },
];

const HIGHLIGHTS = [
  'Free forever — no card, no trial trickery',
  'Two-way import from any bank statement',
  'Bank-grade encryption, exports on request',
  "Beautiful dashboards you'll want to open",
];

// Seconds before "Resend code" is allowed again — matches Supabase's default
// per-address OTP send interval so the button doesn't offer a guaranteed-to-
// bounce click.
const RESEND_COOLDOWN = 60;
// Supabase's email OTP length is a project setting (6–10 digits; this project
// uses 8, the default is 6). Accept any length in that range rather than
// hard-coding one — a wrong-length code is rejected by verifyOtp anyway.
const CODE_MIN_LENGTH = 6;
const CODE_MAX_LENGTH = 10;

export default function Signup() {
  const navigate = useNavigate();
  const {
    loginWithOAuth, startEmailSignup, verifyEmailOtp, resendEmailOtp,
    isAuthed, needsPassword, ready,
  } = useAuth();

  // 'email' collects the address and sends the code; 'verify' collects the
  // 6-digit code. A password is never asked for here — only once the code is
  // confirmed and a session exists does routing send the user on to
  // /create-password (the same mandatory step OAuth signups go through).
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState('');
  const [resendIn, setResendIn] = useState(0);

  // Covers every way an authenticated session can appear on this page: a
  // brand-new signup (email code just verified, or OAuth redirect landing)
  // needs a password → /create-password; a returning user who already has one
  // goes straight through to the app.
  useEffect(() => {
    if (!ready || !isAuthed) return;
    navigate(needsPassword ? '/create-password' : '/app/dashboard');
  }, [ready, isAuthed, needsPassword, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function handleOAuth(provider) {
    setError('');
    setOauthBusy(provider);
    try {
      await loginWithOAuth(provider);
      // browser navigates away here; no further code runs until it returns
    } catch (err) {
      setError(err.message || `Could not sign up with ${provider}.`);
      setOauthBusy('');
    }
  }

  async function handleSendCode(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) return;
    setBusy(true);
    try {
      await startEmailSignup(email.trim());
      setStep('verify');
      setCode('');
      setResendIn(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.message || 'Could not send the verification code.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      // Only a valid, unexpired code resolves this without throwing. A
      // session is established here and nowhere else in the signup flow —
      // the /create-password step is unreachable without it.
      await verifyEmailOtp(email.trim(), code.trim());
      navigate('/create-password');
    } catch (err) {
      setError(err.message || 'That code is invalid or has expired.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0) return;
    setError('');
    try {
      await resendEmailOtp(email.trim());
      setResendIn(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.message || 'Could not resend the code.');
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
          <h2 className="font-display text-4xl font-bold leading-tight">Join 40,000+ people<br />building financial calm.</h2>
          <Stagger as="ul" className="mt-6 space-y-3" viewport={false}>
            {HIGHLIGHTS.map((h) => (
              <StaggerItem key={h} as="li" className="flex items-start gap-2.5 text-white/90">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Check size={12} />
                </span>
                <span className="text-sm">{h}</span>
              </StaggerItem>
            ))}
          </Stagger>
          <div className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <p className="text-xs text-white/70">This month at a glance</p>
            <p className="mt-1 font-display text-2xl font-bold">$7,660</p>
            <p className="mt-1 text-xs text-emerald-300">↑ 12.4% saved vs last month</p>
            <ProgressBar value={75} size="sm" className="mt-3 bg-white/20" color="#ffffff" />
            <p className="mt-2 text-xs text-white/70">75% of income safely saved</p>
          </div>
        </div>
        <p className="relative text-sm text-white/50">© {new Date().getFullYear()} Vault</p>
      </SlideIn>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <FadeIn className="mb-8 lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Vault" className="h-8 w-8 rounded-lg" />
            <span className="font-display text-base font-bold text-fg">Vault</span>
          </Link>
        </FadeIn>

        <SlideUp className="mx-auto w-full max-w-sm">
          {step === 'email' ? (
            <>
              <h1 className="font-display text-2xl font-bold text-fg">Create your account</h1>
              <p className="mt-1.5 text-sm text-muted">
                Already have an account? <Link to="/login" className="font-semibold text-brand-500 link-underline">Sign in</Link>
              </p>

              {error && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

              <form onSubmit={handleSendCode} className="mt-6 space-y-4">
                <Field label="Email">
                  <Input
                    leftIcon={<Mail size={15} />} type="email" required autoFocus
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                  />
                </Field>
                <Button type="submit" fullWidth disabled={busy || !email.trim()}>
                  {busy ? 'Sending code…' : 'Send verification code'}
                </Button>
                <p className="text-center text-xs text-subtle">
                  We'll email you a 6-digit code to confirm it's you. You'll set a password on the next step.
                </p>
              </form>

              <div className="my-6 flex items-center gap-3 text-xs text-subtle">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>

              <div className="space-y-3">
                {OAUTH_PROVIDERS.map(({ id, label, Icon }) => (
                  <Button
                    key={id} variant="outline" type="button" fullWidth
                    leftIcon={<Icon size={18} />}
                    onClick={() => handleOAuth(id)} disabled={!!oauthBusy || busy}
                  >
                    {oauthBusy === id ? 'Connecting…' : label}
                  </Button>
                ))}
              </div>

              <p className="mt-8 text-center text-xs text-subtle">
                By continuing you agree to Vault's <a href="#terms" className="link-underline text-muted hover:text-fg">Terms</a> and <a href="#privacy" className="link-underline text-muted hover:text-fg">Privacy Policy</a>.
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(''); }}
                className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg"
              >
                <ArrowLeft size={15} /> Use a different email
              </button>
              <h1 className="font-display text-2xl font-bold text-fg">Check your email</h1>
              <p className="mt-1.5 text-sm text-muted">
                We sent a verification code to <span className="font-medium text-fg">{email}</span>. Enter it to continue.
              </p>

              {error && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

              <form onSubmit={handleVerify} className="mt-6 space-y-4">
                <Field label="Verification code">
                  <Input
                    type="text" inputMode="numeric" autoComplete="one-time-code"
                    maxLength={CODE_MAX_LENGTH} required autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="12345678"
                  />
                </Field>
                <Button type="submit" fullWidth disabled={busy || code.trim().length < CODE_MIN_LENGTH}>
                  {busy ? 'Verifying…' : 'Verify & continue'}
                </Button>
              </form>

              <p className="mt-4 text-center text-sm text-muted">
                Didn't get it?{' '}
                <button
                  type="button" onClick={handleResend} disabled={resendIn > 0}
                  className="font-semibold text-brand-500 link-underline disabled:text-subtle disabled:no-underline"
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                </button>
              </p>
            </>
          )}
        </SlideUp>
      </div>
    </div>
  );
}
