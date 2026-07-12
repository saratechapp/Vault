import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

function formatRemaining(ms) {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Persistent, impossible-to-miss banner while an admin is viewing this
// account via impersonation — see the plan doc's Security Checklist. The
// 15-minute expiry is enforced server-side (requireAuth) independently of
// this countdown; the countdown is purely a visible warning, not the
// enforcement mechanism.
export function ImpersonationBanner() {
  const { impersonation, exitImpersonation } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!impersonation?.active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [impersonation?.active]);

  if (!impersonation?.active) return null;

  const remainingMs = new Date(impersonation.expiresAt).getTime() - now;

  async function handleExit() {
    setExiting(true);
    await exitImpersonation();
  }

  return (
    <div className="sticky top-0 z-[60] flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <ShieldAlert size={16} className="shrink-0" />
      <span>
        {impersonation.adminName || 'An admin'} is viewing this account as you — expires in {formatRemaining(remainingMs)}
      </span>
      <button
        type="button"
        onClick={handleExit}
        disabled={exiting}
        className="ml-1 rounded-lg bg-amber-950/10 px-2.5 py-1 font-semibold transition hover:bg-amber-950/20 disabled:opacity-60"
      >
        {exiting ? 'Exiting…' : 'Exit'}
      </button>
    </div>
  );
}

export default ImpersonationBanner;
