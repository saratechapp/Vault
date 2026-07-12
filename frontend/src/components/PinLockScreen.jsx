import { useEffect, useState } from 'react';
import { Delete, LogOut } from 'lucide-react';
import { verifyPin } from '../lib/pin.js';
import { useAuth } from '../context/AuthContext.jsx';

export function PinLockScreen({ onUnlock }) {
  const { user, logout } = useAuth();
  const [digits, setDigits] = useState('');
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (digits.length >= 4) {
      const t = setTimeout(() => submit(digits), digits.length === 6 ? 0 : 250);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  async function submit(pin) {
    if (checking) return;
    setChecking(true);
    const ok = await verifyPin(pin);
    setChecking(false);
    if (ok) {
      onUnlock();
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setDigits('');
    }
  }

  function press(n) {
    if (digits.length >= 8) return;
    setDigits((d) => d + n);
  }
  function backspace() {
    setDigits((d) => d.slice(0, -1));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-app">
      <img src="/logo.svg" alt="Vault" className="h-12 w-12 rounded-2xl shadow-glow" />
      <h1 className="mt-4 font-display text-xl font-bold text-fg">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">{user?.name ? `Enter your PIN, ${user.name.split(' ')[0]}` : 'Enter your PIN to continue'}</p>

      <div className={`mt-8 flex gap-3 ${shake ? 'animate-pulse' : ''}`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-2 transition ${
              i < digits.length ? (shake ? 'border-rose-500 bg-rose-500' : 'border-brand-500 bg-brand-500') : 'border-line'
            }`}
          />
        ))}
      </div>

      <div className="mt-10 grid grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
          <button
            key={n}
            onClick={() => press(n)}
            className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line text-xl font-semibold text-fg transition hover:bg-tint/[0.06] active:scale-95"
          >
            {n}
          </button>
        ))}
        <button onClick={logout} className="flex h-16 w-16 items-center justify-center rounded-2xl text-muted transition hover:bg-tint/[0.06]">
          <LogOut size={18} />
        </button>
        <button
          onClick={() => press('0')}
          className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line text-xl font-semibold text-fg transition hover:bg-tint/[0.06] active:scale-95"
        >
          0
        </button>
        <button onClick={backspace} className="flex h-16 w-16 items-center justify-center rounded-2xl text-muted transition hover:bg-tint/[0.06]">
          <Delete size={18} />
        </button>
      </div>
    </div>
  );
}

export default PinLockScreen;
