import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CsvImportModal, { normalize, guessMapping } from '../CsvImportModal.jsx';
import { transactionsApi } from '../../lib/api.js';

vi.mock('../../lib/api.js', async () => {
  const actual = await vi.importActual('../../lib/api.js');
  return {
    ...actual,
    transactionsApi: { ...actual.transactionsApi, bulk: vi.fn() },
  };
});

// `globals: false` (see vite.config.js) means @testing-library/react's
// auto-cleanup-after-each never registers, so every render here must be
// unmounted explicitly or later tests see leftover DOM from earlier ones.
afterEach(() => cleanup());

describe('normalize', () => {
  it('lowercases and strips non-alphanumeric characters', () => {
    expect(normalize('Date')).toBe('date');
    expect(normalize('Transaction Date')).toBe('transactiondate');
    expect(normalize('  Amount  ')).toBe('amount');
    expect(normalize('Debit/Credit')).toBe('debitcredit');
    expect(normalize('Payment-Method')).toBe('paymentmethod');
    expect(normalize('Category_Name')).toBe('categoryname');
  });

  it('produces the same output for equivalent headers in different casing/punctuation', () => {
    expect(normalize('TRANSACTION DATE')).toBe(normalize('transaction_date'));
    expect(normalize('Payee')).toBe(normalize('  payee  '));
  });
});

describe('guessMapping', () => {
  it('maps a representative set of real-world CSV headers to internal field names', () => {
    const headers = ['Date', 'Description', 'Amount', 'Category', 'Account', 'Payment Method', 'Notes'];
    const mapping = guessMapping(headers);
    expect(mapping).toEqual({
      date: 'Date',
      vendor: 'Description',
      amount: 'Amount',
      category: 'Category',
      account: 'Account',
      paymentMethod: 'Payment Method',
      note: 'Notes',
    });
  });

  it('recognizes alternate common header names (Transaction Date, Payee, Merchant, Memo)', () => {
    const headers = ['Transaction Date', 'Payee', 'Value', 'Transaction Type'];
    const mapping = guessMapping(headers);
    expect(mapping.date).toBe('Transaction Date');
    expect(mapping.vendor).toBe('Payee');
    expect(mapping.amount).toBe('Value');
    expect(mapping.type).toBe('Transaction Type');
  });

  it('does not map a field when no header matches (no wrong guess for unrecognized headers)', () => {
    const headers = ['SomeRandomColumn', 'AnotherOne'];
    const mapping = guessMapping(headers);
    expect(mapping.date).toBeUndefined();
    expect(mapping.vendor).toBeUndefined();
    expect(mapping.amount).toBeUndefined();
    expect(mapping.category).toBeUndefined();
    expect(mapping.account).toBeUndefined();
  });

  it('is case- and whitespace-insensitive when matching against the header dictionary', () => {
    const headers = [' DATE ', 'merchant', 'AMOUNT'];
    const mapping = guessMapping(headers);
    expect(mapping.date).toBe(' DATE ');
    expect(mapping.vendor).toBe('merchant');
    expect(mapping.amount).toBe('AMOUNT');
  });
});

// `buildPayloads` is defined inside the CsvImportModal component (it closes
// over `headers`/`rows`/`mapping`/`categories`/`accounts`/default ids), so it
// cannot be exported as a standalone module-level function without either
// changing its signature or moving it out of the component — both are
// explicitly out of scope for this pass. It's exercised indirectly here by
// driving the real import flow and inspecting the payload actually sent to
// transactionsApi.bulk, which covers the same behavior (amount-sign
// inference, category/account resolution with fallback defaults).
describe('CsvImportModal import flow (covers buildPayloads indirectly)', () => {
  // Category/account fixtures deliberately put a non-matching "default" entry
  // first so the component's auto-selected default (index 0) is distinct
  // from every category/account actually referenced in the CSV rows below.
  const categories = [
    { id: 'catOther', name: 'Other' },
    { id: 'catGroceries', name: 'Groceries' },
    { id: 'catSalary', name: 'Salary' },
  ];
  const accounts = [
    { id: 'accSavings', name: 'Savings' },
    { id: 'accChecking', name: 'Checking' },
  ];

  const CSV_TEXT = [
    'Date,Description,Amount,Category,Account',
    '2026-01-15,Grocery Store,-45.50,Groceries,Checking',
    '2026-01-16,Paycheck,2000,Salary,Checking',
    '2026-01-17,Mystery Vendor,-10,UnknownCat,UnknownAcc',
  ].join('\n');

  beforeEach(() => {
    vi.clearAllMocks();
    transactionsApi.bulk.mockResolvedValue({ count: 3 });
  });

  it('guesses the column mapping from headers after a CSV file is selected', async () => {
    const user = userEvent.setup();
    render(<CsvImportModal open onClose={vi.fn()} categories={categories} accounts={accounts} onImported={vi.fn()} />);

    const file = new File([CSV_TEXT], 'test.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]');
    await user.upload(input, file);

    // Mapping stage shows a custom dropdown button per field (see ui/Input.jsx
    // Select — it's a button + portal menu, not a native <select>), whose
    // visible label is the guessed header name.
    await screen.findByText('Preview (first 3 rows)');
    expect(screen.getByRole('button', { name: 'Date' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Description' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Amount' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Category' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
  });

  it('infers expense/income from amount sign and resolves category/account names to ids, falling back to the defaults for unmatched names', async () => {
    const user = userEvent.setup();
    render(<CsvImportModal open onClose={vi.fn()} categories={categories} accounts={accounts} onImported={vi.fn()} />);

    const file = new File([CSV_TEXT], 'test.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]');
    await user.upload(input, file);

    const importBtn = await screen.findByRole('button', { name: /Import 3 rows/i });
    await user.click(importBtn);

    await waitFor(() => expect(transactionsApi.bulk).toHaveBeenCalledTimes(1));
    const payloads = transactionsApi.bulk.mock.calls[0][0];
    expect(payloads).toHaveLength(3);

    // Row 1: negative amount -> expense, amount stored as absolute value, category/account resolved by name.
    expect(payloads[0]).toMatchObject({
      date: '2026-01-15', vendor: 'Grocery Store', amount: 45.5, type: 'expense',
      categoryId: 'catGroceries', accountId: 'accChecking',
    });

    // Row 2: positive amount -> income.
    expect(payloads[1]).toMatchObject({
      date: '2026-01-16', vendor: 'Paycheck', amount: 2000, type: 'income',
      categoryId: 'catSalary', accountId: 'accChecking',
    });

    // Row 3: unmatched category/account names fall back to the selected defaults
    // (index 0 of each list: "Other" / "Savings"), not left blank or mismatched.
    expect(payloads[2]).toMatchObject({
      date: '2026-01-17', vendor: 'Mystery Vendor', amount: 10, type: 'expense',
      categoryId: 'catOther', accountId: 'accSavings',
    });
  });
});
