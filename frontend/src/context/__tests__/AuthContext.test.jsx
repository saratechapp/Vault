import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { createMockSupabaseClient } from '../../test/mockSupabaseClient.js';
import { AuthProvider, useAuth } from '../AuthContext.jsx';
import { SESSION_EXPIRED_REASON_KEY } from '../../lib/idleSession.js';

// This suite deliberately stays narrow: it exercises only this app's own
// state-transition logic (session/user/needsPassword/logout) given a
// mocked Supabase response — never real OAuth redirects or Supabase's own
// token-refresh internals, which are Supabase's responsibility, not this
// app's. See CLAUDE.md / task notes for why.
let supabaseMock;
vi.mock('../../lib/supabaseClient.js', () => ({
  get supabase() {
    return supabaseMock;
  },
  REMEMBER_ME_KEY: 'wallet_remember_me',
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('../../lib/api.js', () => ({
  api: {
    get: (...args) => apiGet(...args),
    post: (...args) => apiPost(...args),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function withSession(overrides = {}) {
  return { user: { id: 'user-1' }, access_token: 'tok-1', ...overrides };
}

function mockUserProfile(profile) {
  apiGet.mockImplementation((path) => (path === '/me' ? Promise.resolve({ user: profile }) : Promise.resolve({})));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  apiGet.mockReset();
  apiPost.mockReset();
  apiPost.mockResolvedValue({});
  supabaseMock = createMockSupabaseClient();
});

// globals: false in vite.config.js means @testing-library/react's
// auto-cleanup (which only self-registers if it detects a *global*
// afterEach) never kicks in, so each renderHook() leaks into the next test
// unless cleaned up explicitly.
afterEach(cleanup);

describe('AuthContext — session bootstrap', () => {
  it('populates session/userId and flips ready once getSession & /me both resolve', async () => {
    const fakeSession = withSession();
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
    mockUserProfile({ id: 'user-1', hasPassword: true, name: 'Jane' });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));

    // AuthContext doesn't expose the raw Supabase `session` object itself —
    // only userId/isAuthed derived from it — so those are what's asserted.
    expect(result.current.userId).toBe('user-1');
    expect(result.current.isAuthed).toBe(true);
  });

  it('leaves userId empty and isAuthed false when there is no session', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.userId).toBeNull();
    expect(result.current.isAuthed).toBe(false);
  });
});

describe('AuthContext — needsPassword', () => {
  it('is true once the profile has loaded and hasPassword is false', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: withSession() }, error: null });
    mockUserProfile({ id: 'user-1', hasPassword: false, name: 'Jane' });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.needsPassword).toBe(true));
  });

  it('is false when the profile has hasPassword: true', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: withSession() }, error: null });
    mockUserProfile({ id: 'user-1', hasPassword: true, name: 'Jane' });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.user).not.toBeNull());
    expect(result.current.needsPassword).toBe(false);
  });

  it('is false with no session at all', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.needsPassword).toBe(false);
  });
});

describe('AuthContext — logout', () => {
  it('clears session/user state and calls supabase.auth.signOut', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: withSession() }, error: null });
    mockUserProfile({ id: 'user-1', hasPassword: true, name: 'Jane' });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isAuthed).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    // isAuthed (derived from session) and user both clearing is the
    // observable proof session/user state was reset — session itself isn't
    // part of the exposed context value.
    expect(result.current.user).toBeNull();
    expect(result.current.userId).toBeNull();
    expect(result.current.isAuthed).toBe(false);
    expect(supabaseMock.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('logout({reason: "idle"}) marks the session-expired flag', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: withSession() }, error: null });
    mockUserProfile({ id: 'user-1', hasPassword: true, name: 'Jane' });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isAuthed).toBe(true));

    expect(sessionStorage.getItem(SESSION_EXPIRED_REASON_KEY)).toBeNull();

    await act(async () => {
      await result.current.logout({ reason: 'idle' });
    });

    expect(sessionStorage.getItem(SESSION_EXPIRED_REASON_KEY)).toBe('1');
  });

  it('a plain logout() (no reason) does not mark the session-expired flag', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: withSession() }, error: null });
    mockUserProfile({ id: 'user-1', hasPassword: true, name: 'Jane' });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isAuthed).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    expect(sessionStorage.getItem(SESSION_EXPIRED_REASON_KEY)).toBeNull();
  });
});

describe('AuthContext — loginWithOAuth', () => {
  it('calls supabase.auth.signInWithOAuth with the requested provider (redirect behavior itself is out of scope)', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.loginWithOAuth('google');
    });

    expect(supabaseMock.auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' })
    );
  });
});
