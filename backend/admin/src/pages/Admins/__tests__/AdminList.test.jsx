import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminList from '../AdminList.jsx';
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

const roles = [
  { id: 'role-1', name: 'Support Agent' },
  { id: 'role-2', name: 'Super Admin' },
];

const adminRows = [
  { id: 'me-1', name: 'Current User', email: 'me@example.com', department: 'Ops', status: 'active', roleId: 'role-1', roleName: 'Support Agent' },
  { id: 'other-2', name: 'Other Admin', email: 'other@example.com', department: 'Support', status: 'active', roleId: 'role-1', roleName: 'Support Agent' },
];

function renderAdminList(currentAdmin) {
  useAdminAuth.mockReturnValue({ admin: currentAdmin });
  return render(<AdminList />);
}

describe('AdminList', () => {
  beforeEach(() => {
    api.get.mockImplementation((path) => {
      if (path === '/admins') return Promise.resolve(adminRows);
      if (path === '/rbac/roles') return Promise.resolve(roles);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    api.post.mockResolvedValue({});
    api.patch.mockResolvedValue({});
    api.delete.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows a validation error and does not call the create API when email is missing', async () => {
    const user = userEvent.setup();
    renderAdminList({ id: 'me-1' });
    await screen.findByText('Current User');

    await user.click(screen.getByRole('button', { name: /invite admin/i }));
    await screen.findByLabelText(/^email/i);

    // The Email field has a native HTML5 "required" attribute, which makes
    // jsdom's own constraint validation swallow a real button click before
    // React's onSubmit ever runs (this also matches real browser behavior:
    // the native "please fill out this field" tooltip would show instead of
    // reaching our code). Submitting the form directly exercises the app's
    // own validation logic in isolation, the same way it would run for
    // fields the browser doesn't natively validate (e.g. the role select).
    fireEvent.submit(document.querySelector('form'));

    expect(await screen.findByText(/email and role are required/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows a validation error and does not call the create API when roleId is missing', async () => {
    const user = userEvent.setup();
    renderAdminList({ id: 'me-1' });
    await screen.findByText('Current User');

    await user.click(screen.getByRole('button', { name: /invite admin/i }));
    await user.type(await screen.findByLabelText(/^email/i), 'new@example.com');

    fireEvent.submit(document.querySelector('form'));

    expect(await screen.findByText(/email and role are required/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('calls the create API with the right payload on a valid submission', async () => {
    const user = userEvent.setup();
    renderAdminList({ id: 'me-1' });
    await screen.findByText('Current User');

    await user.click(screen.getByRole('button', { name: /invite admin/i }));
    await user.type(await screen.findByLabelText(/^email/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^name$/i), 'New Admin');
    await user.click(screen.getByLabelText(/^role/i));
    await user.click(await screen.findByRole('option', { name: 'Support Agent' }));

    fireEvent.submit(document.querySelector('form'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admins', expect.objectContaining({
      email: 'new@example.com',
      name: 'New Admin',
      roleId: 'role-1',
    })));
  });

  it('disables the delete action for the row matching the currently logged-in admin', async () => {
    const user = userEvent.setup();
    renderAdminList({ id: 'me-1' });
    await screen.findByText('Current User');

    // Open the menu for the "Current User" row (me-1) — same id as currentAdmin.
    const menuButtons = screen.getAllByTestId('MoreVertIcon').map((icon) => icon.closest('button'));
    await user.click(menuButtons[0]);

    const deleteItem = await screen.findByText('Delete');
    expect(deleteItem.closest('li')).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not disable the delete action for a row that is not the currently logged-in admin', async () => {
    const user = userEvent.setup();
    renderAdminList({ id: 'me-1' });
    await screen.findByText('Other Admin');

    const menuButtons = screen.getAllByTestId('MoreVertIcon').map((icon) => icon.closest('button'));
    await user.click(menuButtons[1]); // "Other Admin" row (other-2)

    const deleteItem = await screen.findByText('Delete');
    expect(deleteItem.closest('li')).not.toHaveAttribute('aria-disabled', 'true');
  });
});
