import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button, Field, Input } from '../components/ui/index.js';
import { SlideUp, FadeIn } from '../components/motion/index.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return setError('Enter a valid email address.');
    }
    setSubmitting(true);
    try {
      await sendPasswordReset(trimmed);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not send the reset link.');
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

        <h1 className="text-center font-display text-2xl font-bold text-fg">Reset your password</h1>

        {sent ? (
          <FadeIn className="mt-6 text-center">
            <p className="text-sm text-muted">
              If an account exists for <span className="font-medium text-fg">{email}</span>, we've sent a link to reset your password.
            </p>
            <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500 link-underline">
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </FadeIn>
        ) : (
          <>
            <p className="mt-1.5 text-center text-sm text-muted">Enter your email and we'll send you a reset link.</p>

            {error && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
              <Field label="Email">
                <Input leftIcon={<Mail size={15} />} type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              </Field>
              <Button type="submit" fullWidth disabled={submitting}>{submitting ? 'Sending…' : 'Send reset link'}</Button>
            </form>

            <Link to="/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted hover:text-fg">
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </>
        )}
      </SlideUp>
    </div>
  );
}
