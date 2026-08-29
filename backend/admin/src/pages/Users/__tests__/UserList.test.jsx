import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import UserList from '../UserList.jsx';
import { api } from '../../../lib/api.js';
import { useAdminAuth } from '../../../context/AdminAuthContext.jsx';

vi.mock('../../../lib/api.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../context/AdminAuthContext.jsx', () => ({
  useAdminAuth: vi.fn(),
}));

// MUI DataGrid (v7) relies on ResizeObserver for virtualization/auto-sizing,
// which jsdom does not implement. A minimal no-op stub is enough for rows to
// render in the test DOM.
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const fixtureUser = {
  id: 'u1',
  name: 'Alice Smith',
  email: 'alice@example.com',
  phone: '555-0100',
  country: 'US',
  currency: 'USD',
  plan: 'Free',
  memberSince: '2024-01-01',
  status: 'active',
};

function mockAdmin(permissions) {
  useAdminAuth.mockReturnValue({ admin: { permissions } });
}

function renderUserList() {
  return render(
    <MemoryRouter>
      <UserList />
    </MemoryRouter>
  );
}

function lastCallUrl() {
  const calls = api.get.mock.calls;
  return calls[calls.length - 1][0];
}

describe('UserList', () => {
  beforeEach(() => {
    api.get.mockResolvedValue({ rows: [fixtureUser], total: 50 });
    api.post.mockResolvedValue({});
    api.patch.mockResolvedValue({});
    api.delete.mockResolvedValue(null);
    mockAdmin(['users:edit', 'users:suspend', 'users:delete', 'users:impersonate']);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('fetches the first page on mount and renders the returned users', async () => {
    renderUserList();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(await screen.findByText('Alice Smith')).toBeInTheDocument();

    const url = lastCallUrl();
    expect(url).toContain('/users?');
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('page')).toBe('1');
    expect(params.get('pageSize')).toBe('25');
  });

  it('requests the next page with the correct page param when paginating', async () => {
    const user = userEvent.setup();
    renderUserList();
    await screen.findByText('Alice Smith');
    api.get.mockClear();

    await user.click(screen.getByRole('button', { name: /go to next page/i }));

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    const params = new URLSearchParams(lastCallUrl().split('?')[1]);
    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('25');
  });

  it('re-fetches with the search query param when the search box changes', async () => {
    const user = userEvent.setup();
    renderUserList();
    await screen.findByText('Alice Smith');
    api.get.mockClear();

    const searchInput = screen.getByLabelText(/search name, email, phone/i);
    await user.type(searchInput, 'alice');

    await waitFor(() => {
      const params = new URLSearchParams(lastCallUrl().split('?')[1]);
      expect(params.get('search')).toBe('alice');
    });
    // Typing resets to the first page.
    const params = new URLSearchParams(lastCallUrl().split('?')[1]);
    expect(params.get('page')).toBe('1');
  });

  it('re-fetches with the status filter param and resets to the first page', async () => {
    const user = userEvent.setup();
    renderUserList();
    await screen.findByText('Alice Smith');
    api.get.mockClear();

    await user.click(screen.getByRole('button', { name: /go to next page/i }));
    await waitFor(() => {
      const params = new URLSearchParams(lastCallUrl().split('?')[1]);
      expect(params.get('page')).toBe('2');
    });
    api.get.mockClear();

    await user.click(screen.getByLabelText('Status'));
    await user.click(await screen.findByRole('option', { name: 'Suspended' }));

    await waitFor(() => {
      const params = new URLSearchParams(lastCallUrl().split('?')[1]);
      expect(params.get('status')).toBe('suspended');
    });
    const params = new URLSearchParams(lastCallUrl().split('?')[1]);
    expect(params.get('page')).toBe('1');
  });

  it('re-fetches with the plan filter param', async () => {
    const user = userEvent.setup();
    renderUserList();
    await screen.findByText('Alice Smith');
    api.get.mockClear();

    await user.click(screen.getByLabelText('Plan'));
    await user.click(await screen.findByRole('option', { name: 'Premium' }));

    await waitFor(() => {
      const params = new URLSearchParams(lastCallUrl().split('?')[1]);
      expect(params.get('plan')).toBe('Premium');
    });
  });

  async function openRowMenu() {
    const user = userEvent.setup();
    const menuButton = screen.getByTestId('MoreVertIcon').closest('button');
    await user.click(menuButton);
    return user;
  }

  it('hides permission-gated row actions when the admin lacks the permission', async () => {
    mockAdmin([]); // no permissions at all
    renderUserList();
    await screen.findByText('Alice Smith');

    await openRowMenu();

    expect(screen.getByText('View profile')).toBeInTheDocument();
    expect(screen.queryByText('Reset password')).not.toBeInTheDocument();
    expect(screen.queryByText('Force logout')).not.toBeInTheDocument();
    expect(screen.queryByText('Suspend')).not.toBeInTheDocument();
    expect(screen.queryByText('Login as user')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('shows permission-gated row actions when the admin has the permissions', async () => {
    mockAdmin(['users:edit', 'users:suspend', 'users:delete', 'users:impersonate']);
    renderUserList();
    await screen.findByText('Alice Smith');

    await openRowMenu();

    expect(screen.getByText('View profile')).toBeInTheDocument();
    expect(screen.getByText('Reset password')).toBeInTheDocument();
    expect(screen.getByText('Force logout')).toBeInTheDocument();
    expect(screen.getByText('Suspend')).toBeInTheDocument();
    expect(screen.getByText('Login as user')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls the suspend API with the correct user id when Suspend is clicked', async () => {
    renderUserList();
    await screen.findByText('Alice Smith');

    const user = await openRowMenu();
    await user.click(screen.getByText('Suspend'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users/u1/suspend'));
  });

  it('calls the delete API with the correct user id after confirming', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderUserList();
    await screen.findByText('Alice Smith');

    const user = await openRowMenu();
    await user.click(screen.getByText('Delete'));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/users/u1'));
    confirmSpy.mockRestore();
  });

  it('does not call the delete API when the confirm dialog is declined', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderUserList();
    await screen.findByText('Alice Smith');

    const user = await openRowMenu();
    await user.click(screen.getByText('Delete'));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(api.delete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
