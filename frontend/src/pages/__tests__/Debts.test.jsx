import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Debts from '../Debts.jsx';
import { debtsApi, accountsApi, transactionsApi } from '../../lib/api.js';

// `globals: false` (see vite.config.js) means @testing-library/react's
// auto-cleanup-after-each never registers (it only self-installs when it
// detects a global `afterEach`), so every RTL render in this file must be
// unmounted explicitly or later tests see leftover DOM from earlier ones.
afterEach(() => cleanup());

// The payoff planner chart uses recharts' ResponsiveContainer, which needs
// ResizeObserver — not implemented in jsdom. A minimal stub is enough since
// this test never asserts on the chart's rendered size.
beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

vi.mock('../../lib/api.js', async () => {
  const actual = await vi.importActual('../../lib/api.js');
  return {
    ...actual,
    debtsApi: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      pay: vi.fn(),
    },
    accountsApi: { list: vi.fn() },
    transactionsApi: { list: vi.fn() },
  };
});

vi.mock('../../context/AccountsGateContext.jsx', () => ({
  useAccountsGate: () => ({ loaded: true, hasAccounts: true, accountCount: 1, refresh: vi.fn() }),
}));

const DEBTS_FIXTURE = [
  { id: 'd1', name: 'Credit Card', creditor: 'Bank A', balance: 5000, apr: 24, minPayment: 100, dueDate: '2026-08-01' },
  { id: 'd2', name: 'Car Loan', creditor: 'Bank B', balance: 12000, apr: 8, minPayment: 250, dueDate: '2026-08-05' },
];
const ACCOUNTS_FIXTURE = [{ id: 'a1', name: 'Checking' }];

describe('Debts page (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    debtsApi.list.mockResolvedValue(DEBTS_FIXTURE);
    accountsApi.list.mockResolvedValue(ACCOUNTS_FIXTURE);
    transactionsApi.list.mockResolvedValue([]);
  });

  it('renders debt rows without crashing', async () => {
    render(<Debts />);
    expect(await screen.findByText('Credit Card')).toBeInTheDocument();
    expect(screen.getByText('Car Loan')).toBeInTheDocument();
  });

  it('switches between avalanche and snowball strategy toggles', async () => {
    const user = userEvent.setup();
    render(<Debts />);
    await screen.findByText('Credit Card');

    const avalancheBtn = screen.getByRole('button', { name: /Avalanche/i });
    const snowballBtn = screen.getByRole('button', { name: /Snowball/i });

    // Avalanche is the default strategy.
    expect(avalancheBtn.className).toMatch(/bg-brand-500/);
    expect(snowballBtn.className).not.toMatch(/bg-brand-500/);

    await user.click(snowballBtn);

    await waitFor(() => {
      expect(snowballBtn.className).toMatch(/bg-brand-500/);
    });
    expect(avalancheBtn.className).not.toMatch(/bg-brand-500/);
  });

  it('renders the empty state when there are no debts', async () => {
    debtsApi.list.mockResolvedValue([]);
    render(<Debts />);
    expect(await screen.findByText(/No debts yet/i)).toBeInTheDocument();
  });
});
