import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useIdleTimer } from '../useIdleTimer.js';
import { isIdleExpired, touchActivity } from '../../lib/idleSession.js';

// The hook delegates its "durable backstop" checks to lib/idleSession.js,
// which is covered by its own dedicated test suite (lib/__tests__/idleSession.test.js).
// Here we only care about this hook's own timer/listener wiring — mocking
// idleSession keeps that wiring deterministic and decoupled from
// idleSession's real localStorage/preferences logic.
vi.mock('../../lib/idleSession.js', () => ({
  isIdleExpired: vi.fn(() => false),
  touchActivity: vi.fn(),
}));

const BACKSTOP_CHECK_MS = 15_000;

describe('useIdleTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    isIdleExpired.mockReset();
    isIdleExpired.mockReturnValue(false);
    touchActivity.mockClear();
  });

  afterEach(() => {
    // globals: false means testing-library's own auto-cleanup (which relies
    // on detecting a global `afterEach`) never registers — without this,
    // event listeners from one test's renderHook leak into the next.
    cleanup();
    vi.useRealTimers();
  });

  it('fires onIdle after idleMs of no activity', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ enabled: true, idleMs: 5_000, onIdle }));

    vi.advanceTimersByTime(4_999);
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('resets the timer on a real activity event, so onIdle does not fire early', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ enabled: true, idleMs: 5_000, onIdle }));

    vi.advanceTimersByTime(3_000);
    window.dispatchEvent(new Event('mousemove'));

    // Original window would have expired at t=5000; it was reset at t=3000,
    // so it should now only fire at t=3000+5000=8000.
    vi.advanceTimersByTime(2_000); // t=5000
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2_999); // t=7999
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1); // t=8000
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('does nothing when enabled is false', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ enabled: false, idleMs: 1_000, onIdle }));

    window.dispatchEvent(new Event('mousemove'));
    vi.advanceTimersByTime(100_000);

    expect(onIdle).not.toHaveBeenCalled();
    expect(touchActivity).not.toHaveBeenCalled();
  });

  it('suspends firing while paused, without an immediate fire on unpause', () => {
    const onIdle = vi.fn();
    const { rerender } = renderHook(({ paused }) => useIdleTimer({ enabled: true, idleMs: 5_000, paused, onIdle }), {
      initialProps: { paused: true },
    });

    // Way past idleMs, but paused means no timer was ever armed.
    vi.advanceTimersByTime(20_000);
    expect(onIdle).not.toHaveBeenCalled();

    // Unpausing re-runs the effect and arms a fresh full-length timer —
    // it must not fire immediately just because time passed while paused.
    rerender({ paused: false });
    vi.advanceTimersByTime(4_999);
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('does not call touchActivity while paused, even on a real activity event', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ enabled: true, idleMs: 5_000, paused: true, onIdle }));

    touchActivity.mockClear();
    window.dispatchEvent(new Event('keydown'));

    expect(touchActivity).not.toHaveBeenCalled();
  });

  it('treats focus/visibilitychange as check-only: they never reset the countdown', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ enabled: true, idleMs: 5_000, onIdle }));

    vi.advanceTimersByTime(3_000);
    window.dispatchEvent(new Event('focus'));

    // If focus had reset the timer, it would now fire at t=8000 instead of
    // t=5000. isIdleExpired() is mocked false, so the backstop check itself
    // doesn't force a fire either — only the untouched original timeout does.
    vi.advanceTimersByTime(2_000); // t=5000
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('focus/visibilitychange trigger an immediate onIdle when the persisted session is already expired', () => {
    isIdleExpired.mockReturnValue(true);
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ enabled: true, idleMs: 100_000, onIdle }));

    window.dispatchEvent(new Event('focus'));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('document visibilitychange also performs the check-only backstop', () => {
    isIdleExpired.mockReturnValue(true);
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ enabled: true, idleMs: 100_000, onIdle }));

    document.dispatchEvent(new Event('visibilitychange'));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('the periodic backstop interval alone can trigger onIdle when the session is expired', () => {
    isIdleExpired.mockReturnValue(true);
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ enabled: true, idleMs: 100_000, onIdle }));

    // No dispatched events at all — only the BACKSTOP_CHECK_MS interval.
    vi.advanceTimersByTime(BACKSTOP_CHECK_MS);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('the backstop check no-ops while paused', () => {
    isIdleExpired.mockReturnValue(true);
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ enabled: true, idleMs: 100_000, paused: true, onIdle }));

    vi.advanceTimersByTime(BACKSTOP_CHECK_MS);
    expect(onIdle).not.toHaveBeenCalled();
  });
});
