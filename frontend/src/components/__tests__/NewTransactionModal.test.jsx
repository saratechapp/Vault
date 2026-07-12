import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewTransactionModal from '../NewTransactionModal.jsx';
import { transactionsApi, templatesApi } from '../../lib/api.js';
import { readPrefs } from '../../lib/preferences.js';

vi.mock('../../lib/api.js', () => ({
  transactionsApi: { create: vi.fn(), update: vi.fn() },
  templatesApi: { create: vi.fn() },
}));

const CATEGORIES = [
  { id: 'catFood', name: 'Food', color: '#f43f5e', icon: 'UtensilsCrossed', parentId: null },
  { id: 'catCoffee', name: 'Coffee', color: '#0ea5e9', icon: 'Coffee', parentId: 'catFood' },
  { id: 'catTransfer', name: 'Transfer', color: '#64748b', icon: 'ArrowLeftRight', parentId: null },
];
const ACCOUNTS = [
  { id: 'acc1', name: 'Main Checking', color: '#111827', icon: 'Wallet' },
  { id: 'acc2', name: 'Vacation Fund', color: '#0891b2', icon: 'PiggyBank' },
];

function baseProps(overrides = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    editingTxn: null,
    prefillTxn: null,
    categories: CATEGORIES,
    accounts: ACCOUNTS,
    templates: [],
    transactions: [],
    onSaved: vi.fn(),
    ...overrides,
  };
}

function localDateStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Opens an IconSelect by its trigger button and clicks an option inside the
// dropdown panel that opens right next to it — scoped to that panel so it
// can't accidentally match an identically-named option/trigger elsewhere
// (e.g. two "Select account" pickers side by side for a transfer).
async function pickIconSelect(user, triggerButton, optionName) {
  await user.click(triggerButton);
  const panel = triggerButton.parentElement.querySelector('.z-20');
  await user.click(within(panel).getByText(optionName));
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// globals: false in vite.config.js means @testing-library/react's
// auto-cleanup (which only self-registers if it detects a *global*
// afterEach) never kicks in, so each render() leaks its DOM into the next
// test unless cleaned up explicitly.
afterEach(cleanup);

describe('NewTransactionModal — validate()', () => {
  it('rejects an amount of 0 or less', async () => {
    const user = userEvent.setup();
    render(<NewTransactionModal {...baseProps()} />);

    await user.type(screen.getByPlaceholderText('e.g. Blue Tokai Coffee'), 'Coffee Shop');
    await pickIconSelect(user, screen.getByRole('button', { name: 'Select account' }), 'Main Checking');
    await pickIconSelect(user, screen.getByRole('button', { name: 'Select category' }), 'Food');
    await user.click(screen.getByRole('button', { name: 'Expenditure' }));
    await user.type(screen.getByPlaceholderText('0.00'), '0');

    await user.click(screen.getByRole('button', { name: 'Add record' }));

    expect(await screen.findByText('Enter a valid amount.')).toBeInTheDocument();
    expect(transactionsApi.create).not.toHaveBeenCalled();
  });

  it('requires vendor/source for a non-transfer transaction', async () => {
    const user = userEvent.setup();
    render(<NewTransactionModal {...baseProps()} />);

    await user.type(screen.getByPlaceholderText('0.00'), '25');
    await pickIconSelect(user, screen.getByRole('button', { name: 'Select account' }), 'Main Checking');
    await pickIconSelect(user, screen.getByRole('button', { name: 'Select category' }), 'Food');
    await user.click(screen.getByRole('button', { name: 'Expenditure' }));

    await user.click(screen.getByRole('button', { name: 'Add record' }));

    expect(await screen.findByText('Vendor / Source is required.')).toBeInTheDocument();
    expect(transactionsApi.create).not.toHaveBeenCalled();
  });

  it('requires an account for a non-transfer transaction', async () => {
    const user = userEvent.setup();
    render(<NewTransactionModal {...baseProps()} />);

    await user.type(screen.getByPlaceholderText('e.g. Blue Tokai Coffee'), 'Coffee Shop');
    await user.type(screen.getByPlaceholderText('0.00'), '25');
    await pickIconSelect(user, screen.getByRole('button', { name: 'Select category' }), 'Food');
    await user.click(screen.getByRole('button', { name: 'Expenditure' }));

    await user.click(screen.getByRole('button', { name: 'Add record' }));

    expect(await screen.findByText('Select an account.')).toBeInTheDocument();
    expect(transactionsApi.create).not.toHaveBeenCalled();
  });

  it('requires a category for a non-transfer transaction', async () => {
    const user = userEvent.setup();
    render(<NewTransactionModal {...baseProps()} />);

    await user.type(screen.getByPlaceholderText('e.g. Blue Tokai Coffee'), 'Coffee Shop');
    await user.type(screen.getByPlaceholderText('0.00'), '25');
    await pickIconSelect(user, screen.getByRole('button', { name: 'Select account' }), 'Main Checking');
    await user.click(screen.getByRole('button', { name: 'Expenditure' }));

    await user.click(screen.getByRole('button', { name: 'Add record' }));

    expect(await screen.findByText('Select a category.')).toBeInTheDocument();
    expect(transactionsApi.create).not.toHaveBeenCalled();
  });

  it('requires at least one quick tag when creating (not required when editing)', async () => {
    const user = userEvent.setup();
    render(<NewTransactionModal {...baseProps()} />);

    await user.type(screen.getByPlaceholderText('e.g. Blue Tokai Coffee'), 'Coffee Shop');
    await user.type(screen.getByPlaceholderText('0.00'), '25');
    await pickIconSelect(user, screen.getByRole('button', { name: 'Select account' }), 'Main Checking');
    await pickIconSelect(user, screen.getByRole('button', { name: 'Select category' }), 'Food');

    await user.click(screen.getByRole('button', { name: 'Add record' }));

    expect(await screen.findByText('Select at least one tag.')).toBeInTheDocument();
    expect(transactionsApi.create).not.toHaveBeenCalled();
  });

  it('rejects a transfer whose from and to accounts are the same', async () => {
    const user = userEvent.setup();
    render(<NewTransactionModal {...baseProps()} />);

    await user.click(screen.getByRole('button', { name: 'Transfer' }));
    await user.type(screen.getByPlaceholderText('0.00'), '100');
    await user.click(screen.getByRole('button', { name: 'Expenditure' }));

    // Pick "To account" first (its options are the full, unfiltered list),
    // then pick the very same account for "From account" — the UI only
    // filters the "To" list against the current "From" selection, not the
    // reverse, so this is the real path a user can hit.
    const [fromTrigger, toTrigger] = screen.getAllByRole('button', { name: 'Select account' });
    await pickIconSelect(user, toTrigger, 'Main Checking');
    await pickIconSelect(user, fromTrigger, 'Main Checking');

    await user.click(screen.getByRole('button', { name: 'Add record' }));

    expect(await screen.findByText('From and To accounts must be different.')).toBeInTheDocument();
    expect(transactionsApi.create).not.toHaveBeenCalled();
  });
});

describe('NewTransactionModal — type switching shows/hides the right fields', () => {
  it('expense (default): a single account picker, a single category picker, and the vendor placeholder', () => {
    render(<NewTransactionModal {...baseProps()} />);
    expect(screen.getAllByRole('button', { name: 'Select account' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Select category' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Blue Tokai Coffee')).toBeInTheDocument();
  });

  it('transfer: two account pickers, no category picker, and the description placeholder', async () => {
    const user = userEvent.setup();
    render(<NewTransactionModal {...baseProps()} />);

    await user.click(screen.getByRole('button', { name: 'Transfer' }));

    expect(screen.getAllByRole('button', { name: 'Select account' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Select category' })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Optional description')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g. Blue Tokai Coffee')).not.toBeInTheDocument();
  });

  it('income: back to a single account picker and single category picker', async () => {
    const user = userEvent.setup();
    render(<NewTransactionModal {...baseProps()} />);

    await user.click(screen.getByRole('button', { name: 'Transfer' }));
    // "Income" is ambiguous by name alone — it's both a type tab and a
    // QUICK_TAGS pill later in the form. The type tab renders first in DOM
    // order (above the Tags field), so it's the first match.
    await user.click(screen.getAllByRole('button', { name: 'Income' })[0]);

    expect(screen.getAllByRole('button', { name: 'Select account' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Select category' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Blue Tokai Coffee')).toBeInTheDocument();
  });
});

describe('NewTransactionModal — submission payloads', () => {
  it('builds and submits the correct payload for a valid expense', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    transactionsApi.create.mockResolvedValue({});
    render(<NewTransactionModal {...baseProps({ onSaved })} />);

    await user.type(screen.getByPlaceholderText('e.g. Blue Tokai Coffee'), 'Coffee Shop');
    await user.type(screen.getByPlaceholderText('0.00'), '4.5');
    await pickIconSelect(user, screen.getByRole('button', { name: 'Select account' }), 'Main Checking');
    await pickIconSelect(user, screen.getByRole('button', { name: 'Select category' }), 'Food');
    await user.click(screen.getByRole('button', { name: 'Expenditure' }));

    await user.click(screen.getByRole('button', { name: 'Add record' }));

    await waitFor(() => expect(transactionsApi.create).toHaveBeenCalledTimes(1));
    expect(transactionsApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'expense',
        date: localDateStr(),
        amount: 4.5,
        currency: readPrefs().currency,
        vendor: 'Coffee Shop',
        categoryId: 'catFood',
        accountId: 'acc1',
        labels: ['Expenditure'],
        paymentMethod: 'Bank Transfer',
        paymentStatus: 'cleared',
      })
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('builds and submits the correct payload for a valid transfer (categoryId null, from/to accounts, defaulted vendor)', async () => {
    const user = userEvent.setup();
    transactionsApi.create.mockResolvedValue({});
    render(<NewTransactionModal {...baseProps()} />);

    await user.click(screen.getByRole('button', { name: 'Transfer' }));
    await user.type(screen.getByPlaceholderText('0.00'), '250');
    await user.click(screen.getByRole('button', { name: 'Expenditure' }));

    const [fromTrigger, toTrigger] = screen.getAllByRole('button', { name: 'Select account' });
    await pickIconSelect(user, fromTrigger, 'Main Checking');
    await pickIconSelect(user, toTrigger, 'Vacation Fund');

    await user.click(screen.getByRole('button', { name: 'Add record' }));

    await waitFor(() => expect(transactionsApi.create).toHaveBeenCalledTimes(1));
    expect(transactionsApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'transfer',
        amount: 250,
        categoryId: null,
        vendor: 'Transfer',
        fromAccountId: 'acc1',
        toAccountId: 'acc2',
      })
    );
  });

  it('edit mode calls transactionsApi.update with the editing id and does not require a quick tag', async () => {
    const user = userEvent.setup();
    transactionsApi.update.mockResolvedValue({});
    const editingTxn = {
      id: 'tx1', type: 'expense', date: '2026-07-01', vendor: 'Old Vendor', amount: 10, currency: 'INR',
      categoryId: 'catFood', accountId: 'acc1', note: '', payer: '', paymentMethod: 'Bank Transfer',
      paymentStatus: 'cleared', labels: [],
    };
    render(<NewTransactionModal {...baseProps({ editingTxn })} />);

    const vendorInput = screen.getByDisplayValue('Old Vendor');
    await user.clear(vendorInput);
    await user.type(vendorInput, 'New Vendor');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(transactionsApi.update).toHaveBeenCalledTimes(1));
    expect(transactionsApi.update).toHaveBeenCalledWith('tx1', expect.objectContaining({ vendor: 'New Vendor' }));
    expect(transactionsApi.create).not.toHaveBeenCalled();
  });

  it('"save as template" also calls templatesApi.create alongside transactionsApi.create', async () => {
    const user = userEvent.setup();
    transactionsApi.create.mockResolvedValue({});
    templatesApi.create.mockResolvedValue({});
    render(<NewTransactionModal {...baseProps()} />);

    await user.type(screen.getByPlaceholderText('e.g. Blue Tokai Coffee'), 'Coffee Shop');
    await user.type(screen.getByPlaceholderText('0.00'), '4.5');
    await pickIconSelect(user, screen.getByRole('button', { name: 'Select account' }), 'Main Checking');
    await pickIconSelect(user, screen.getByRole('button', { name: 'Select category' }), 'Food');
    await user.click(screen.getByRole('button', { name: 'Expenditure' }));

    await user.click(screen.getByRole('button', { name: 'Create template from this record' }));
    await user.click(screen.getByRole('button', { name: 'Add record' }));

    await waitFor(() => expect(transactionsApi.create).toHaveBeenCalledTimes(1));
    expect(templatesApi.create).toHaveBeenCalledTimes(1);
    expect(templatesApi.create).toHaveBeenCalledWith(expect.objectContaining({ vendor: 'Coffee Shop', type: 'expense' }));
  });
});

describe('NewTransactionModal — vendor-history category suggestion', () => {
  it('auto-fills the category from prior transactions with the same vendor, and flags it as Suggested', async () => {
    const user = userEvent.setup();
    const transactions = [
      { type: 'expense', categoryId: 'catCoffee', vendor: 'Starbucks' },
      { type: 'expense', categoryId: 'catCoffee', vendor: 'Starbucks' },
      { type: 'expense', categoryId: 'catFood', vendor: 'Starbucks' },
    ];
    render(<NewTransactionModal {...baseProps({ transactions })} />);

    await user.type(screen.getByPlaceholderText('e.g. Blue Tokai Coffee'), 'Starbucks');

    await waitFor(() => expect(screen.getByText('Suggested')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Coffee/ })).toBeInTheDocument();
  });

  it('does not override a category the user already picked manually', async () => {
    const user = userEvent.setup();
    const transactions = [{ type: 'expense', categoryId: 'catCoffee', vendor: 'Starbucks' }];
    render(<NewTransactionModal {...baseProps({ transactions })} />);

    await pickIconSelect(user, screen.getByRole('button', { name: 'Select category' }), 'Food');
    await user.type(screen.getByPlaceholderText('e.g. Blue Tokai Coffee'), 'Starbucks');

    expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Food/ })).toBeInTheDocument();
  });
});
