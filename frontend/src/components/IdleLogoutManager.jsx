import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePreferences } from '../context/PreferencesContext.jsx';
import { useIdleTimer } from '../hooks/useIdleTimer.js';
import { Modal, Button, ProgressBar } from './ui/index.js';

const WARNING_SECONDS = 60;

export function IdleLogoutManager() {
  const { isAuthed, logout } = useAuth();
  const { prefs } = usePreferences();
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_SECONDS);
  const intervalRef = useRef(null);

  const idleMs = Math.max(60_000, (prefs.autoLogoutIdleMinutes || 15) * 60_000);

  useIdleTimer({
    enabled: isAuthed && prefs.autoLogoutEnabled,
    idleMs,
    paused: warning,
    onIdle: () => {
      setWarning(true);
      setSecondsLeft(WARNING_SECONDS);
    },
  });

  useEffect(() => {
    if (!warning) {
      clearInterval(intervalRef.current);
      return undefined;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          logout({ reason: 'idle' });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warning]);

  if (!isAuthed || !prefs.autoLogoutEnabled) return null;

  return (
    <Modal open={warning} onClose={() => setWarning(false)} title="Are you still there?" size="sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
          <AlertTriangle size={22} />
        </div>
        <p className="text-sm text-muted">
          You've been inactive for a while. For your security, you'll be signed out in <span className="font-semibold text-fg">{secondsLeft}s</span>.
        </p>
        <ProgressBar value={secondsLeft} max={WARNING_SECONDS} tone={secondsLeft <= 15 ? 'danger' : 'warning'} className="w-full" />
        <div className="grid w-full grid-cols-2 gap-3">
          <Button variant="outline" onClick={logout}>Sign out now</Button>
          <Button onClick={() => setWarning(false)}>Stay signed in</Button>
        </div>
      </div>
    </Modal>
  );
}

export default IdleLogoutManager;
