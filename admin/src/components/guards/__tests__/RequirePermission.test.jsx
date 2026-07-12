import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequirePermission } from '../RequirePermission.jsx';
import { useAdminAuth } from '../../../context/AdminAuthContext.jsx';

vi.mock('../../../context/AdminAuthContext.jsx', () => ({
  useAdminAuth: vi.fn(),
}));

function renderGuard(admin) {
  useAdminAuth.mockReturnValue({ admin });
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/" element={<div>Home Page</div>} />
        <Route
          path="/protected"
          element={
            <RequirePermission module="users" action="view">
              <div>Protected Content</div>
            </RequirePermission>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('RequirePermission', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the guarded children when the admin has the required permission', () => {
    renderGuard({ permissions: ['users:view'] });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Home Page')).not.toBeInTheDocument();
  });

  it('renders the guarded children for a super-admin regardless of permissions array', () => {
    renderGuard({ isSuperAdmin: true, permissions: [] });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders the guarded children for permissions === "all"', () => {
    renderGuard({ permissions: 'all' });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to "/" when the admin lacks the required permission', () => {
    renderGuard({ permissions: ['feedback:view'] });
    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to "/" when there is no admin at all', () => {
    renderGuard(null);
    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
