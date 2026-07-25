import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Bills from '../Bills.jsx';
import { billsApi, categoriesApi, accountsApi } from '../../lib/api.js';

// Partial mock: keep the real formatCurrency/formatDate (pure, deterministic
// given the seeded prefs below) but stub out every network-backed API the
// page calls, so no real fetch/Supabase call is ever attempted.
vi.mock('../../lib/api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    billsApi: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
    categoriesApi: { ...actual.categoriesApi, list: vi.fn() },
    accountsApi: { ...actual.accountsApi, list: vi.fn() },
  };
});

// The Bills page only cares about `loaded`/`hasAccounts` from this context;
// its own refresh-on-account-change wiring is exercised by its own tests.
vi.mock('../../context/AccountsGateContext.jsx', () => ({
  useAccountsGate: () => ({ loaded: true, hasAccounts: true, accountCount: 2, refresh: vi.fn() }),
}));

const ACCOUNTS = [
  { id: 'acc1', name: 'Checking', color: '#6366f1', icon: 'Wallet' },
  { id: 'acc2', name: 'Savings', color: '#22c55e', icon: 'PiggyBank' },
];
const CATEGORIES = [
  { id: 'cat1', name: 'Housing', color: '#f43f5e', icon: 'Home' },
  { id: 'cat2', name: 'Subscriptions', color: '#0ea5e9', icon: 'Tv' },
];

function daysFromNow(n) {
  return new Date(Date.now() + n * 86400000).toISOString();
}

function makeBill(overrides = {}) {
  return {
    id: 'bill1', name: 'Rent', type: 'expense', amount: 100, category: 'Rent', categoryId: 'cat1',
    dueDate: daysFromNow(0), frequency: 'monthly', vendor: '', paymentMethod: 'Bank Transfer', note: '',
    labels: ['Expenditure'], active: true, status: 'pending',
    accountId: 'acc1', fromAccountId: 'acc1', toAccountId: 'acc2',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  categoriesApi.list.mockResolvedValue(CATEGORIES);
  accountsApi.list.mockResolvedValue(ACCOUNTS);
});

// globals: false in vite.config.js means @testing-library/react's
// auto-cleanup (which only self-registers if it detects a *global*
// afterEach) never kicks in, so each render() leaks its DOM into the next
// test unless cleaned up explicitly.
afterEach(cleanup);

// Finds the urgency Chip (the one carrying "Due ...") inside a given bill
// card. Deliberately a plain DOM query rather than screen.getByText — the
// text "Due ..." is also a substring of several ancestor elements'
// textContent (Card, grid wrapper, ...), which would make getByText throw
// on "multiple elements found".
function urgencyChip(card) {
  const chips = card.querySelectorAll('.chip');
  return Array.from(chips).find((el) => el.textContent.trim().startsWith('Due'));
}

function billCardByName(container, name) {
  const heading = within(container).getByText(name);
  return heading.closest('.card');
}

describe('Bills page — urgency rendering (indirect urgencyDays coverage)', () => {
  it('shows an overdue bill as urgent (danger tone) with "day(s) ago" wording', async () => {
    billsApi.list.mockResolvedValue([
      makeBill({ id: 'b-overdue', name: 'Overdue Bill', dueDate: daysFromNow(-2) }),
    ]);
    const { container } = render(<Bills />);
    await screen.findByText('Overdue Bill');

    const card = billCardByName(container, 'Overdue Bill');
    const chip = urgencyChip(card);
    expect(chip.className).toContain('text-rose-500');
    expect(chip.textContent).toMatch(/2 day\(s\) ago/);
  });

  it('shows a bill due today as urgent with "in 0 day(s)" wording', async () => {
    billsApi.list.mockResolvedValue([
      makeBill({ id: 'b-today', name: 'Today Bill', dueDate: daysFromNow(0) }),
    ]);
    const { container } = render(<Bills />);
    await screen.findByText('Today Bill');

    const card = billCardByName(container, 'Today Bill');
    const chip = urgencyChip(card);
    expect(chip.className).toContain('text-rose-500');
    expect(chip.textContent).toMatch(/in 0 day\(s\)/);
  });

  it('shows a bill due in 3 days as urgent (within the 5-day window)', async () => {
    billsApi.list.mockResolvedValue([
      makeBill({ id: 'b-soon', name: 'Soon Bill', dueDate: daysFromNow(3) }),
    ]);
    const { container } = render(<Bills />);
    await screen.findByText('Soon Bill');

    const card = billCardByName(container, 'Soon Bill');
    const chip = urgencyChip(card);
    expect(chip.className).toContain('text-rose-500');
    expect(chip.textContent).toMatch(/in 3 day\(s\)/);
  });

  it('shows a bill due in 10 days as not urgent (neutral tone, no day count)', async () => {
    billsApi.list.mockResolvedValue([
      makeBill({ id: 'b-far', name: 'Far Bill', dueDate: daysFromNow(10) }),
    ]);
    const { container } = render(<Bills />);
    await screen.findByText('Far Bill');

    const card = billCardByName(container, 'Far Bill');
    const chip = urgencyChip(card);
    expect(chip.className).not.toContain('text-rose-500');
    expect(chip.className).toContain('text-muted');
    expect(chip.textContent).not.toMatch(/day\(s\)/);
  });

  it('does not mark a paid bill as urgent even if its due date is in the past', async () => {
    billsApi.list.mockResolvedValue([
      makeBill({ id: 'b-paid', name: 'Paid Overdue Bill', dueDate: daysFromNow(-5), status: 'paid' }),
    ]);
    const { container } = render(<Bills />);
    await screen.findByText('Paid Overdue Bill');

    const card = billCardByName(container, 'Paid Overdue Bill');
    const chip = urgencyChip(card);
    expect(chip.className).not.toContain('text-rose-500');
  });
});

