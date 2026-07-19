import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Transactions from '../Transactions.jsx';
import { transactionsApi, categoriesApi, accountsApi, goalsApi } from '../../lib/api.js';

// `globals: false` (see vite.config.js) means @testing-library/react's
// auto-cleanup-after-each never registers, so every render here must be
// unmounted explicitly or later tests see leftover DOM from earlier ones.
afterEach(() => cleanup());

vi.mock('../../lib/api.js', async () => {
  const actual = await vi.importActual('../../lib/api.js');
  return {
    ...actual,
    transactionsApi: { list: vi.fn(), remove: vi.fn(), bulk: vi.fn() },
    categoriesApi: { list: vi.fn() },
    accountsApi: { list: vi.fn() },
    goalsApi: { list: vi.fn() },
  };
});

vi.mock('../../context/AccountsGateContext.jsx', () => ({
  useAccountsGate: () => ({ loaded: true, hasAccounts: true, accountCount: 1, refresh: vi.fn() }),
}));

vi.mock('../../context/NewTransactionContext.jsx', async () => {
  const actual = await vi.importActual('../../context/NewTransactionContext.jsx');
  return {
    ...actual,
    useNewTransaction: () => ({ open: vi.fn(), openForEdit: vi.fn() }),
  };
});

const TRANSACTIONS_FIXTURE = [
  { id: 't1', type: 'expense', date: '2026-01-05', vendor: 'Coffee Shop', accountId: 'a1', categoryId: 'c1', amount: -50, labels: [] },
  { id: 't2', type: 'income', date: '2026-01-04', vendor: 'Employer', accountId: 'a1', categoryId: 'c2', amount: 3000, labels: [] },
];
const CATEGORIES_FIXTURE = [{ id: 'c1', name: 'Food', color: '#000', icon: 'Circle' }, { id: 'c2', name: 'Salary', color: '#000', icon: 'Circle' }];
const ACCOUNTS_FIXTURE = [{ id: 'a1', name: 'Checking', openingBalance: 0 }];

describe('Transactions page filter UI (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionsApi.list.mockResolvedValue(TRANSACTIONS_FIXTURE);
    categoriesApi.list.mockResolvedValue(CATEGORIES_FIXTURE);
    accountsApi.list.mockResolvedValue(ACCOUNTS_FIXTURE);
    goalsApi.list.mockResolvedValue([]);
  });

  it('renders the filter controls and transaction rows without crashing', async () => {
    render(
      <MemoryRouter>
        <Transactions />
      </MemoryRouter>
    );

    expect(await screen.findByText('Coffee Shop')).toBeInTheDocument();
    expect(screen.getByText('Employer')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search vendor, note, category, label, account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Min amount/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Max amount/i)).toBeInTheDocument();
  });

  it('renders the type/account/category filter selects', async () => {
    render(
      <MemoryRouter>
        <Transactions />
      </MemoryRouter>
    );
    await screen.findByText('Coffee Shop');
    expect(screen.getByText('All types')).toBeInTheDocument();
    expect(screen.getByText('All accounts')).toBeInTheDocument();
    expect(screen.getByText('All categories')).toBeInTheDocument();
  });
});
