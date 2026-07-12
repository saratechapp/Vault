import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import IdleLogoutManager from '../IdleLogoutManager.jsx';

// This suite tests IdleLogoutManager's own wiring (does it show the warning
// at the right time, does it call logout when the countdown expires) — the
// underlying useIdleTimer hook's own timer/listener logic is covered by its
// own dedicated test (hooks/__tests__/useIdleTimer.test.js), so it's used
// here for real rather than re-mocked.
const logout = vi.fn();
let authValue;
vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => authValue,
}));

let prefsValue;
vi.mock('../../context/PreferencesContext.jsx', () => ({
  usePreferences: () => prefsValue,
}));

// autoLogoutIdleMinutes: 1 -> idleMs = Math.max(60_000, 1*60_000) = 60_000,
// a clean round number to advance fake timers by.
function setup({ isAuthed = true, autoLogoutEnabled = true } = {}) {
  authValue = { isAuthed, logout };
  prefsValue = { prefs: { autoLogoutEnabled, autoLogoutIdleMinutes: 1 } };
}

beforeEach(() => {
  logout.mockClear();
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  // globals: false in vite.config.js means @testing-library/react's
  // auto-cleanup (which only self-registers if it detects a *global*
  // afterEach) never kicks in, so each render() leaks its DOM into the next
  // test unless cleaned up explicitly. Unmount while timers are still fake
  // so any effect-cleanup clearTimeout/clearInterval calls resolve cleanly.
  act(() => { cleanup(); });
  vi.useRealTimers();
});

describe('IdleLogoutManager', () => {
  it('renders nothing when not authenticated', () => {
    setup({ isAuthed: false });
    render(<IdleLogoutManager />);
    expect(screen.queryByText('Are you still there?')).not.toBeInTheDocument();
  });

  it('renders nothing when auto-logout is disabled in preferences', () => {
    setup({ autoLogoutEnabled: false });
    render(<IdleLogoutManager />);
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(screen.queryByText('Are you still there?')).not.toBeInTheDocument();
  });

  it('shows the idle-warning countdown after the configured idle threshold', () => {
    setup();
    render(<IdleLogoutManager />);

    expect(screen.queryByText('Are you still there?')).not.toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(60_000); });

    expect(screen.getByText('Are you still there?')).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  it('calls logout with {reason: "idle"} once the warning countdown reaches zero', () => {
    setup();
    render(<IdleLogoutManager />);

    act(() => { vi.advanceTimersByTime(60_000); }); // idle threshold -> warning appears
    expect(screen.getByText('Are you still there?')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(60_000); }); // 60s countdown -> expires
    expect(logout).toHaveBeenCalledWith({ reason: 'idle' });
  });

  it('clicking "Stay signed in" during the warning cancels it without logging out', () => {
    setup();
    render(<IdleLogoutManager />);

    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText('Are you still there?')).toBeInTheDocument();

    act(() => { screen.getByRole('button', { name: 'Stay signed in' }).click(); });

    expect(screen.queryByText('Are you still there?')).not.toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();

    // Advancing well past the countdown length with the warning dismissed
    // must not retroactively log out — a fresh idle timer should have
    // restarted instead.
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(logout).not.toHaveBeenCalled();
  });

  it('"Sign out now" calls logout immediately during the warning', () => {
    setup();
    render(<IdleLogoutManager />);

    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText('Are you still there?')).toBeInTheDocument();

    act(() => { screen.getByRole('button', { name: 'Sign out now' }).click(); });

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
