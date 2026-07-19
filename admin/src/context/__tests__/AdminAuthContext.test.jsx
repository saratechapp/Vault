import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminAuthProvider, useAdminAuth } from '../AdminAuthContext.jsx';
import { supabase } from '../../lib/supabaseClient.js';
import { api } from '../../lib/api.js';

// vi.mock factories are hoisted above imports, so a top-level import of
// createMockSupabaseClient can't be referenced directly inside the factory
// (it would be used before initialization). A dynamic import inside the
// (async) factory sidesteps the hoisting problem.
vi.mock('../../lib/supabaseClient.js', async () => {
  const { createMockSupabaseClient } = await import('../../test/mockSupabaseClient.js');
  return { supabase: createMockSupabaseClient() };
});

vi.mock('../../lib/api.js', () => ({
  api: {
    get: vi.fn(),
  },
}));

const fakeSession = { access_token: 'token-123', user: { id: 'sb-user-1' } };
const fakeAdminProfile = { id: 'admin-1', name: 'Jane Admin', isSuperAdmin: false, permissions: ['users:view'] };

function Probe() {
  const { admin, isAuthed, ready, notAnAdmin, logout } = useAdminAuth();
  return (
    <div>
      <div data-testid="ready">{String(ready)}</div>
      <div data-testid="isAuthed">{String(isAuthed)}</div>
      <div data-testid="notAnAdmin">{String(notAnAdmin)}</div>
      <div data-testid="admin">{admin ? admin.name : 'none'}</div>
      <button onClick={() => logout()}>Log out</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AdminAuthProvider>
      <Probe />
    </AdminAuthProvider>
  );
}

describe('AdminAuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('populates session/admin state when getSession resolves a session and the profile fetch succeeds', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
    api.get.mockResolvedValue(fakeAdminProfile);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('true'));
    expect(screen.getByTestId('isAuthed')).toHaveTextContent('true');
    expect(screen.getByTestId('admin')).toHaveTextContent('Jane Admin');
    expect(screen.getByTestId('notAnAdmin')).toHaveTextContent('false');
    expect(api.get).toHaveBeenCalledWith('/me');
  });

  it('stays unauthenticated (ready, no admin) when there is no session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('true'));
    expect(screen.getByTestId('isAuthed')).toHaveTextContent('false');
    expect(screen.getByTestId('admin')).toHaveTextContent('none');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('sets notAnAdmin when the profile fetch rejects with "not_an_admin"', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
    api.get.mockRejectedValue(new Error('not_an_admin'));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('notAnAdmin')).toHaveTextContent('true'));
    expect(screen.getByTestId('isAuthed')).toHaveTextContent('false');
    expect(screen.getByTestId('admin')).toHaveTextContent('none');
  });

  it('logout clears state and calls supabase.auth.signOut', async () => {
    const user = userEvent.setup();
    supabase.auth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
    api.get.mockResolvedValue(fakeAdminProfile);

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('admin')).toHaveTextContent('Jane Admin'));

    await user.click(screen.getByText('Log out'));

    await waitFor(() => expect(screen.getByTestId('admin')).toHaveTextContent('none'));
    expect(screen.getByTestId('isAuthed')).toHaveTextContent('false');
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });
});
