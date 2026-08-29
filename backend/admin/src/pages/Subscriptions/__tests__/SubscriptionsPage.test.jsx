import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SubscriptionsPage from '../SubscriptionsPage.jsx';
import { api } from '../../../lib/api.js';
import { useAdminAuth } from '../../../context/AdminAuthContext.jsx';

vi.mock('../../../lib/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../../context/AdminAuthContext.jsx', () => ({ useAdminAuth: vi.fn() }));

const settings = {
  trialEnabled: false,
  trialDurationMonths: 1,
  enforcementStartedAt: null,
  enforcementEnabled: false,
  defaultCurrency: 'INR',
  updatedAt: null,
};
const overview = {
  trialEnabled: false,
  counts: { FREE_ACCESS: 5, FREE_TRIAL: 2, ACTIVE: 0, EXPIRED: 1, CANCELLED: 0 },
  unresolved: 0,
};
const prices = {
  rows: [{ currency: 'INR', monthlyPrice: 50, yearlyPrice: 500, enabled: true }],
  defaultCurrency: 'INR',
  addable: [{ code: 'USD', name: 'US Dollar', symbol: '$' }],
};

function setup({ isSuperAdmin = true } = {}) {
  useAdminAuth.mockReturnValue({ admin: { id: 'a1', isSuperAdmin, permissions: isSuperAdmin ? 'all' : [] } });
  api.get.mockImplementation((path) => {
    if (path === '/subscriptions/settings') return Promise.resolve({ ...settings });
    if (path === '/subscriptions/overview') return Promise.resolve({ ...overview });
    if (path === '/subscriptions/prices') return Promise.resolve(JSON.parse(JSON.stringify(prices)));
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
  api.put.mockResolvedValue({ ...settings, trialEnabled: true, enforcementStartedAt: '2026-02-01T00:00:00.000Z' });
  return render(
    <MemoryRouter>
      <SubscriptionsPage />
    </MemoryRouter>
  );
}

describe('SubscriptionsPage — Settings tab', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('loads settings, status counts, and the enforcement + default-currency controls', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: /subscription enforcement/i })).toBeInTheDocument();
    expect(screen.getByText(/FREE TRIAL: 2/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^free trial$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/default currency/i)).toBeInTheDocument();
  });

  it('as Super Admin: toggling the trial switch and saving calls PUT /subscriptions/settings with all fields', async () => {
    const user = userEvent.setup();
    setup({ isSuperAdmin: true });
    await screen.findByText(/subscription enforcement/i);

    await user.click(screen.getAllByRole('checkbox')[0]); // Free Trial switch
    const save = screen.getByRole('button', { name: /save changes/i });
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/subscriptions/settings',
      expect.objectContaining({
        trialEnabled: true, trialDurationMonths: 1, enforcementEnabled: false, defaultCurrency: 'INR',
      }),
    ));
  });

  it('as a non-Super-Admin: switches and Save are disabled', async () => {
    setup({ isSuperAdmin: false });
    await screen.findByText(/only the super admin can change them/i);
    screen.getAllByRole('checkbox').forEach((cb) => expect(cb).toBeDisabled());
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });
});

describe('SubscriptionsPage — Pricing tab', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('shows the configured INR row and, on edit + Save, calls PUT /subscriptions/prices/INR', async () => {
    const user = userEvent.setup();
    setup({ isSuperAdmin: true });
    await user.click(await screen.findByRole('tab', { name: /pricing/i }));

    const inrRow = (await screen.findByText('INR')).closest('tr');
    const monthly = within(inrRow).getAllByRole('spinbutton')[0];
    await user.clear(monthly);
    await user.type(monthly, '79');
    api.put.mockResolvedValueOnce({ currency: 'INR', monthlyPrice: 79, yearlyPrice: 500, enabled: true });
    await user.click(within(inrRow).getByRole('button', { name: /save/i }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/subscriptions/prices/INR',
      expect.objectContaining({ monthlyPrice: 79, yearlyPrice: 500, enabled: true }),
    ));
  });

  it('as a non-Super-Admin: price inputs are disabled', async () => {
    const user = userEvent.setup();
    setup({ isSuperAdmin: false });
    await user.click(await screen.findByRole('tab', { name: /pricing/i }));
    const inrRow = (await screen.findByText('INR')).closest('tr');
    within(inrRow).getAllByRole('spinbutton').forEach((i) => expect(i).toBeDisabled());
  });
});
