import { useEffect, useRef } from 'react';

const ACTIVE_MS_KEY = 'wallet_feedback_active_ms';
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
// How often to fold observed activity into the persisted cumulative total —
// same cadence/shape as useIdleTimer.js's backstop interval, but counting
// *up* toward an engagement threshold instead of down to idle.
const TICK_MS = 15_000;
export const DEFAULT_FEEDBACK_THRESHOLD_MS = 7 * 60_000;

function getActiveMs() {
  try {
    return Number(localStorage.getItem(ACTIVE_MS_KEY)) || 0;
  } catch {
    return 0;
  }
}
function addActiveMs(ms) {
  try {
    localStorage.setItem(ACTIVE_MS_KEY, String(getActiveMs() + ms));
  } catch {
    // storage unavailable — the threshold just won't be reachable this visit
  }
}

// Fires `onEligible` once cumulative *active* time (mouse/keyboard/touch/
// scroll while the tab is visible) crosses `thresholdMs`. Persisted across
// reloads (same visit-spanning intent as idleSession.js), but only ever
// fires once per mount — the caller (FeedbackPromptController) owns whether
// that one shot actually gets acted on.
export function useFeedbackPrompt({ enabled, thresholdMs = DEFAULT_FEEDBACK_THRESHOLD_MS, blocked = false, onEligible }) {
  const activeRef = useRef(false);
  const firedRef = useRef(false);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const onEligibleRef = useRef(onEligible);
  onEligibleRef.current = onEligible;

  useEffect(() => {
    if (!enabled) return undefined;

    const markActive = () => { activeRef.current = true; };
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));

    const tick = () => {
      const wasActive = activeRef.current && document.visibilityState === 'visible';
      activeRef.current = false;
      if (firedRef.current || blockedRef.current) return;
      if (wasActive) addActiveMs(TICK_MS);
      if (getActiveMs() >= thresholdMs) {
        firedRef.current = true;
        onEligibleRef.current?.();
      }
    };
    const interval = setInterval(tick, TICK_MS);
    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActive));
      clearInterval(interval);
    };
  }, [enabled, thresholdMs]);
}

export default useFeedbackPrompt;
