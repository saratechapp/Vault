import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button, ProgressBar } from '../components/ui/index.js';
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

export default function Signup() {
  const navigate = useNavigate();
  const { loginWithOAuth, isAuthed, needsPassword, ready } = useAuth();
  const [error, setError] = useState('');
  const [oauthBusy, setOauthBusy] = useState('');

  // Covers both directions: a brand-new signup lands back here needing a
  // password, and a returning user who already has one (e.g. re-clicked a
  // provider button here instead of using Login) goes straight through.
  useEffect(() => {
    if (!ready || !isAuthed) return;
    navigate(needsPassword ? '/create-password' : '/app/dashboard');
  }, [ready, isAuthed, needsPassword, navigate]);

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
          <h1 className="font-display text-2xl font-bold text-fg">Create your account</h1>
          <p className="mt-1.5 text-sm text-muted">
            Already have an account? <Link to="/login" className="font-semibold text-brand-500 link-underline">Sign in</Link>
          </p>

          {error && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

          <div className="mt-6 space-y-3">
            {OAUTH_PROVIDERS.map(({ id, label, Icon }) => (
              <Button
                key={id} variant="outline" type="button" fullWidth
                leftIcon={<Icon size={18} />}
                onClick={() => handleOAuth(id)} disabled={!!oauthBusy}
              >
                {oauthBusy === id ? 'Connecting…' : label}
              </Button>
            ))}
          </div>

          <p className="mt-8 text-center text-xs text-subtle">
            By continuing you agree to Vault's <a href="#terms" className="link-underline text-muted hover:text-fg">Terms</a> and <a href="#privacy" className="link-underline text-muted hover:text-fg">Privacy Policy</a>.
          </p>
        </SlideUp>
      </div>
    </div>
  );
}
