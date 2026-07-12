import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Budgets from '../Budgets.jsx';
import { budgetsApi, categoriesApi, formatCurrency } from '../../lib/api.js';

vi.mock('../../lib/api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    budgetsApi: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
    categoriesApi: { ...actual.categoriesApi, list: vi.fn() },
  };
});

vi.mock('../../context/AccountsGateContext.jsx', () => ({
  useAccountsGate: () => ({ loaded: true, hasAccounts: true, accountCount: 1, refresh: vi.fn() }),
}));

const CATEGORIES = [
  { id: 'cat1', name: 'Groceries', color: '#f43f5e', icon: 'ShoppingCart' },
  { id: 'cat2', name: 'Entertainment', color: '#0ea5e9', icon: 'Tv' },
];

function makeBudget(overrides = {}) {
  return {
    id: 'b1', categoryId: 'cat1', category: CATEGORIES[0], limit: 100, spent: 50, period: 'monthly', alertAt: 80,
    startDate: null, endDate: null,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  categoriesApi.list.mockResolvedValue(CATEGORIES);
});

// globals: false in vite.config.js means @testing-library/react's
// auto-cleanup (which only self-registers if it detects a *global*
// afterEach) never kicks in, so each render() leaks its DOM into the next
// test unless cleaned up explicitly.
afterEach(cleanup);

// Returns the ProgressBar's colored inner bar for a given budget's Card,
// located by its category name heading. Plain DOM traversal (not
// screen.getByText) since the tone class lives on an inner div with no
// distinguishing text of its own.
function barFor(container, categoryName) {
  const heading = within(container).getByText(categoryName);
  const card = heading.closest('.card');
  return card.querySelector('.h-full');
}

describe('Budgets page — tone rendering (indirect toneFor coverage)', () => {
  const budgets = [
    makeBudget({ id: 'b-brand', categoryId: 'cat1', category: CATEGORIES[0], limit: 100, spent: 50 }), // 50% -> brand
    makeBudget({ id: 'b-warning', categoryId: 'cat2', category: CATEGORIES[1], limit: 100, spent: 80 }), // 80% -> warning
    makeBudget({ id: 'b-danger', categoryId: 'cat1', category: { ...CATEGORIES[0], name: 'Rent' }, limit: 100, spent: 95 }), // 95% -> danger
    makeBudget({ id: 'b-over', categoryId: 'cat2', category: { ...CATEGORIES[1], name: 'Travel' }, limit: 100, spent: 120 }), // clamped 100% -> danger
  ];

  beforeEach(() => {
    budgetsApi.list.mockResolvedValue(budgets);
  });

  it('uses the brand tone under the warning threshold (50%)', async () => {
    const { container } = render(<Budgets />);
    await screen.findByText('Groceries');
    const bar = barFor(container, 'Groceries');
    expect(bar.className).toContain('bg-brand-500');
  });

  it('uses the warning tone at 80% (>= 75%, < 90%)', async () => {
    const { container } = render(<Budgets />);
    await screen.findByText('Entertainment');
    const bar = barFor(container, 'Entertainment');
    expect(bar.className).toContain('bg-amber-500');
  });

  it('uses the danger tone at 95% (>= 90%)', async () => {
    const { container } = render(<Budgets />);
    await screen.findByText('Rent');
    const bar = barFor(container, 'Rent');
    expect(bar.className).toContain('bg-rose-500');
  });

  it('uses the danger tone when spend exceeds the limit (clamped display at 100%) and shows the "over" chip', async () => {
    const { container } = render(<Budgets />);
    await screen.findByText('Travel');
    const bar = barFor(container, 'Travel');
    expect(bar.className).toContain('bg-rose-500');
    const card = screen.getByText('Travel').closest('.card');
    expect(within(card).getByText(`${formatCurrency(20)} over`)).toBeInTheDocument();
  });

  it('computes totalBudget/totalSpent/overallPct header stats from the fixture', async () => {
    render(<Budgets />);
    await screen.findByText('Groceries');

    // totalBudget = 100+100+100+100 = 400; totalSpent = 50+80+95+120 = 345
    expect(screen.getByText(formatCurrency(400))).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(345))).toBeInTheDocument();
    // remaining = 400 - 345 = 55
    expect(screen.getByText(formatCurrency(55))).toBeInTheDocument();
    // overallPct = min(100, 345/400*100) = 86.25 -> "86%"
    expect(screen.getByText('86%')).toBeInTheDocument();

    // Overall progress bar itself: 86.25% falls in the warning bucket (>=75, <90).
    const overallCard = screen.getByText('Overall progress').closest('.card');
    const overallBar = overallCard.querySelector('.h-full');
    expect(overallBar.className).toContain('bg-amber-500');
  });
});

describe('Budgets page — New/Edit budget modal validation', () => {
  const budgets = [makeBudget()];

  beforeEach(() => {
    budgetsApi.list.mockResolvedValue(budgets);
  });

  it('shows an error and does not call budgetsApi.create when limit is left blank', async () => {
    const user = userEvent.setup();
    render(<Budgets />);
    await screen.findByText('Groceries');

    await user.click(screen.getByRole('button', { name: 'New budget' }));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', {  name: 'Add budget' }));

    expect(await within(dialog).findByText('Enter a limit greater than 0.')).toBeInTheDocument();
    expect(budgetsApi.create).not.toHaveBeenCalled();
  });

  it('requires both start and end dates for a custom period', async () => {
    const user = userEvent.setup();
    render(<Budgets />);
    await screen.findByText('Groceries');

    await user.click(screen.getByRole('button', { name: 'New budget' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByPlaceholderText('0.00'), '200');
    await user.click(within(dialog).getByRole('button', { name: 'Custom' }));
    await user.click(within(dialog).getByRole('button', {  name: 'Add budget' }));

    expect(await within(dialog).findByText('Set both start and end dates for a custom period.')).toBeInTheDocument();
    expect(budgetsApi.create).not.toHaveBeenCalled();
  });

  it('submits a valid new budget with the expected payload shape', async () => {
    const user = userEvent.setup();
    budgetsApi.create.mockResolvedValue({});
    render(<Budgets />);
    await screen.findByText('Groceries');

    await user.click(screen.getByRole('button', { name: 'New budget' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByPlaceholderText('0.00'), '500');
    await user.click(within(dialog).getByRole('button', {  name: 'Add budget' }));

    await waitFor(() => expect(budgetsApi.create).toHaveBeenCalledTimes(1));
    expect(budgetsApi.create).toHaveBeenCalledWith({
      categoryId: 'cat1',
      limit: 500,
      period: 'monthly',
      alertAt: 80,
      startDate: null,
      endDate: null,
    });
  });

  it('submits an edit with budgetsApi.update called for the editing budget id', async () => {
    const user = userEvent.setup();
    budgetsApi.update.mockResolvedValue({});
    render(<Budgets />);
    await screen.findByText('Groceries');

    const card = screen.getByText('Groceries').closest('.card');
    await user.click(within(card).getByLabelText('Edit'));
    const dialog = await screen.findByRole('dialog');

    const limitInput = within(dialog).getByPlaceholderText('0.00');
    await user.clear(limitInput);
    await user.type(limitInput, '150');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(budgetsApi.update).toHaveBeenCalledTimes(1));
    expect(budgetsApi.update).toHaveBeenCalledWith('b1', expect.objectContaining({ limit: 150, categoryId: 'cat1' }));
  });
});
