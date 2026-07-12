import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RoleEditor from '../RoleEditor.jsx';
import { api } from '../../../lib/api.js';

vi.mock('../../../lib/api.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const catalog = {
  modules: {
    users: { label: 'Users', actions: ['view', 'edit', 'delete'] },
    feedback: { label: 'Feedback', actions: ['view', 'edit'] },
  },
};

function customRole(overrides = {}) {
  return {
    id: 'role-1',
    name: 'Support Agent',
    isSystem: false,
    permissions: [{ module: 'users', action: 'view' }],
    ...overrides,
  };
}

function renderEditor(id = 'role-1') {
  return render(
    <MemoryRouter initialEntries={[`/rbac/${id}`]}>
      <Routes>
        <Route path="/rbac/:id" element={<RoleEditor />} />
        <Route path="/rbac" element={<div>Role List Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RoleEditor', () => {
  beforeEach(() => {
    api.get.mockImplementation((path) => {
      if (path.startsWith('/rbac/roles/')) return Promise.resolve(customRole());
      if (path === '/rbac/permissions-catalog') return Promise.resolve(catalog);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    api.put.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the checkboxes pre-checked according to the role permissions from the server', async () => {
    renderEditor();
    expect(await screen.findByText('Support Agent')).toBeInTheDocument();

    const usersViewCheckbox = screen.getAllByRole('checkbox')[0];
    expect(usersViewCheckbox).toBeChecked();
  });

  it('toggling a checkbox updates the internal permission set (reflected in checked state)', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByText('Support Agent');

    const checkboxes = screen.getAllByRole('checkbox');
    // users:view starts checked; users:edit (index 1) starts unchecked.
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();

    await user.click(checkboxes[1]);
    expect(checkboxes[1]).toBeChecked();

    await user.click(checkboxes[0]);
    expect(checkboxes[0]).not.toBeChecked();
  });

  it('serializes the toggled selection back into a {module, action} array on save', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByText('Support Agent');

    // Starting state: users:view only. Toggle on users:edit, toggle off users:view.
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]); // users:edit -> on
    await user.click(checkboxes[0]); // users:view -> off

    await user.click(screen.getByRole('button', { name: /save permissions/i }));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [path, body] = api.put.mock.calls[0];
    expect(path).toBe('/rbac/roles/role-1/permissions');
    expect(body.permissions).toEqual(
      expect.arrayContaining([{ module: 'users', action: 'edit' }])
    );
    expect(body.permissions).not.toEqual(
      expect.arrayContaining([{ module: 'users', action: 'view' }])
    );
    expect(body.permissions).toHaveLength(1);
  });

  it('renders the system Super Admin role as read-only with no checkboxes or save action', async () => {
    api.get.mockImplementation((path) => {
      if (path.startsWith('/rbac/roles/')) {
        return Promise.resolve(customRole({ id: 'role-super', name: 'Super Admin', isSystem: true, permissions: [] }));
      }
      if (path === '/rbac/permissions-catalog') return Promise.resolve(catalog);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });

    renderEditor('role-super');
    expect(await screen.findByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByText(/bypasses this permission matrix entirely/i)).toBeInTheDocument();

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /save permissions/i })).not.toBeInTheDocument();
  });
});