describe('Bills page — Add bill modal validation', () => {
  beforeEach(() => {
    billsApi.list.mockResolvedValue([]);
  });

  it('shows validation errors and does not call billsApi.create when required fields are empty', async () => {
    const user = userEvent.setup();
    render(<Bills />);
    await screen.findByText('No bills tracked yet');

    await user.click(screen.getByRole('button', { name: 'Add bill' }));
    const dialog = await screen.findByRole('dialog');

    // Clear the pre-filled amount isn't needed — it's already blank; just submit.
    await user.click(within(dialog).getByRole('button', { name: /Add bill/ }));

    expect(await within(dialog).findByText('Bill name is required.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter an amount greater than 0.')).toBeInTheDocument();
    expect(within(dialog).getByText('Select a category so we know how to book the transaction.')).toBeInTheDocument();
    expect(within(dialog).getByText('Select at least one tag or add a label.')).toBeInTheDocument();
    expect(billsApi.create).not.toHaveBeenCalled();
  });

  it('rejects a transfer bill whose from and to accounts are the same', async () => {
    const user = userEvent.setup();
    render(<Bills />);
    await screen.findByText('No bills tracked yet');

    await user.click(screen.getByRole('button', { name: 'Add bill' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByPlaceholderText(/e.g. Rent, Netflix, Electricity/), 'Sweep');
    await user.type(within(dialog).getByPlaceholderText('0.00'), '50');
    await user.click(within(dialog).getByRole('button', { name: 'Transfer' }));

    // Quick-tag pills carry the "chip" class; the account IconSelect
    // triggers don't, so this disambiguates from the "To account" trigger
    // which also happens to read "Savings" at this point.
    const savingsTag = Array.from(dialog.querySelectorAll('.chip')).find((el) => el.textContent.trim() === 'Savings');
    await user.click(savingsTag);

    // "From account" defaults to Checking; switch it to Savings, which is
    // already the (unchanged) "To account" — this is the real path a user
    // can hit through the UI, since the "To account" dropdown filters out
    // whatever is currently selected as "From account" but changing "From"
    // does not retroactively clear/adjust "To".
    await user.click(within(dialog).getByRole('button', { name: 'Checking' }));
    const openPanel = dialog.querySelector('.z-20');
    await user.click(within(openPanel).getByText('Savings'));

    await user.click(within(dialog).getByRole('button', { name: 'Add bill' }));

    expect(await within(dialog).findByText('From and to accounts must be different.')).toBeInTheDocument();
    expect(billsApi.create).not.toHaveBeenCalled();
  });

  it('submits a valid expense bill with the expected payload shape', async () => {
    const user = userEvent.setup();
    billsApi.create.mockResolvedValue({});
    render(<Bills />);
    await screen.findByText('No bills tracked yet');

    await user.click(screen.getByRole('button', { name: 'Add bill' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByPlaceholderText(/e.g. Rent, Netflix, Electricity/), 'Netflix');
    await user.type(within(dialog).getByPlaceholderText('0.00'), '15.99');

    await user.click(within(dialog).getByRole('button', { name: 'Select category' }));
    await user.click(within(dialog).getByText('Subscriptions'));

    await user.click(within(dialog).getByText('Expenditure'));

    await user.click(within(dialog).getByRole('button', { name: /Add bill/ }));

    await waitFor(() => expect(billsApi.create).toHaveBeenCalledTimes(1));
    expect(billsApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Netflix',
        type: 'expense',
        amount: 15.99,
        categoryId: 'cat2',
        labels: ['Expenditure'],
        accountId: 'acc1',
        status: 'pending',
      })
    );
  });
});

describe('Bills page — Mark as paid confirmation flow', () => {
  it('opens a confirmation modal and calls billsApi.update with the paid* payload on confirm', async () => {
    const user = userEvent.setup();
    billsApi.list.mockResolvedValue([makeBill()]);
    billsApi.update.mockResolvedValue({ postedTransaction: { id: 'txn1' } });
    render(<Bills />);
    await screen.findByText('Rent');

    await user.click(screen.getByRole('button', { name: 'Mark as paid' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Mark as paid')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Mark as Paid' }));

    await waitFor(() => expect(billsApi.update).toHaveBeenCalledTimes(1));
    expect(billsApi.update).toHaveBeenCalledWith(
      'bill1',
      expect.objectContaining({
        status: 'paid',
        paidDate: expect.any(String),
        paidPaymentMethod: 'Bank Transfer',
        paidNote: '',
        paidAccountId: 'acc1',
      })
    );
  });

  it('does not call billsApi.update when the confirmation modal is cancelled', async () => {
    const user = userEvent.setup();
    billsApi.list.mockResolvedValue([makeBill()]);
    render(<Bills />);
    await screen.findByText('Rent');

    await user.click(screen.getByRole('button', { name: 'Mark as paid' }));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(billsApi.update).not.toHaveBeenCalled();
  });
});
