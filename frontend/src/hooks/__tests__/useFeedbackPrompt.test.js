import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useFeedbackPrompt, DEFAULT_FEEDBACK_THRESHOLD_MS } from '../useFeedbackPrompt.js';

const TICK_MS = 15_000;
const ACTIVE_MS_KEY = 'wallet_feedback_active_ms';

function fireActivity() {
  window.dispatchEvent(new Event('mousemove'));
}

describe('useFeedbackPrompt', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    // Make jsdom's visibility state explicit/deterministic regardless of
    // environment defaults, since the hook gates accumulation on it.
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  afterEach(() => {
    // globals: false means testing-library's own auto-cleanup never
    // registers itself — do it explicitly so listeners don't leak across tests.
    cleanup();
    vi.useRealTimers();
  });

  it('exports the documented default threshold (7 minutes)', () => {
    expect(DEFAULT_FEEDBACK_THRESHOLD_MS).toBe(7 * 60_000);
  });

  it('never fires onEligible when enabled is false, even with activity and elapsed time', () => {
    const onEligible = vi.fn();
    renderHook(() => useFeedbackPrompt({ enabled: false, thresholdMs: 30_000, onEligible }));

    for (let i = 0; i < 40; i += 1) {
      fireActivity();
      vi.advanceTimersByTime(TICK_MS);
    }

    expect(onEligible).not.toHaveBeenCalled();
  });

  it('suppresses firing when blocked is true, even once accumulated time already meets the threshold', () => {
    localStorage.setItem(ACTIVE_MS_KEY, String(60_000));
    const onEligible = vi.fn();
    renderHook(() => useFeedbackPrompt({ enabled: true, thresholdMs: 30_000, blocked: true, onEligible }));

    fireActivity();
    vi.advanceTimersByTime(TICK_MS);
    fireActivity();
    vi.advanceTimersByTime(TICK_MS);

    expect(onEligible).not.toHaveBeenCalled();
  });

  it('fires as soon as the (already-met) threshold is checked, when not blocked (control case)', () => {
    localStorage.setItem(ACTIVE_MS_KEY, String(60_000));
    const onEligible = vi.fn();
    renderHook(() => useFeedbackPrompt({ enabled: true, thresholdMs: 30_000, blocked: false, onEligible }));

    vi.advanceTimersByTime(TICK_MS);

    expect(onEligible).toHaveBeenCalledTimes(1);
  });

  it('fires onEligible exactly once after cumulative active time crosses thresholdMs', () => {
    const onEligible = vi.fn();
    renderHook(() => useFeedbackPrompt({ enabled: true, thresholdMs: 30_000, onEligible }));

    // Tick 1: active -> accumulates 15_000ms, below the 30_000ms threshold.
    fireActivity();
    vi.advanceTimersByTime(TICK_MS);
    expect(onEligible).not.toHaveBeenCalled();

    // Tick 2: active -> accumulates to 30_000ms, meets the threshold.
    fireActivity();
    vi.advanceTimersByTime(TICK_MS);
    expect(onEligible).toHaveBeenCalledTimes(1);

    // Further ticks (even with more activity) must not fire it again.
    fireActivity();
    vi.advanceTimersByTime(TICK_MS);
    fireActivity();
    vi.advanceTimersByTime(TICK_MS);
    expect(onEligible).toHaveBeenCalledTimes(1);
  });

  it('does not accumulate active time for ticks with no activity', () => {
    const onEligible = vi.fn();
    renderHook(() => useFeedbackPrompt({ enabled: true, thresholdMs: 30_000, onEligible }));

    // No activity dispatched — tick should not add to the persisted total.
    vi.advanceTimersByTime(TICK_MS);
    expect(localStorage.getItem(ACTIVE_MS_KEY)).toBeFalsy();
    expect(onEligible).not.toHaveBeenCalled();
  });
});
