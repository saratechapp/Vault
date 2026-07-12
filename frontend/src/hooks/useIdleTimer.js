import { useEffect, useRef } from 'react';
import { touchActivity, isIdleExpired } from '../lib/idleSession.js';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
// How often to re-check the persisted last-activity timestamp while the tab
// is open, as a backstop for setTimeout being throttled/paused by the OS
// (backgrounded tab, laptop sleep with the lid open, etc).
const BACKSTOP_CHECK_MS = 15_000;

export function useIdleTimer({ enabled, idleMs, onIdle, paused = false }) {
  const timerRef = useRef(null);
  const intervalRef = useRef(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) return undefined;

    const fire = () => {
      clearTimeout(timerRef.current);
      clearInterval(intervalRef.current);
      onIdleRef.current?.();
    };

    const reset = () => {
      if (paused) return;
      touchActivity();
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(fire, idleMs);
    };

    // Tab focus/visibility isn't real user activity — it must only ever
    // *check* elapsed idle time, never reset it. (Resetting here was the
    // original bug: switching back to a long-backgrounded tab would look
    // like fresh activity and silently restart the whole idle window.)
    const backstopCheck = () => {
      if (paused) return;
      if (isIdleExpired()) fire();
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, reset, { passive: true }));
    document.addEventListener('visibilitychange', backstopCheck);
    window.addEventListener('focus', backstopCheck);
    intervalRef.current = setInterval(backstopCheck, BACKSTOP_CHECK_MS);
    reset();

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(intervalRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset));
      document.removeEventListener('visibilitychange', backstopCheck);
      window.removeEventListener('focus', backstopCheck);
    };
  }, [enabled, idleMs, paused]);
}

export default useIdleTimer;
